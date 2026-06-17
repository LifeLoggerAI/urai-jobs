import { careerMirrorOpportunities, defaultWorkPreferenceProfile } from "./careerMirror";
const STORAGE_KEY = "urai.jobs.careerMirror.v1";
function isBrowserStorageAvailable() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}
export function createDefaultCareerMirrorState() {
    return {
        profile: defaultWorkPreferenceProfile,
        opportunities: careerMirrorOpportunities,
        selectedId: careerMirrorOpportunities[0]?.id ?? "",
        updatedAt: new Date().toISOString()
    };
}
export function loadCareerMirrorState() {
    const fallback = createDefaultCareerMirrorState();
    if (!isBrowserStorageAvailable())
        return fallback;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored)
            return fallback;
        const parsed = JSON.parse(stored);
        return {
            profile: parsed.profile ?? fallback.profile,
            opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : fallback.opportunities,
            selectedId: typeof parsed.selectedId === "string" ? parsed.selectedId : fallback.selectedId,
            updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt
        };
    }
    catch {
        return fallback;
    }
}
export function saveCareerMirrorState(state) {
    const next = { ...state, updatedAt: new Date().toISOString() };
    if (isBrowserStorageAvailable()) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return next;
}
export function resetCareerMirrorState() {
    if (isBrowserStorageAvailable()) {
        window.localStorage.removeItem(STORAGE_KEY);
    }
    return createDefaultCareerMirrorState();
}
