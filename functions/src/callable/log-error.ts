import * as functions from "firebase-functions";

interface LogData {
    message: string;
    data?: any;
    source: string; // e.g., 'callable.createResumeUpload', 'trigger.onApplicationCreate'
}

export const logError = functions.https.onCall(async (data: LogData, context) => {
    // In a real application, you might use a more sophisticated logging service
    // like Stackdriver Logging, Sentry, or another third-party service.
    // For this example, we'll just log to the Firebase Functions console with a specific format.
    
    const { message, data: logData, source } = data;

    if (!message || !source) {
        // Basic validation
        console.warn("Log entry is missing message or source.");
        return;
    }

    const logEntry = {
        severity: "ERROR",
        message,
        source,
        data: logData,
        context: {
            auth: context.auth ? { uid: context.auth.uid } : null,
        },
        timestamp: new Date().toISOString(),
    };

    console.error(JSON.stringify(logEntry));

    return { success: true };
});
