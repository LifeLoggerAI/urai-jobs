import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createLifeMovieSourceRightsVerifier, type RightsBackend } from './lifeMovieSourceRightsVerifier.js';

/**
 * Jobs-side Firebase adapter for reviewed server-owned source-rights records.
 * This adapter does not mint or approve rights. It relies on a separately
 * trusted issuer to populate the denied-by-default collection and an
 * authenticated owner-state verifier (Privacy deletion/Studio membership).
 * Neither dependency may be substituted with caller-provided metadata.
 */
export function createFirebaseLifeMovieSourceRightsVerifier(config: Readonly<{
  allowedBuckets: readonly string[];
  assertCurrentOwner: RightsBackend['assertCurrentOwner'];
  nowMs?: () => number;
}>) {
  if (!config || !Array.isArray(config.allowedBuckets) || config.allowedBuckets.length === 0 ||
      config.allowedBuckets.some((bucket) => typeof bucket !== 'string' ||
        !/^[a-z0-9][a-z0-9._-]{1,253}[a-z0-9]$/.test(bucket)) ||
      typeof config.assertCurrentOwner !== 'function') {
    throw new Error('life_movie_source_rights_unverified');
  }
  const db = getFirestore();
  const storage = getStorage();
  const dependencies: RightsBackend = {
    allowedBuckets: config.allowedBuckets,
    assertCurrentOwner: config.assertCurrentOwner,
    nowMs: config.nowMs,
    async readRightsRecord(id) {
      const snapshot = await db.collection('lifeMovieSourceRights').doc(id).get();
      return snapshot.exists ? (snapshot.data() as Record<string, unknown> | undefined) ?? null : null;
    },
    async currentObject(bucket, objectPath) {
      const [metadata] = await storage.bucket(bucket).file(objectPath).getMetadata();
      return metadata as Record<string, unknown>;
    },
    async selectedGeneration(bucket, objectPath, generation) {
      const [metadata] = await storage.bucket(bucket)
        .file(objectPath, { generation: Number(generation) }).getMetadata();
      return metadata as Record<string, unknown>;
    },
    async recordDecision(event) {
      // Audit event IDs are generated on the server. Persist before allowing
      // source admission; no private media paths or credentials are logged.
      await db.collection('lifeMovieSourceRightsDecisions').doc(event.id).create({
        ...event,
        action: 'life_movie_source_rights_preflight_verified',
        createdAt: FieldValue.serverTimestamp(),
      });
    },
  };
  return createLifeMovieSourceRightsVerifier(dependencies);
}
