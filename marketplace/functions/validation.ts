export const requireString = (
  body: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = body?.[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`VALIDATION_REQUIRED_STRING:${key}`);
  }

  return value.trim();
};

export const optionalString = (
  body: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = body?.[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`VALIDATION_OPTIONAL_STRING:${key}`);
  }

  return value.trim();
};

export const optionalBoolean = (
  body: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = body?.[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`VALIDATION_OPTIONAL_BOOLEAN:${key}`);
  }

  return value;
};
