export class URAI_Error extends Error {
  code?: string;
  category?: string;

  constructor(codeOrMessage: string, category?: string, message?: string) {
    super(message ?? codeOrMessage);
    this.code = message ? codeOrMessage : undefined;
    this.category = category;
  }
}

export function httpsError(code: string, message: string, details?: any) {
  void code;
  void details;
  return new URAI_Error(message, 'HTTP', message);
}

export function logError(error: unknown) {
  console.error(error);
}
