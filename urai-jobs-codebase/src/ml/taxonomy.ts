import * as taxonomy from './skills-taxonomy.json';

const skillMap = new Map<string, string>();
for (const [standard, synonyms] of Object.entries(taxonomy)) {
  skillMap.set(standard, standard);
  for (const synonym of synonyms) {
    skillMap.set(synonym, standard);
  }
}

export function normalizeSkill(token: string): string | undefined {
  return skillMap.get(token.toLowerCase());
}

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