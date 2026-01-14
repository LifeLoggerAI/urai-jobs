"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = void 0;
exports.initAdmin = initAdmin;
exports.db = db;
exports.tsFromMs = tsFromMs;
exports.serverTimestamp = serverTimestamp;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.admin = firebase_admin_1.default;
let _inited = false;
function initAdmin() {
    if (_inited)
        return;
    firebase_admin_1.default.initializeApp();
    _inited = true;
}
function db() {
    initAdmin();
    return firebase_admin_1.default.firestore();
}
function tsFromMs(ms) {
    initAdmin();
    return firebase_admin_1.default.firestore.Timestamp.fromMillis(ms);
}
function serverTimestamp() {
    initAdmin();
    return firebase_admin_1.default.firestore.FieldValue.serverTimestamp();
}
//# sourceMappingURL=admin.js.map