// Syntactic screening only. This is NOT an authorization grant.
// Admin must separately authorize repository, branch, tools and caller.
// Reject Windows/POSIX path aliases before repository IDs reach an executor.
const PATTERN = /^LifeLoggerAI\/([A-Za-z0-9][A-Za-z0-9_.-]{1,89})$/;

export function isChalkRepositoryIdentity(value) {
  if (typeof value !== 'string') return false;
  const match = PATTERN.exec(value);
  if (!match) return false;
  const name = match[1];
  return !name.endsWith('.') && !name.toLowerCase().endsWith('.git');
}
