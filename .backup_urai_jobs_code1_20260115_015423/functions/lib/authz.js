"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyBearer = verifyBearer;
exports.isAdminToken = isAdminToken;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const admin_1 = require("./admin");
async function verifyBearer(req) {
    const h = String(req.headers?.authorization || "");
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m)
        return null;
    const tok = m[1];
    try {
        (0, admin_1.initAdmin)();
        return await firebase_admin_1.default.auth().verifyIdToken(tok, true);
    }
    catch {
        return null;
    }
}
function isAdminToken(t) {
    return !!(t && t.admin === true);
}
//# sourceMappingURL=authz.js.map