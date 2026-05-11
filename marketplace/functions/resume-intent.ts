const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const createResumeUploadIntent = (input: {
  uid: string;
  mimeType: string;
  fileName: string;
}) => {
  if (!allowedMimeTypes.includes(input.mimeType)) {
    return {
      ok: false,
      code: 'INVALID_RESUME_MIME_TYPE',
      allowedMimeTypes,
    };
  }

  const sanitizedFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  return {
    ok: true,
    uploadPath: `marketplace/resumes/${input.uid}/${Date.now()}-${sanitizedFileName}`,
    allowedMimeTypes,
    maxSizeMb: 10,
    launchState: 'launch-gated',
  };
};
