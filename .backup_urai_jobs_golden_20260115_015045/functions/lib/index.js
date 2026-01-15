"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledDailyDigest = exports.httpHealth = exports.adminSetApplicationStatus = exports.createResumeUploadUrl = exports.onApplicationCreate = exports.onJobWrite = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK. Must be done once.
admin.initializeApp();
// Export all functions from their individual files.
// Firestore Triggers
var onJobWrite_1 = require("./onJobWrite");
Object.defineProperty(exports, "onJobWrite", { enumerable: true, get: function () { return onJobWrite_1.onJobWrite; } });
var onApplicationCreate_1 = require("./onApplicationCreate");
Object.defineProperty(exports, "onApplicationCreate", { enumerable: true, get: function () { return onApplicationCreate_1.onApplicationCreate; } });
// Callable Functions
var createResumeUpload_1 = require("./createResumeUpload");
Object.defineProperty(exports, "createResumeUploadUrl", { enumerable: true, get: function () { return createResumeUpload_1.createResumeUploadUrl; } });
var adminSetApplicationStatus_1 = require("./adminSetApplicationStatus");
Object.defineProperty(exports, "adminSetApplicationStatus", { enumerable: true, get: function () { return adminSetApplicationStatus_1.adminSetApplicationStatus; } });
// HTTP and Scheduled Functions
var http_1 = require("./http");
Object.defineProperty(exports, "httpHealth", { enumerable: true, get: function () { return http_1.httpHealth; } });
Object.defineProperty(exports, "scheduledDailyDigest", { enumerable: true, get: function () { return http_1.scheduledDailyDigest; } });
//# sourceMappingURL=index.js.map