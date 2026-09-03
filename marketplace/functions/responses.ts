export const ok = <T extends Record<string, unknown>>(payload: T) => ({
  ok: true,
  ...payload,
});

export const fail = (code: string, message?: string, status = 400) => ({
  ok: false,
  status,
  code,
  message: message ?? code,
  requestId: `marketplace-${Date.now()}`,
});

export const fromError = (error: unknown) => {
  if (error instanceof Error) {
    return fail(error.message, error.message);
  }

  return fail('UNKNOWN_MARKETPLACE_ERROR');
};
