import type { User } from "firebase/auth";

export type AuthClaims = Record<string, unknown> | null;

export function claimRoles(claims: AuthClaims): string[] {
  if (!claims) return [];
  const rawRoles = claims.roles;
  const roles = Array.isArray(rawRoles) ? rawRoles.map((role) => String(role)) : [];
  const rawRole = claims.role;
  const role = typeof rawRole === "string" ? [rawRole] : [];
  return [...new Set([...role, ...roles])];
}

export function hasOperatorAccess(claims: AuthClaims): boolean {
  if (!claims) return false;
  const roles = claimRoles(claims);
  return roles.includes("admin") || roles.includes("operator") || claims.uraiJobsAdmin === true;
}

export function hasJobCreateAccess(user: User | null, claims: AuthClaims): boolean {
  if (!user || !claims) return false;
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
