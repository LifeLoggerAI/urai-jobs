"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URAI_Error = void 0;
exports.httpsError = httpsError;
exports.logError = logError;
class URAI_Error extends Error {
    constructor(code, type, message) {
        super(message);
        this.code = code;
        this.type = type;
    }
}
exports.URAI_Error = URAI_Error;
function httpsError(code, message) {
    return new URAI_Error(code, 'HTTP', message);
}
function logError(e) {
    console.error(e);
}
