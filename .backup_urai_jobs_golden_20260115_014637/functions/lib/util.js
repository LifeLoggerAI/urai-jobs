"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowMs = nowMs;
exports.genId = genId;
exports.clamp01 = clamp01;
exports.sleep = sleep;
exports.parseJsonSafe = parseJsonSafe;
const crypto_1 = __importDefault(require("crypto"));
function nowMs() { return Date.now(); }
function genId(prefix) {
    const id = crypto_1.default.randomUUID().replace(/-/g, "");
    return `${prefix}_${id}`;
}
function clamp01(n) {
    if (!Number.isFinite(n))
        return 0;
    if (n < 0)
        return 0;
    if (n > 1)
        return 1;
    return n;
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function parseJsonSafe(s, fallback) {
    if (s == null)
        return fallback;
    if (typeof s === "object")
        return s;
    try {
        return JSON.parse(String(s));
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=util.js.map