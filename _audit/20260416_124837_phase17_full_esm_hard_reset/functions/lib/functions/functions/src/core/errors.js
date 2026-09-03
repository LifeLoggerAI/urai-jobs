export class URAI_Error extends Error {
    constructor(codeOrMessage, category, message) {
        super(message ?? codeOrMessage);
        this.code = message ? codeOrMessage : undefined;
        this.category = category;
    }
}
export function httpsError(code, message, details) {
    void code;
    void details;
    return new URAI_Error(message, 'HTTP', message);
}
export function logError(error) {
    console.error(error);
}
