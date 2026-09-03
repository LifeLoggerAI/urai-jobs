import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { firebaseConfig } from "./firebaseConfig.generated";
const apiKey = String(firebaseConfig.apiKey || "");
if (!apiKey || apiKey === "demo-api-key") {
    throw new Error("URAI Jobs Firebase web config is missing a valid apiKey.");
}
export function getFirebaseApp() {
    return getApps()[0] || initializeApp(firebaseConfig);
}
export const firebaseApp = getFirebaseApp();
export const auth = getAuth(firebaseApp);
export const functions = getFunctions(firebaseApp, "us-central1");
