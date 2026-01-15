import crypto from "crypto";

export function nowMs(): number { return Date.now(); }

export function genId(prefix: string): string {
  const id = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${id}`;
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function parseJsonSafe(s: any, fallback: any) {
  if (s == null) return fallback;
  if (typeof s === "object") return s;
  try { return JSON.parse(String(s)); } catch { return fallback; }
}
