import * as admin from "firebase-admin";

admin.initializeApp();

// Import and export functions
export * from "./triggers";
export * from "./callables";
export * from "./http";
