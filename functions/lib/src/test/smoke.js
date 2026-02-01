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
const chai_1 = require("chai");
const admin = __importStar(require("firebase-admin"));
describe("Smoke Test", () => {
    let db;
    before(() => {
        // Initialize admin if not already initialized
        if (!admin.apps.length) {
            // This will use the emulator host if FIRESTORE_EMULATOR_HOST is set,
            // which is done automatically by `firebase emulators:exec`
            admin.initializeApp();
        }
        db = admin.firestore();
    });
    it("should create a job, which is then processed by a background function", async () => {
        const jobId = `smoke-test-${Date.now()}`;
        const jobRef = db.collection("jobs").doc(jobId);
        // 1. Create a document to trigger the background function
        await jobRef.set({
            jobType: "render",
            payload: { asset: "test.mp4" },
            status: "new",
            createdAt: new Date(),
            updatedAt: new Date()
        });
        // 2. Wait for a moment to allow the background function to trigger and complete
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // 3. Fetch the document again to see if it was processed
        const jobDoc = await jobRef.get();
        const job = jobDoc.data();
        // 4. Assert the final state
        if (!job) {
            throw new Error(`Job document '${jobId}' not found after execution.`);
        }
        // The function should have updated the status to 'completed'
        (0, chai_1.expect)(job.status).to.equal("completed");
        // The function should have created audit logs
        const auditLogs = await jobRef.collection("auditLogs").get();
        (0, chai_1.expect)(auditLogs.empty).to.be.false;
        (0, chai_1.expect)(auditLogs.docs.length).to.be.greaterThan(1);
    }).timeout(10000);
});
//# sourceMappingURL=smoke.js.map