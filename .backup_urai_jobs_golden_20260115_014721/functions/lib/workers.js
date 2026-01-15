"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWorker = runWorker;
const util_1 = require("./util");
async function doNoop(payload) {
    const ms = Number(payload?.sleepMs || 10);
    if (Number.isFinite(ms) && ms > 0 && ms < 30000)
        await (0, util_1.sleep)(ms);
    return { ok: true, result: { ok: true } };
}
async function doWebhook(payload) {
    const url = String(payload?.url || "");
    if (!/^https?:\/\//i.test(url))
        return { ok: false, error: { code: "bad_url" } };
    const method = String(payload?.method || "POST").toUpperCase();
    const body = payload?.body ?? null;
    const headers = Object.assign({ "content-type": "application/json" }, payload?.headers || {});
    const timeoutMs = Number(payload?.timeoutMs || 15000);
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60000 ? timeoutMs : 15000);
    try {
        const r = await fetch(url, {
            method,
            headers,
            body: body == null ? undefined : (typeof body === "string" ? body : JSON.stringify(body)),
            signal: ac.signal
        });
        const txt = await r.text();
        clearTimeout(to);
        return { ok: r.ok, result: { status: r.status, body: txt.slice(0, 20000) } };
    }
    catch (e) {
        clearTimeout(to);
        return { ok: false, error: { code: "fetch_failed", message: String(e?.message || e) } };
    }
}
async function runWorker(type, payload) {
    if (type === "noop")
        return doNoop(payload);
    if (type === "webhook")
        return doWebhook(payload);
    return { ok: false, error: { code: "unknown_type", type } };
}
//# sourceMappingURL=workers.js.map