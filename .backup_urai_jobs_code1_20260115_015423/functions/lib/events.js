"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendEvent = appendEvent;
exports.audit = audit;
const admin_1 = require("./admin");
const util_1 = require("./util");
async function appendEvent(jobId, type, data) {
    const eid = (0, util_1.genId)("evt");
    await (0, admin_1.db)().doc(`jobs/${jobId}/events/${eid}`).set({
        type,
        data: data ?? null,
        createdAt: (0, admin_1.serverTimestamp)()
    }, { merge: true });
}
async function audit(actor, action, data) {
    const id = (0, util_1.genId)("audit");
    await (0, admin_1.db)().doc(`auditLogs/${id}`).set({
        actor: actor ?? null,
        action,
        data: data ?? null,
        createdAt: (0, admin_1.serverTimestamp)()
    }, { merge: true });
}
//# sourceMappingURL=events.js.map