import {configure} from "@genkit-ai/core";
import {firebase} from "@genkit-ai/firebase";
import {googleAI, gemini10Pro} from "@genkit-ai/googleai";
import {defineFlow, start} from "@genkit-ai/flow";
import * as z from "zod";
import {readFileAsText} from "./ml/taxonomy";

// Initialize Genkit with Firebase and Google AI plugins
configure({
  plugins: [
    firebase(),
    googleAI({apiVersion: ["v1beta"]}),
  ],
  logLevel: "debug",
  enableTracingAndMetrics: true,
});

// --- Resume Analysis --- //
const ResumeAnalysisSchema = z.object({
  summary: z.string().describe(
    "A 2-3 sentence professional summary based on the resume."
  ),
  skills: z.array(z.string()).describe(
    "A list of key technical and soft skills extracted from the resume."
  ),
});

export const resumeAnalysisFlow = defineFlow(
  {
    name: "resumeAnalysisFlow",
    inputSchema: z.string().describe("The full text content of a resume."),
    outputSchema: ResumeAnalysisSchema,
  },
  async (resumeText) => {
    const prompt = `Analyze the following resume text and extract key
      information. Provide a 2-3 sentence professional summary and a list of
      the most relevant skills.\n\nResume:\n---\n${resumeText}\n---
    `;
    const llmResponse = await gemini10Pro.generate({
      prompt: prompt,
      output: {schema: ResumeAnalysisSchema},
    });
    const output = llmResponse.output();
    if (!output) {
      throw new Error("LLM response did not contain valid output.");
    }
    return output;
  }
);

// --- Salary Prediction --- //
const SalaryPredictionInputSchema = z.object({
  jobDescription: z.string().describe("The full text of the job description."),
  userSkills: z.array(z.string()).describe("A list of the candidate's skills."),
  experienceYears: z.number().describe("The candidate's years of professional experience."),
});

const SalaryPredictionOutputSchema = z.object({
  predictedSalaryMin: z.number().describe("The predicted minimum annual salary."),
  predictedSalaryMax: z.number().describe("The predicted maximum annual salary."),
  currency: z.string().describe("The currency code (e.g., USD, EUR)."),
  reasoning: z.string().describe("A brief explanation for the salary prediction, citing skills and experience."),
});

export const salaryPredictionFlow = defineFlow(
  {
    name: "salaryPredictionFlow",
    inputSchema: SalaryPredictionInputSchema,
    outputSchema: SalaryPredictionOutputSchema,
  },
  async ({ jobDescription, userSkills, experienceYears }) => {
    const prompt = `
      Act as an expert salary analyst. Based on the provided job description,
      candidate skills, and years of experience, predict a realistic annual
      salary range. Consider market rates for the role, the value of specific
      skills, and the impact of experience.

      Job Description:\n---\n${jobDescription}\n---\n
      Candidate Skills: ${userSkills.join(', ')}\n      Candidate Experience: ${experienceYears} years

      Provide your prediction as a JSON object with the minimum salary,
      maximum salary, currency, and a brief reasoning.
    `;

    const llmResponse = await gemini10Pro.generate({
      prompt: prompt,
      output: { schema: SalaryPredictionOutputSchema },
    });

    const output = llmResponse.output();
    if (!output) {
      throw new Error("LLM response did not contain valid output.");
    }
    return output;
  }
);

// --- Culture Fit Scoring --- //
const CultureFitInputSchema = z.object({
  resumeText: z.string().describe("The full text of the candidate's resume."),
  companyCulture: z.string().describe("A description of the company's culture, values, and work environment."),
});

const CultureFitOutputSchema = z.object({
  score: z.number().min(0).max(100).describe("A score from 0-100 indicating the degree of cultural alignment."),
  summary: z.string().describe("A 2-3 sentence summary explaining the score."),
  matchingAttributes: z.array(z.string()).describe("A list of specific cultural attributes that align (e.g., 'fast-paced environment', 'values continuous learning')."),
});

