import { createResumeUploadIntent } from './resume-intent.js';
import type { MarketplaceAuthContext } from './auth.js';
import { requireSignedIn } from './auth.js';

export const createSignedResumeUpload = (
  auth: MarketplaceAuthContext,
  input: {
    mimeType: string;
    fileName: string;
  },
) => {
  const uid = requireSignedIn(auth);

  const intent = createResumeUploadIntent({
    uid,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });

  if (!intent.ok) {
    return intent;
  }

  return {
    ok: true,
    upload: {
      method: 'PUT',
      uploadPath: intent.uploadPath,
      expiresInMinutes: 15,
      state: 'signed-upload-scaffolded',
    },
    launchState: 'launch-gated',
  };
};
