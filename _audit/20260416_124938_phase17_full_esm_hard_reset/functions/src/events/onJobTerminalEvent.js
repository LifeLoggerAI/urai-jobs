"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onJobTerminalEvent = void 0;
const functions = __importStar(require("firebase-functions"));
const logging_1 = require("../core/logging");
exports.onJobTerminalEvent = functions.firestore
    .document('jobs/{jobId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const terminalStates = ['SUCCESS', 'FAILED', 'DEAD', 'CANCELLED'];
    if (!terminalStates.includes(before.status) && terminalStates.includes(after.status)) {
        // This is a terminal event, emit it!
        const eventPayload = {
            jobId: after.id,
            rootJobId: after.rootJobId,
            correlationId: after.correlationId,
            type: after.type,
            status: after.status,
            targetSystem: after.target?.system,
            tenantId: after.tenantId,
            progress: after.progress,
            resultRef: after.result?.resultId,
            errorCode: after.error?.code,
            emittedAt: new Date().toISOString(),
        };
        // TODO: Use a reliable event bus like Pub/Sub for fanning out events.
        // For now, we'll just log it.
        await (0, logging_1.createLog)(after.tenantId, 'INFO', 'TRIGGER', 'JobTerminalEvent', `Job ${after.id} reached terminal state: ${after.status}`, eventPayload);
    }
});
