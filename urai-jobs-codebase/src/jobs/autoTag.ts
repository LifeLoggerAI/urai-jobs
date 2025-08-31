import { extractSkills } from './taxonomy';

// Placeholder for a real LLM call
async function callLLM(prompt: string): Promise<any> {
  return {
    tags: ["react", "typescript", "nodejs"],
    seniority: "senior",
    salary: {
      min: 120000,
      max: 180000,
      currency: "USD"
    },
    employmentType: "full-time"
  };
}

export async function autoTagJob(jobDescription: string): Promise<any> {
  const prompt = `Extract the following information from this job description:\n\n${jobDescription}\n\n- Skills (as an array of strings)\n- Seniority (e.g., junior, senior, lead)\n- Salary (min, max, currency)\n- Employment Type (e.g., full-time, contract)\n\nReturn the result as a JSON object.`;

  const llmResult = await callLLM(prompt);
  const extractedSkills = extractSkills(jobDescription);

  return {
    ...llmResult,
    tags: Array.from(new Set([...llmResult.tags, ...extractedSkills]))
  };
}