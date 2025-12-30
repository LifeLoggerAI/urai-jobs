
import * as admin from "firebase-admin";
admin.initializeApp();

import * as functions from "firebase-functions";
import { api } from "./api";
import { jobTick as jobTickFunction } from "./job-tick";

// Expose the API as an HTTP function
export const api = functions.https.onRequest(api);

// Expose the job tick as a scheduled function
export const jobTick = jobTickFunction;
