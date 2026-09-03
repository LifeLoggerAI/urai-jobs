"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URAI_Error = void 0;
exports.httpsError = httpsError;
exports.logError = logError;
class URAI_Error extends Error {
    constructor(codeOrMessage, category, message) {
        super(message ?? codeOrMessage);
        this.code = message ? codeOrMessage : undefined;
        this.category = category;
    }
}
exports.URAI_Error = URAI_Error;
function httpsError(code, message, details) {
    void code;
    void details;
    return new URAI_Error(message, 'HTTP', message);
}
function logError(error) {
    console.error(error);
}
