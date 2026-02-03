"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditEvent = void 0;
const firebase_admin_1 = require("firebase-admin");
const jobs_1 = require("./types/jobs");
const db = (0, firebase_admin_1.firestore)();
const auditCollection = db.collection('jobAudit');
const writeAuditEvent = async (event) => {
    const validatedEvent = jobs_1.AuditEventSchema.parse(event);
    await auditCollection.doc(validatedEvent.eventId).set(validatedEvent);
};
exports.writeAuditEvent = writeAuditEvent;
//# sourceMappingURL=audit.js.map