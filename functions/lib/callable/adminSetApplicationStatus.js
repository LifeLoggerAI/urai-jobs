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
exports.adminSetApplicationStatus = void 0;
const functions = __importStar(require("firebase-functions"));
const firebase_1 = require("../lib/firebase");
exports.adminSetApplicationStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.token.admin) {
        throw new functions.https.HttpsError("permission-denied", "You must be an admin to perform this action.");
    }
    const { applicationId, status, tags, rating } = data;
    const applicationRef = firebase_1.firestore
        .collection("applications")
        .doc(applicationId);
    await applicationRef.update({
        status,
        tags,
        "internal.rating": rating,
        "internal.reviewerId": context.auth.uid,
        "internal.reviewedAt": new Date(),
    });
    await firebase_1.firestore.collection("events").add({
        type: "status_changed",
        entityType: "application",
        entityId: applicationId,
        metadata: { newStatus: status, reviewerId: context.auth.uid },
        createdAt: new Date(),
    });
});
//# sourceMappingURL=adminSetApplicationStatus.js.map