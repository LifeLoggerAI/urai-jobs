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
const admin = __importStar(require("firebase-admin"));
// Initialize admin SDK
admin.initializeApp();
const db = admin.firestore();
async function bootstrap() {
    console.log('Seeding roles...');
    await db.collection('roles').doc('admin').set({ permissions: ['*'] });
    await db.collection('roles').doc('system').set({ permissions: ['jobs.read.any', 'system.state.read'] });
    await db.collection('roles').doc('client').set({ permissions: ['jobs.create', 'jobs.read.own', 'jobs.cancel.own'] });
    await db.collection('roles').doc('worker').set({ permissions: ['jobs.execute', 'jobs.progress.write'] });
    console.log('Roles seeded.');
    console.log('Seeding permissions...');
    // In a real system, you might want to break these down further
    await db.collection('permissions').doc('jobs.create').set({ description: 'Allows creating new jobs.' });
    await db.collection('permissions').doc('jobs.read.own').set({ description: 'Allows reading own jobs.' });
    await db.collection('permissions').doc('jobs.read.any').set({ description: 'Allows reading any jobs.' });
    await db.collection('permissions').doc('jobs.cancel.own').set({ description: 'Allows cancelling own jobs.' });
    await db.collection('permissions').doc('jobs.cancel.any').set({ description: 'Allows cancelling any jobs.' });
    await db.collection('permissions').doc('jobs.retry.deadletter').set({ description: 'Allows retrying dead-lettered jobs.' });
    await db.collection('permissions').doc('jobs.execute').set({ description: 'Allows executing a job.' });
    await db.collection('permissions').doc('jobs.progress.write').set({ description: 'Allows writing progress to a job.' });
    await db.collection('permissions').doc('results.read.own').set({ description: 'Allows reading own job results.' });
    await db.collection('permissions').doc('results.read.any').set({ description: 'Allows reading any job results.' });
    await db.collection('permissions').doc('logs.read.any').set({ description: 'Allows reading any logs.' });
    await db.collection('permissions').doc('system.state.read').set({ description: 'Allows reading system state.' });
    await db.collection('permissions').doc('system.state.write').set({ description: 'Allows writing to system state.' });
    console.log('Permissions seeded.');
    console.log('Seeding systemState...');
    await db.collection('systemState').doc('global').set({ version: 1, maintenanceMode: false });
    await db.collection('systemState').doc('queueConfig').set({
        'spatial-queue': { enabled: true, maxConcurrency: 100 },
        'studio-queue': { enabled: true, maxConcurrency: 50 },
        'narrator-queue': { enabled: true, maxConcurrency: 200 },
        'asset-queue': { enabled: true, maxConcurrency: 500 },
        'system-queue': { enabled: true, maxConcurrency: 10 }
    });
    await db.collection('systemState').doc('deadletter').set({ maxRetries: 3, strategy: 'exponential_backoff' });
    console.log('systemState seeded.');
}
bootstrap().catch(err => console.error('Bootstrap failed:', err));
