import { randomUUID } from 'node:crypto';
import { initializeMarketplaceAdminRuntime } from './firebase-admin-runtime';

export const createSignedUploadRuntime = () => {
  const runtime = initializeMarketplaceAdminRuntime();
  const bucket = runtime.storage.bucket();

  return {
    async createResumeUpload(input: {
      candidateUid: string;
      contentType: string;
    }) {
      const uploadId = randomUUID();
      const path = `marketplace/resumes/${input.candidateUid}/${uploadId}`;

      const [signedUrl] = await bucket.file(path).getSignedUrl({
        action: 'write',
        expires: Date.now() + 1000 * 60 * 15,
        contentType: input.contentType,
        version: 'v4',
      });

      return {
        ok: true,
        uploadId,
        path,
        signedUrl,
        expiresInMinutes: 15,
      };
    },
  };
};
