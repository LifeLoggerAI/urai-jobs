import * as admin from 'firebase-admin';
const db = admin.firestore();
export const createLog = async (tenantId, level, source, event, message, context) => {
    try {
        await db.collection('logs').add({
            tenantId,
            level,
            source,
            event,
            message,
            context,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        console.error('Failed to create log:', error);
    }
};
