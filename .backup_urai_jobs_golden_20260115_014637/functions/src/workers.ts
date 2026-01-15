import { sleep } from "./util";
import type { WorkerResult } from "./types";

async function doNoop(payload: any): Promise<WorkerResult> {
  const ms = Number(payload?.sleepMs || 10);
  if (Number.isFinite(ms) && ms > 0 && ms < 30000) await sleep(ms);
  return { ok: true, result: { ok: true } };
}

async function doWebhook(payload: any): Promise<WorkerResult> {
  const url = String(payload?.url || "");
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: { code: "bad_url" } };

  const method = String(payload?.method || "POST").toUpperCase();
  const body = payload?.body ?? null;
  const headers = Object.assign({ "content-type": "application/json" }, payload?.headers || {});
  const timeoutMsRaw = Number(payload?.timeoutMs || 15000);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 && timeoutMsRaw <= 60000 ? timeoutMsRaw : 15000;

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
      signal: ac.signal
    } as any);

    const txt = await r.text();
    clearTimeout(to);

    if (r.ok) return { ok: true, result: { status: r.status, body: txt.slice(0, 20000) } };
    return { ok: false, error: { code: "http_error", status: r.status, body: txt.slice(0, 20000) } };
  } catch (e: any) {
    clearTimeout(to);
    return { ok: false, error: { code: "fetch_failed", message: String(e?.message || e) } };
  }
}

export async function runWorker(type: string, payload: any): Promise<WorkerResult> {
  if (type === "noop") return doNoop(payload);
  if (type === "webhook") return doWebhook(payload);
  return { ok: false, error: { code: "unknown_type", type } };
}
