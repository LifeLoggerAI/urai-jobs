import type { User } from "firebase/auth";

export type AuthClaims = Record<string, unknown> | null;

export function claimRoles(claims: AuthClaims): string[] {
  if (!claims) return [];
  const roles = Array.isArray(claims.roles) ? claims.roles.map((role) => String(role)) : [];
  const role = typeof claims.role === "string" ? [claims.role] : [];
  return [...new Set([...role, ...roles])];
}

export function hasOperatorAccess(claims: AuthClaims): boolean {
  if (!claims) return false;
  const roles = claimRoles(claims);
  return roles.includes("admin") || roles.includes("operator") || claims.uraiJobsAdmin === true;
}

export function hasJobCreateAccess(user: User | null, claims: AuthClaims): boolean {
  if (!user) return false;
  if (hasOperatorAccess(claims)) return true;
  const roles = claimRoles(claims);
  return roles.includes("job_creator") || claims.uraiJobsCreate === true;
}

export function authStatusLabel(user: User | null, claims: AuthClaims): string {
  if (!user) return "signed-out";
  if (hasOperatorAccess(claims)) return "operator";
  if (hasJobCreateAccess(user, claims)) return "job-creator";
  return "signed-in-no-runtime-access";
}
