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
const vitest_1 = require("vitest");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions-test"));
const https_1 = require("firebase-functions/v1/https");
// Initialize the Firebase Test SDK
const testEnv = functions();
// Import the functions to be tested
const index_1 = require("../src/index");
(0, vitest_1.describe)('Cloud Functions', () => {
    let wrappedCreateJob;
    let wrappedEnqueueRun;
    (0, vitest_1.beforeAll)(() => {
        // Wrap the functions
        wrappedCreateJob = testEnv.wrap(index_1.createJob);
        wrappedEnqueueRun = testEnv.wrap(index_1.enqueueRun);
    });
    (0, vitest_1.describe)('createJob', () => {
        (0, vitest_1.it)('should create a new job', async () => {
            var _a;
            const data = {
                name: 'Test Job',
                description: 'This is a test job',
                handler: 'noop',
            };
            const context = {
                auth: {
                    uid: 'admin-uid',
                },
            };
            // Set the user's role to admin
            await admin.firestore().collection('users').doc('admin-uid').set({ role: 'admin' });
            const result = await wrappedCreateJob(data, context);
            (0, vitest_1.expect)(result.id).toBeDefined();
            const job = await admin.firestore().collection('jobs').doc(result.id).get();
            (0, vitest_1.expect)(job.exists).toBe(true);
            (0, vitest_1.expect)((_a = job.data()) === null || _a === void 0 ? void 0 : _a.name).toBe('Test Job');
        });
        (0, vitest_1.it)('should not allow a non-admin to create a job', async () => {
            const data = {
                name: 'Test Job',
                description: 'This is a test job',
                handler: 'noop',
            };
            const context = {
                auth: {
                    uid: 'user-uid',
                },
            };
            // Set the user's role to viewer
            await admin.firestore().collection('users').doc('user-uid').set({ role: 'viewer' });
            await (0, vitest_1.expect)(wrappedCreateJob(data, context)).rejects.toThrow(https_1.HttpsError);
        });
    });
    (0, vitest_1.describe)('enqueueRun', () => {
        (0, vitest_1.it)('should enqueue a new run', async () => {
            var _a;
            const jobData = {
                name: 'Test Job',
                description: 'This is a test job',
                handler: 'noop',
                createdBy: 'admin-uid',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            const job = await admin.firestore().collection('jobs').add(jobData);
            const data = {
                jobId: job.id,
            };
            const context = {
                auth: {
                    uid: 'operator-uid',
                },
            };
            // Set the user's role to operator
            await admin.firestore().collection('users').doc('operator-uid').set({ role: 'operator' });
            const result = await wrappedEnqueueRun(data, context);
            (0, vitest_1.expect)(result.runId).toBeDefined();
            const run = await admin.firestore().collection('jobRuns').doc(result.runId).get();
            (0, vitest_1.expect)(run.exists).toBe(true);
            (0, vitest_1.expect)((_a = run.data()) === null || _a === void 0 ? void 0 : _a.jobId).toBe(job.id);
        });
    });
});
//# sourceMappingURL=index.test.js.map