export const cultureFitFlow = defineFlow(
  {
    name: "cultureFitFlow",
    inputSchema: CultureFitInputSchema,
    outputSchema: CultureFitOutputSchema,
  },
  async ({ resumeText, companyCulture }) => {
    const prompt = `
      Act as an organizational psychologist. Analyze the candidate's resume against
      the provided company culture description. Infer the candidate's work style,
      values, and preferences from their experience and project descriptions.
      Compare this with the company's stated culture.

      Provide a score from 0-100 indicating the strength of the alignment,
      a brief summary, and a list of specific matching cultural attributes.

      Candidate Resume:\n---\n${resumeText}\n---\n
      Company Culture:\n---\n${companyCulture}\n---
    `;

    const llmResponse = await gemini10Pro.generate({
      prompt: prompt,
      output: { schema: CultureFitOutputSchema },
    });

    const output = llmResponse.output();
    if (!output) {
      throw new Error("LLM response did not contain valid output.");
    }
    return output;
  }
);


const AnalyzeAndStoreSchema = z.object({
  resumeText: z.string().describe("The full text content of a resume."),
  userId: z.string().describe("The ID of the user this resume belongs to."),
});

export const analyzeAndStoreResumeFlow = defineFlow(
  {
    name: "analyzeAndStoreResumeFlow",
    inputSchema: AnalyzeAndStoreSchema,
    outputSchema: z.string().describe(
      "The Firestore path to the stored analysis."
    ),
  },
  async ({resumeText, userId}) => {
    const analysis = await resumeAnalysisFlow.run(resumeText);
    const docRef = `/users/${userId}/resumeAnalysis/latest`;
    await firebase.firestore().doc(docRef).set(analysis);
    return docRef;
  }
);

export const analyzeResumeFromStorageFlow = defineFlow(
  {
    name: "analyzeResumeFromStorageFlow",
    inputSchema: z.string().describe(
      "The full GCS path to the resume file " +
      "(e.g., resumes/user123/my-resume.pdf)"
    ),
    outputSchema: z.string().describe(
      "The Firestore path to the stored analysis."
    ),
  },
  async (storagePath) => {
    const resumeText = await readFileAsText(storagePath);
    // Assumes path is in format: resumes/{userId}/{fileName}
    const userId = storagePath.split("/")[1];
    if (!userId) {
      throw new Error("Could not determine userId from storage path.");
    }
    const analysis = await resumeAnalysisFlow.run(resumeText);
    const docRef = `/users/${userId}/resumeAnalysis/latest`;
    await firebase.firestore().doc(docRef).set(analysis);
    return docRef;
  }
);

// --- Job Matching & Recommendation --- //
const JobMatchInputSchema = z.object({
  userId: z.string().describe("The ID of the user to match."),
  jobDescription: z.string().describe(
    "The full text of the job description."
  ),
});

const JobMatchOutputSchema = z.object({
  matchScore: z.number().min(0).max(100).describe(
    "A score from 0-100 indicating how well the candidate matches the job."
  ),
  reasoning: z.string().describe(
    "A detailed explanation of the match score, " +
    "highlighting strengths and weaknesses."
  ),
});

export const jobMatchingFlow = defineFlow(
  {
    name: "jobMatchingFlow",
    inputSchema: JobMatchInputSchema,
    outputSchema: JobMatchOutputSchema,
  },
  async ({userId, jobDescription}) => {
    const docRef = `/users/${userId}/resumeAnalysis/latest`;
    const analysisDoc = await firebase.firestore().doc(docRef).get();
    if (!analysisDoc.exists) {
      throw new Error(
        `No resume analysis found for user ${userId}. Please run analyzeAndStoreResumeFlow first.`
      );
    }
    const analysisData = analysisDoc.data();
    if (!analysisData) {
      throw new Error("Resume analysis data is missing.");
    }
    const userSkills = analysisData.skills || [];
    const prompt = `Evaluate how well a candidate with the following skills
      matches the provided job description. Provide a match score from 0-100 and
      a detailed reasoning.\n\nCandidate Skills: ${userSkills.join(", ")}
      \n\nJob Description:\n---\n${jobDescription}\n---
    `;
    const llmResponse = await gemini10Pro.generate({
      prompt: prompt,
      output: {schema: JobMatchOutputSchema},
    });
    const output = llmResponse.output();
    if (!output) {
      throw new Error("LLM response did not contain valid output.");
    }
    return output;
  }
);

