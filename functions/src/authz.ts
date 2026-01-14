import type { Request } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import { initAdmin } from "./admin";

export async function verifyBearer(req: Request): Promise<admin.auth.DecodedIdToken | null> {
  const h = String((req as any).headers?.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const tok = m[1];
  try {
    initAdmin();
    return await admin.auth().verifyIdToken(tok, true);
  } catch {
    return null;
  }
}

export function isAdminToken(t: any): boolean {
  return !!(t && t.admin === true);
}
