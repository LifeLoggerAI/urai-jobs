
import * as admin from 'firebase-admin';
import { RoleDoc, PermissionDoc, GlobalStateDoc, QueueConfigDoc, DeadletterStateDoc } from '../../types';

// Initialize Firebase Admin SDK
// Make sure to have the service account key file path in GOOGLE_APPLICATION_CREDENTIALS environment variable
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function seedRoles() {
  const roles: RoleDoc[] = [
    { id: 'admin', name: 'Administrator', system: true, permissions: ['*'], createdAt: new Date(), updatedAt: new Date() },
    { id: 'system', name: 'System', system: true, permissions: ['jobs.create', 'jobs.execute', 'jobs.progress.write', 'results.read.any', 'logs.read.any'], createdAt: new Date(), updatedAt: new Date() },
    { id: 'client', name: 'Client', system: false, permissions: ['jobs.create', 'jobs.read.own', 'jobs.cancel.own', 'results.read.own'], createdAt: new Date(), updatedAt: new Date() },
    { id: 'worker', name: 'Worker', system: true, permissions: ['jobs.execute', 'jobs.progress.write'], createdAt: new Date(), updatedAt: new Date() },
  ];

  const batch = db.batch();
  roles.forEach(role => {
    const docRef = db.collection('roles').doc(role.id);
    batch.set(docRef, role);
  });
  await batch.commit();
  console.log('Seeded roles collection.');
}

async function seedPermissions() {
    const permissions: PermissionDoc[] = [
        { id: 'jobs.create', description: 'Can create new jobs', category: 'JOBS' },
        { id: 'jobs.read.own', description: 'Can read own jobs', category: 'JOBS' },
        { id: 'jobs.read.any', description: 'Can read any jobs', category: 'JOBS' },
        { id: 'jobs.cancel.own', description: 'Can cancel own jobs', category: 'JOBS' },
        { id: 'jobs.cancel.any', description: 'Can cancel any jobs', category: 'JOBS' },
        { id: 'jobs.retry.deadletter', description: 'Can retry dead-lettered jobs', category: 'ADMIN' },
        { id: 'jobs.execute', description: 'Can execute a job (for workers)', category: 'JOBS' },
        { id: 'jobs.progress.write', description: 'Can write progress updates to a job', category: 'JOBS' },
        { id: 'results.read.own', description: 'Can read own job results', category: 'RESULTS' },
        { id: 'results.read.any', description: 'Can read any job results', category: 'RESULTS' },
        { id: 'logs.read.any', description: 'Can read any logs', category: 'LOGS' },
        { id: 'system.state.read', description: 'Can read system state', category: 'SYSTEM' },
        { id: 'system.state.write', description: 'Can write to system state', category: 'SYSTEM' },
    ];

    const batch = db.batch();
    permissions.forEach(perm => {
        const docRef = db.collection('permissions').doc(perm.id);
        batch.set(docRef, perm);
    });
    await batch.commit();
    console.log('Seeded permissions collection.');
}

async function seedSystemState() {
  const now = new Date();
  const globalState: GlobalStateDoc = {
    maintenanceMode: false,
    acceptedOrigins: [],
    minWorkerVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
  };

  const queueConfig: QueueConfigDoc = {
    queues: [
        { name: 'default', maxConcurrency: 10, defaultTimeoutSec: 300, backoffBaseSec: 30, backoffMaxSec: 3600, enabled: true },
        { name: 'render-queue', maxConcurrency: 5, defaultTimeoutSec: 3600, backoffBaseSec: 60, backoffMaxSec: 7200, enabled: true },
        { name: 'video-render-queue', maxConcurrency: 2, defaultTimeoutSec: 7200, backoffBaseSec: 120, backoffMaxSec: 14400, enabled: true },
        { name: 'ai-queue', maxConcurrency: 10, defaultTimeoutSec: 600, backoffBaseSec: 30, backoffMaxSec: 3600, enabled: true },
        { name: 'system-queue', maxConcurrency: 20, defaultTimeoutSec: 600, backoffBaseSec: 10, backoffMaxSec: 600, enabled: true },
    ],
    updatedAt: now,
  };

  const deadletterState: DeadletterStateDoc = {
    replayEnabled: false,
    maxReplayBatchSize: 100,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(db.collection('systemState').doc('global'), globalState);
  batch.set(db.collection('systemState').doc('queueConfig'), queueConfig);
  batch.set(db.collection('systemState').doc('deadletter'), deadletterState);
  batch.set(db.collection('systemState').doc('maintenance'), { active: false, message: '', updatedAt: now });
  batch.set(db.collection('systemState').doc('rateLimits'), { rules: [], updatedAt: now });

  await batch.commit();
  console.log('Seeded systemState collection.');
}


async function main() {
    console.log('Starting Firestore seed...');
    await seedRoles();
    await seedPermissions();
    await seedSystemState();
    console.log('Firestore seed complete.');
}

main().catch(err => console.error('Error seeding database:', err));
