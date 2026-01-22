import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";

initializeApp();

// Import and export functions from their individual files
export { onJobWrite } from "./triggers/onJobWrite";
export { onApplicationCreate } from "./triggers/onApplicationCreate";
