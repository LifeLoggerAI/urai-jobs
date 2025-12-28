import * as taxonomyData from "./skills-taxonomy.json";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import {getFirebaseStorage} from "@genkit-ai/firebase/storage";

// Handle cases where the JSON is imported with a `default` property
const taxonomy = (taxonomyData as any).default || taxonomyData;

const skillMap = new Map<string, string>();
for (const [standard, synonyms] of Object.entries(taxonomy)) {
  skillMap.set(standard, standard);
  if (Array.isArray(synonyms)) {
    for (const synonym of synonyms) {
      skillMap.set(synonym, standard);
    }
  }
}

/**
 * Normalizes a skill token to its canonical form.
 * @param {string} token The skill token to normalize.
 * @return {string | undefined} The canonical skill name or undefined.
 */
export function normalizeSkill(token: string): string | undefined {
  return skillMap.get(token.toLowerCase());
}

/**
 * Extracts a list of unique, normalized skills from a block of text.
 * @param {string} text The text to extract skills from.
 * @return {string[]} An array of unique, normalized skill strings.
 */
export function extractSkills(text: string): string[] {
  const found = new Set<string>();
  for (const token of text.split(/\s+/)) {
    const normalized = normalizeSkill(token);
    if (normalized) {
      found.add(normalized);
    }
  }
  return Array.from(found);
}

/**
 * Reads a file from Firebase Storage and returns its text content.
 * Supports PDF, DOCX, and TXT file formats.
 * @param {string} storagePath The full GCS path to the file.
 * @return {Promise<string>} The text content of the file.
 */
export async function readFileAsText(storagePath: string): Promise<string> {
  const file = getFirebaseStorage().bucket().file(storagePath);
  const [buffer] = await file.download();
  const extension = storagePath.split(".").pop()?.toLowerCase();

  let text = "";

  switch (extension) {
  case "pdf": {
    const pdfData = await pdfParse(buffer);
    text = pdfData.text;
    break;
  }
  case "docx": {
    const docxData = await mammoth.extractRawText({buffer});
    text = docxData.value;
    break;
  }
  case "txt": {
    text = buffer.toString();
    break;
  }
  default: {
    throw new Error(`Unsupported file type: ${extension}`);
  }
  }

  return text;
}
