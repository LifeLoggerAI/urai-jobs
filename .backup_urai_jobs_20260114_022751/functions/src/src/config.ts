import { parseJsonSafe } from "./util";

export type ConcurrencyConfig = Record<string, number>;

export function region(): string {
  return process.env.JOBS_REGION || "us-central1";
}

export function leaseSeconds(): number {
  const v = Number(process.env.JOBS_LEASE_SECONDS || "90");
  return Number.isFinite(v) && v >= 30 && v <= 600 ? v : 90;
}

export function maxLeaseBatch(): number {
  const v = Number(process.env.JOBS_LEASE_BATCH || "10");
  return Number.isFinite(v) && v >= 1 && v <= 50 ? v : 10;
}

export function concurrencyByType(): ConcurrencyConfig {
  const raw = process.env.JOBS_CONCURRENCY_JSON || "";
  const obj = parseJsonSafe(raw, {});
  const out: ConcurrencyConfig = {};
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 1 && n <= 50) out[k] = n;
    }
  }
  out["default"] = out["default"] || 3;
  out["noop"] = out["noop"] || 10;
  out["webhook"] = out["webhook"] || 3;
  return out;
}

export function backoffCapSeconds(): number {
  const v = Number(process.env.JOBS_BACKOFF_CAP_SECONDS || "900");
  return Number.isFinite(v) && v >= 30 && v <= 86400 ? v : 900;
}
