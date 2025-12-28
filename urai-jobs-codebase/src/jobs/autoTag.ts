import { geminiPro } from "@genkit-ai/googleai";
import { generate } from '@genkit-ai/ai';
import { extractSkills } from "../ml/taxonomy";
import * as z from "zod";

/**
 * Represents the salary information for a job.
 */
const SalarySchema = z.object({
  min: z.number(),
  max: z.number(),
  currency: z.string(),
});

/**
 * Represents the response from the LLM.
 */
const LLMResponseSchema = z.object({
  tags: z.array(z.string()).describe("A list of key technical and soft skills extracted from the job description."),
  seniority: z.string().describe("The seniority of the role (e.g., junior, senior, lead)"),
  salary: SalarySchema.describe("The estimated salary range for the role."),
  employmentType: z.string().describe("The employment type (e.g., full-time, contract)"),
});
type LLMResponse = z.infer<typeof LLMResponseSchema>;


/**
 * Calls the Gemini 1.0 Pro model to extract structured data from a job description.
 * @param {string} prompt The prompt to send to the LLM.
 * @return {Promise<LLMResponse>} The response from the LLM.
 */
async function callLLM(prompt: string): Promise<LLMResponse> {
  const llmResponse = await generate({
    model: geminiPro,
    prompt: prompt,
    output: { schema: LLMResponseSchema },
  });

  const output = llmResponse.output();
  if (!output) {
    throw new Error("LLM response did not contain valid output.");
  }
  return output;
}

/**
 * Automatically tags a job description with relevant information.
 * @param {string} jobDescription The job description to tag.
 * @return {Promise<LLMResponse>} The tagged job information.
 */
export async function autoTagJob(jobDescription: string): Promise<LLMResponse> {
  const prompt =
    `Extract the following information from this job description:\n\n` +
    `${jobDescription}\n\n` +
    "- Skills (as an array of strings)\n" +
    "- Seniority (e.g., junior, senior, lead)\n" +
    "- Salary (min, max, currency)\n" +
    "- Employment Type (e.g., full-time, contract)\n\n" +
    "Return the result as a JSON object.";

  const llmResult = await callLLM(prompt);
  // The 'extractSkills' function from taxonomy.ts is a simple placeholder.
  // In a real-world scenario, you might have a more robust taxonomy or
  // even use another LLM call to get a more comprehensive skill list.
  const extractedSkills = extractSkills(jobDescription);

  // Combine the tags from the LLM with the ones from the keyword extraction.
  const combinedTags = new Set([...llmResult.tags, ...extractedSkills]);

  return {
    ...llmResult,
    tags: Array.from(combinedTags),
  };
}
