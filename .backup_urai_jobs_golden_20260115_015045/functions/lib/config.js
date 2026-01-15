"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.region = region;
exports.leaseSeconds = leaseSeconds;
exports.maxLeaseBatch = maxLeaseBatch;
exports.concurrencyByType = concurrencyByType;
exports.backoffCapSeconds = backoffCapSeconds;
const util_1 = require("./util");
function region() {
    return process.env.JOBS_REGION || "us-central1";
}
function leaseSeconds() {
    const v = Number(process.env.JOBS_LEASE_SECONDS || "90");
    return Number.isFinite(v) && v >= 30 && v <= 600 ? v : 90;
}
function maxLeaseBatch() {
    const v = Number(process.env.JOBS_LEASE_BATCH || "10");
    return Number.isFinite(v) && v >= 1 && v <= 50 ? v : 10;
}
function concurrencyByType() {
    const raw = process.env.JOBS_CONCURRENCY_JSON || "";
    const obj = (0, util_1.parseJsonSafe)(raw, {});
    const out = {};
    if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 1 && n <= 50)
                out[k] = n;
        }
    }
    out["default"] = out["default"] || 3;
    out["noop"] = out["noop"] || 10;
    out["webhook"] = out["webhook"] || 3;
    return out;
}
function backoffCapSeconds() {
    const v = Number(process.env.JOBS_BACKOFF_CAP_SECONDS || "900");
    return Number.isFinite(v) && v >= 30 && v <= 86400 ? v : 900;
}
//# sourceMappingURL=config.js.map