import { createHash } from 'node:crypto';

// JSON field order can change when Firestore persists map values. Canonicalize
// recursively before hashing so a real completed execution can replay safely.
function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, normalized(record[key])]));
  }
  return value;
}

export function canonicalDataRightsDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(normalized(value))).digest('hex');
}
