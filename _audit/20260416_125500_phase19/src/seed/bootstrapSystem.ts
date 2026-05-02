import * as admin from 'firebase-admin';

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
