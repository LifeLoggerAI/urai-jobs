// Nonproduction review intake may use only local Firebase services for one
// dedicated fictional project. Never trust a single emulator flag in isolation.
const DEMO_PROJECT = 'demo-urai-auth-journey';
const SOURCE_SHA = /^[a-f0-9]{40}$/;
const fail = (reason: string): never => { throw Error('CHALK_INTAKE_ISOLATION_' + reason); };

type Environment = Readonly<Record<string, string | undefined>>;

export function requireChalkIntakeIsolation(env: Environment): string {
  if (env.FUNCTIONS_EMULATOR !== 'true' ||
      env.URAI_CHALK_INTAKE_ENABLED !== 'true' ||
      ['prod', 'production', 'staging'].includes((env.URAI_ENV || '').toLowerCase())) fail('DISABLED');

  // The supported test harness uses the same loopback services as the
  // isolated UrAi journey. An unset value could contact real Firebase.
  if (env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
      env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') fail('SERVICES');

  const projectKeys = ['GCLOUD_PROJECT', 'GCP_PROJECT', 'GOOGLE_CLOUD_PROJECT'] as const;
  const projects = projectKeys.map(key => env[key]).filter(Boolean);
  if (!projects.length || projects.some(project => project !== DEMO_PROJECT)) fail('PROJECT');
  if (env.FIREBASE_CONFIG !== undefined) {
    let configured: unknown;
    try { configured = JSON.parse(env.FIREBASE_CONFIG); }
    catch { fail('FIREBASE_CONFIG'); }
    if (!configured || typeof configured !== 'object' || Array.isArray(configured) ||
        (configured as Record<string, unknown>).projectId !== DEMO_PROJECT) fail('FIREBASE_CONFIG');
  }
  if (!SOURCE_SHA.test(env.URAI_CHALK_SPATIAL_SOURCE_SHA || '')) fail('SOURCE_SHA');
  return env.URAI_CHALK_SPATIAL_SOURCE_SHA!;
}
