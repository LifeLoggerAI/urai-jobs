import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime.js';
import { marketplaceCollections } from './collections.js';
import type { MarketplaceAuthContext, MarketplaceConsent } from './auth.js';
import { assertCurrentMarketplaceActor, assertCurrentMarketplaceAuth, currentMarketplaceAuthBinding, assertCurrentMarketplaceConsent, assertTenant,
  parseConsent, readCurrentMarketplaceAccount, requireIdentifier, requireApplicationIdentifier } from './auth-runtime.js';
import { readOwnedEmployer, requireApprovedEmployer } from './ownership-runtime.js';

export type ApplicationStatus = 'submitted' | 'reviewing' | 'withdrawn' | 'rejected' | 'advanced';

export const createApplicationRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const db = runtime.firestore;

  const admitCandidate = async (transaction: Transaction, data: Record<string, unknown>, tenantId: string) => {
    const uid = requireIdentifier(data.candidateUid, 'candidateUid');
    const authBinding = await currentMarketplaceAuthBinding(uid);
    const account = await transaction.get(db.collection('users').doc(uid));
    if (readCurrentMarketplaceAccount(uid, account.exists ? account.data() : undefined).tenantId !== tenantId) {
      throw new Error('TENANT_MISMATCH');
    }
    const profile = await transaction.get(db.collection(marketplaceCollections.candidateProfiles).doc(uid));
    if (!profile.exists) throw new Error('PROFILE_NOT_FOUND');
    const profileData = profile.data() || {};
    assertTenant(profileData, tenantId);
    await assertCurrentMarketplaceConsent(db, transaction, uid, parseConsent(profileData.consent, 'career.profile'));
    await assertCurrentMarketplaceConsent(db, transaction, uid, parseConsent(data.consent, 'career.application'));
    return async () => {
      if (authBinding !== await currentMarketplaceAuthBinding(uid)) throw new Error('ACCOUNT_AUTHORITY_CHANGED');
    };
  };

  return {
    async createApplication(actor: MarketplaceAuthContext, input: {
      jobId: string; employerId: string; profileRevision: number; resumePath?: string;
      answers: Record<string, string>; consentGranted: boolean; consent: MarketplaceConsent;
    }) {
      if (input.consentGranted !== true) throw new Error('CONSENT_REQUIRED');
      const consent = parseConsent(input.consent, 'career.application');
      const jobId = requireIdentifier(input.jobId, 'jobId');
      const employerId = requireIdentifier(input.employerId, 'employerId');
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const profile = await transaction.get(db.collection(marketplaceCollections.candidateProfiles).doc(current.uid));
        if (!profile.exists) throw new Error('PROFILE_NOT_FOUND');
        const profileData = profile.data() || {};
        assertTenant(profileData, current.tenantId);
        if (profileData.revision !== input.profileRevision) throw new Error('PROFILE_REVISION_CHANGED');
        await assertCurrentMarketplaceConsent(db, transaction, current.uid, parseConsent(profileData.consent, 'career.profile'));
        await assertCurrentMarketplaceConsent(db, transaction, current.uid, consent);
        const job = await transaction.get(db.collection(marketplaceCollections.publicJobs).doc(jobId));
        const jobData = job.data() || {};
        assertTenant(jobData, current.tenantId);
        if (!job.exists || jobData.status !== 'published' || jobData.moderationStatus !== 'approved') {
          throw new Error('JOB_NOT_PUBLISHED');
        }
        if (jobData.employerId !== employerId) throw new Error('EMPLOYER_MISMATCH');
        const employer = await transaction.get(db.collection(marketplaceCollections.employers).doc(employerId));
        assertTenant(employer.data(), current.tenantId);
        requireApprovedEmployer(employer.data() || {});
        const applicationId = 'application-' + createHash('sha256')
          .update(JSON.stringify([current.tenantId, current.uid, jobId])).digest('hex');
        const ref = db.collection(marketplaceCollections.jobApplications).doc(applicationId);
        const previous = await transaction.get(ref);
        // Retain duplicate protection for previously written legacy IDs too.
        const legacy = await transaction.get(db.collection(marketplaceCollections.jobApplications)
          .doc(current.uid + ':' + jobId));
        if (previous.exists || legacy.exists) throw new Error('DUPLICATE_APPLICATION');
        await assertCurrentMarketplaceAuth(actor);
        const now = FieldValue.serverTimestamp();
        transaction.create(ref, { id: applicationId, tenantId: current.tenantId,
          candidateUid: current.uid, jobId, employerId, status: 'submitted',
          resumePath: input.resumePath ?? null, answers: input.answers,
          profileRevision: input.profileRevision, consent,
          candidateSnapshot: { displayName: profileData.displayName, email: profileData.email ?? null,
            location: profileData.location ?? '', skills: profileData.skills ?? [] },
          createdAt: now, updatedAt: now });
        return { ok: true, applicationId, status: 'submitted' };
      });
    },

    async listByCandidate(actor: MarketplaceAuthContext) {
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const snapshot = await transaction.get(db.collection(marketplaceCollections.jobApplications)
          .where('candidateUid', '==', current.uid).where('tenantId', '==', current.tenantId).limit(50));
        const finalCandidateChecks: (() => Promise<void>)[] = [];
        const result: Record<string, unknown>[] = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (data.status === 'withdrawn') {
            // A stop receipt remains visible without re-disclosing a revoked snapshot.
            result.push({ id: doc.id, jobId: data.jobId, employerId: data.employerId, status: 'withdrawn' });
          } else {
            finalCandidateChecks.push(await admitCandidate(transaction, data, current.tenantId));
            result.push({ ...data, id: doc.id });
          }
        }
        for (const check of finalCandidateChecks) await check();
        await assertCurrentMarketplaceAuth(actor);
        return result;
      });
    },

    async listByEmployer(actor: MarketplaceAuthContext, employerId: string) {
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        requireApprovedEmployer(await readOwnedEmployer(db, transaction, employerId, current));
        const snapshot = await transaction.get(db.collection(marketplaceCollections.jobApplications)
          .where('employerId', '==', employerId).where('tenantId', '==', current.tenantId).limit(100));
        const result: Record<string, unknown>[] = [];
        const finalCandidateChecks: (() => Promise<void>)[] = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (data.status === 'withdrawn') continue;
          finalCandidateChecks.push(await admitCandidate(transaction, data, current.tenantId));
          result.push({ ...data, id: doc.id });
        }
        for (const check of finalCandidateChecks) await check();
        await assertCurrentMarketplaceAuth(actor);
        return result;
      });
    },

    async withdrawApplication(actor: MarketplaceAuthContext, applicationId: string) {
      requireApplicationIdentifier(applicationId);
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        const ref = db.collection(marketplaceCollections.jobApplications).doc(applicationId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error('APPLICATION_NOT_FOUND');
        const data = snapshot.data() || {};
        assertTenant(data, current.tenantId);
        if (data.candidateUid !== current.uid) throw new Error('APPLICATION_OWNER_REQUIRED');
        await assertCurrentMarketplaceAuth(actor);
        if (data.status === 'withdrawn') return { ok: true, applicationId, status: 'withdrawn' };
        if (!['submitted', 'reviewing'].includes(String(data.status))) throw new Error('APPLICATION_NOT_PENDING');
        // Withdrawal remains available after consent revocation; it can only stop work.
        transaction.update(ref, { status: 'withdrawn', withdrawnAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp() });
        return { ok: true, applicationId, status: 'withdrawn' };
      });
    },

    async updateApplicationStatus(actor: MarketplaceAuthContext, input: {
      employerId: string; applicationId: string; status: ApplicationStatus; note?: string;
    }) {
      requireApplicationIdentifier(input.applicationId);
      if (!['reviewing', 'rejected', 'advanced'].includes(input.status)) throw new Error('APPLICATION_STATUS_INVALID');
      return db.runTransaction(async transaction => {
        const current = await assertCurrentMarketplaceActor(db, transaction, actor);
        requireApprovedEmployer(await readOwnedEmployer(db, transaction, input.employerId, current));
        const ref = db.collection(marketplaceCollections.jobApplications).doc(input.applicationId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error('APPLICATION_NOT_FOUND');
        const data = snapshot.data() || {};
        assertTenant(data, current.tenantId);
        if (data.employerId !== input.employerId) throw new Error('EMPLOYER_MISMATCH');
        if (!['submitted', 'reviewing'].includes(String(data.status))) throw new Error('APPLICATION_NOT_REVIEWABLE');
        const finalCandidateCheck = await admitCandidate(transaction, data, current.tenantId);
        const job = await transaction.get(db.collection(marketplaceCollections.publicJobs).doc(String(data.jobId)));
        const jobData = job.data() || {};
        assertTenant(jobData, current.tenantId);
        if (jobData.status !== 'published' || jobData.moderationStatus !== 'approved') throw new Error('JOB_NOT_PUBLISHED');
        if (jobData.employerId !== input.employerId) throw new Error('EMPLOYER_MISMATCH');
        await finalCandidateCheck();
        await assertCurrentMarketplaceAuth(actor);
        const auditRef = db.collection(marketplaceCollections.auditLogs).doc();
        const now = FieldValue.serverTimestamp();
        transaction.update(ref, { status: input.status, employerNote: input.note ?? null,
          reviewedBy: current.uid, updatedAt: now });
        transaction.create(auditRef, { actorUid: current.uid, tenantId: current.tenantId,
          action: 'application.status_updated', targetId: input.applicationId,
          metadata: { employerId: input.employerId, status: input.status }, createdAt: now });
        return { ok: true, applicationId: input.applicationId, status: input.status };
      });
    },
  };
};
