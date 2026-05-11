const EVENT_PREFIX = "jobs_";
const BUFFER_KEY = "urai_jobs_analytics_buffer";
function normalizeEventName(name) {
    const clean = name.trim().replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
    return clean.startsWith(EVENT_PREFIX) ? clean : `${EVENT_PREFIX}${clean}`;
}
function readBuffer() {
    try {
        const raw = window.localStorage.getItem(BUFFER_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(-100) : [];
    }
    catch {
        return [];
    }
}
function writeBuffer(events) {
    try {
        window.localStorage.setItem(BUFFER_KEY, JSON.stringify(events.slice(-100)));
    }
    catch {
        // localStorage can be unavailable in private or restricted contexts.
    }
}
export function trackJobsEvent(name, properties = {}) {
    const event = {
        name: normalizeEventName(name),
        properties,
        createdAt: new Date().toISOString()
    };
    if (typeof window === "undefined")
        return;
    window.dispatchEvent(new CustomEvent("urai-jobs:analytics", { detail: event }));
    window.dataLayer?.push({ event: event.name, ...event.properties });
    writeBuffer([...readBuffer(), event]);
}
export function flushJobsAnalyticsBuffer() {
    const events = readBuffer();
    writeBuffer([]);
    return events;
}
if (typeof window !== "undefined") {
    window.uraiJobsAnalytics = {
        track: trackJobsEvent,
        flushBuffer: flushJobsAnalyticsBuffer
    };
}
