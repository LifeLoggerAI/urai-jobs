export const assertBodyFields = (body: Record<string, unknown> | undefined, fields: string[]) => {
  if (!body || Object.keys(body).some(key => !fields.includes(key))) throw new Error('VALIDATION_FIELD_NOT_ALLOWED');
};

export const requireString = (body: Record<string, unknown> | undefined, key: string, max = 128): string => {
  const value = body?.[key];
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('VALIDATION_REQUIRED_STRING:' + key);
  return value.trim();
};

export const optionalString = (body: Record<string, unknown> | undefined, key: string, max = 512): string | undefined => {
  const value = body?.[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > max) throw new Error('VALIDATION_OPTIONAL_STRING:' + key);
  return value.trim();
};

export const employerNameInput = (body: Record<string, unknown>): string => {
  const canonical = body.orgName === undefined ? undefined : requireString(body, 'orgName', 256);
  const legacy = body.companyName === undefined ? undefined : requireString(body, 'companyName', 256);
  if (!canonical && !legacy) throw new Error('VALIDATION_REQUIRED_STRING:orgName');
  if (canonical && legacy && canonical !== legacy) throw new Error('VALIDATION_CONFLICTING_FIELD:employerName');
  return canonical ?? legacy!;
};

export const optionalBoolean = (body: Record<string, unknown> | undefined, key: string): boolean | undefined => {
  const value = body?.[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new Error('VALIDATION_OPTIONAL_BOOLEAN:' + key);
  return value;
};

export const requireRevision = (body: Record<string, unknown> | undefined, key: string): number => {
  const value = body?.[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('VALIDATION_REVISION:' + key);
  return value;
};

export const stringList = (body: Record<string, unknown> | undefined, key: string): string[] | undefined => {
  const value = body?.[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 40 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 256)) {
    throw new Error('VALIDATION_STRING_LIST:' + key);
  }
  return value.map(item => item.trim());
};

export const answersRecord = (body: Record<string, unknown> | undefined): Record<string, string> => {
  const value = body?.answers ?? {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 20) throw new Error('VALIDATION_ANSWERS');
  const result: Record<string, string> = {};
  for (const [key, answer] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(key) || typeof answer !== 'string' || answer.length > 4096) throw new Error('VALIDATION_ANSWERS');
    result[key] = answer;
  }
  return result;
};

export const privateResumePath = (value: string | undefined, uid: string): string | undefined => {
  if (value === undefined || value === '') return undefined;
  if (!value.startsWith('marketplace/resumes/' + uid + '/') || value.includes('..')
    || value.includes('\\') || !/^marketplace\/resumes\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error('RESUME_OWNER_REQUIRED');
  }
  return value;
};
