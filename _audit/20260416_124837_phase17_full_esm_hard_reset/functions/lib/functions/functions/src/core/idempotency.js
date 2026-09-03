import * as admin from 'firebase-admin';
const db = admin.firestore();
export const findJobByIdempotencyKey = async (tenantId, type, key) => {
    const snapshot = await db.collection('jobs')
        .where('tenantId', '==', tenantId)
        .where('type', '==', type)
        .where('idempotencyKey', '==', key)
        .limit(1)
        .get();
    if (snapshot.empty) {
        return null;
    }
    return snapshot.docs[0].data();
};
