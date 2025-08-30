
import { configureGenkit } from '@genkit-ai/core';
import { firebase } from '@genkit-ai/firebase';
import { googleAI, geminiPro } from '@genkit-ai/googleai';
import { defineFlow, startFlows } from '@genkit-ai/flow';
import * as z from 'zod';

// Initialize Genkit with Firebase and Google AI plugins
configureGenkit({
  plugins: [
    firebase(),
    googleAI({ apiVersion: ['v1beta']}),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

// --- Resume Analysis --- //
const ResumeAnalysisSchema = z.object({
  summary: z.string().describe('A 2-3 sentence professional summary based on the resume.'),
  skills: z.array(z.string()).describe('A list of key technical and soft skills extracted from the resume.'),
});

export const resumeAnalysisFlow = defineFlow(
  {
    name: 'resumeAnalysisFlow',
    inputSchema: z.string().describe('The full text content of a resume.'),
    outputSchema: ResumeAnalysisSchema,
  },
  async (resumeText) => {
    const prompt = `Analyze the following resume text and extract key information. Provide a 2-3 sentence professional summary and a list of the most relevant skills.\n\nResume:\n---\n${resumeText}\n---
    `;
    const llmResponse = await geminiPro.generate({ prompt: prompt, output: { schema: ResumeAnalysisSchema } });
    return llmResponse.output()!;
  }
);

const AnalyzeAndStoreSchema = z.object({
  resumeText: z.string().describe('The full text content of a resume.'),
  userId: z.string().describe('The ID of the user this resume belongs to.'),
});

export const analyzeAndStoreResumeFlow = defineFlow(
  {
    name: 'analyzeAndStoreResumeFlow',
    inputSchema: AnalyzeAndStoreSchema,
    outputSchema: z.string().describe('The Firestore path to the stored analysis.'),
  },
  async ({ resumeText, userId }) => {
    const analysis = await resumeAnalysisFlow.run(resumeText);
    const docRef = `/users/${userId}/resumeAnalysis/latest`;
    await firebase.firestore().doc(docRef).set(analysis);
    return docRef;
  }
);

// --- Job Matching & Recommendation --- //
const JobMatchInputSchema = z.object({
  userId: z.string().describe('The ID of the user to match.'),
  jobDescription: z.string().describe('The full text of the job description.'),
});

const JobMatchOutputSchema = z.object({
  matchScore: z.number().min(0).max(100).describe('A score from 0-100 indicating how well the candidate matches the job.'),
  reasoning: z.string().describe('A detailed explanation of the match score, highlighting strengths and weaknesses.'),
});

export const jobMatchingFlow = defineFlow(
  {
    name: 'jobMatchingFlow',
    inputSchema: JobMatchInputSchema,
    outputSchema: JobMatchOutputSchema,
  },
  async ({ userId, jobDescription }) => {
    const docRef = `/users/${userId}/resumeAnalysis/latest`;
    const analysisDoc = await firebase.firestore().doc(docRef).get();
    if (!analysisDoc.exists) {
      throw new Error(`No resume analysis found for user ${userId}. Please run analyzeAndStoreResumeFlow first.`);
    }
    const userSkills = analysisDoc.data()?.skills || [];
    const prompt = `Evaluate how well a candidate with the following skills matches the provided job description. Provide a match score from 0-100 and a detailed reasoning.\n\nCandidate Skills: ${userSkills.join(', ')}\n\nJob Description:\n---\n${jobDescription}\n---
    `;
    const llmResponse = await geminiPro.generate({ prompt: prompt, output: { schema: JobMatchOutputSchema } });
    return llmResponse.output()!;
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
    name: 'recommendedJobsFlow',
    inputSchema: z.string().describe('The user ID to generate recommendations for.'),
    outputSchema: z.array(RecommendedJobSchema),
  },
  async (userId) => {
    // 1. Get all jobs from Firestore
    const jobsSnapshot = await firebase.firestore().collection('jobs').get();
    if (jobsSnapshot.empty) {
      return [];
    }

    // 2. Run the matching flow for each job in parallel
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

    // 3. Sort by match score and return the top 5
    return allMatches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  }
);

// --- Database Seeding --- //
export const seedJobsFlow = defineFlow(
  { name: 'seedJobsFlow', outputSchema: z.string() },
  async () => {
    const jobs = [
      { title: 'Senior Frontend Engineer (React)', company: 'InnovateTech', location: 'Remote', description: '...' },
      { title: 'Backend Developer (Node.js)', company: 'DataCorp', location: 'Hybrid', description: '...' },
      { title: 'UX/UI Designer', company: 'CreativeMinds', location: 'On-site', description: '...' },
    ];
    const jobsCollection = firebase.firestore().collection('jobs');
    const promises = jobs.map(job => jobsCollection.add(job));
    await Promise.all(promises);
    return `Seeded ${jobs.length} jobs.`;
  }
);

// Start the flows server
startFlows();