const RecommendedJobSchema = z.object({
  jobId: z.string(),
  title: z.string(),
  company: z.string(),
  matchScore: z.number(),
  reasoning: z.string(),
});

export const recommendedJobsFlow = defineFlow(
  {
    name: "recommendedJobsFlow",
    inputSchema: z.string().describe(
      "The user ID to generate recommendations for."
    ),
    outputSchema: z.array(RecommendedJobSchema),
  },
  async (userId) => {
    // 1. Get user's skills
    const analysisDoc = await firebase.firestore()
      .doc(`/users/${userId}/resumeAnalysis/latest`).get();
    if (!analysisDoc.exists) {
      return [];
    }
    const analysisData = analysisDoc.data();
    if (!analysisData) {
      return [];
    }
    const userSkills = analysisData.skills || [];

    // 2. Find relevant jobs
    let jobsSnapshot;
    if (userSkills.length > 0) {
      jobsSnapshot = await firebase.firestore().collection("jobs")
        .where("tags", "array-contains-any", userSkills).get();
    } else {
      jobsSnapshot = await firebase.firestore().collection("jobs")
        .limit(10).get();
    }

    if (jobsSnapshot.empty) {
      return [];
    }

    // 3. Run the matching flow for each job in parallel
    const matchPromises = jobsSnapshot.docs.map(async (jobDoc) => {
      const jobData = jobDoc.data();
      const matchResult = await jobMatchingFlow.run({
        userId: userId,
        jobDescription: jobData.description,
      });
      return {
        jobId: jobDoc.id,
        title: jobData.title,
        company: jobData.company,
        matchScore: matchResult.matchScore,
        reasoning: matchResult.reasoning,
      };
    });

    const allMatches = await Promise.all(matchPromises);

    // 4. Sort by match score and return the top 5
    return allMatches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  }
);

// --- Database Seeding & Testing --- //
export const seedJobsFlow = defineFlow(
  {name: "seedJobsFlow", outputSchema: z.string()},
  async () => {
    const jobs = [
      {
        title: "Senior Frontend Engineer (React)",
        company: "InnovateTech",
        location: "Remote",
        description: "...",
        tags: ["react", "typescript", "javascript", "frontend"],
      },
      {
        title: "Backend Developer (Node.js)",
        company: "DataCorp",
        location: "Hybrid",
        description: "...",
        tags: ["nodejs", "backend", "typescript", "aws"],
      },
      {
        title: "UX/UI Designer",
        company: "CreativeMinds",
        location: "On-site",
        description: "...",
        tags: ["figma", "ux", "ui", "design"],
      },
    ];
    const jobsCollection = firebase.firestore().collection("jobs");
    const promises = jobs.map((job) => jobsCollection.add(job));
    await Promise.all(promises);
    return `Seeded ${jobs.length} jobs.`;
  }
);

export const testResumeAnalysisFromStorageFlow = defineFlow(
  {
    name: "testResumeAnalysisFromStorageFlow",
    inputSchema: z.string().describe(
      "A test user ID to associate with the resume."
    ),
    outputSchema: z.string().describe(
      "The path to the created Firestore document."
    ),
  },
  async (userId) => {
    const dummyResumeContent = "Experienced React and Node.js developer " +
      "with a passion for building scalable web applications. " +
      "Proficient in TypeScript and AWS.";
    const storagePath = `resumes/${userId}/test-resume.txt`;

    // Simulate uploading the file to Firebase Storage
    await firebase.storage().bucket().file(storagePath)
      .save(dummyResumeContent);

    // Run the analysis flow
    const firestorePath = await analyzeResumeFromStorageFlow.run(storagePath);
    return firestorePath;
  }
);

// Start the flows server
start();
