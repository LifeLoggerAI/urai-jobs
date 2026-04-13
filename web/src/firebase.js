"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.functions = exports.storage = exports.db = exports.auth = exports.app = void 0;
var app_1 = require("firebase/app");
var auth_1 = require("firebase/auth");
var firestore_1 = require("firebase/firestore");
var storage_1 = require("firebase/storage");
var functions_1 = require("firebase/functions");
var firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
exports.app = (0, app_1.initializeApp)(firebaseConfig);
exports.auth = (0, auth_1.getAuth)(exports.app);
exports.db = (0, firestore_1.getFirestore)(exports.app);
exports.storage = (0, storage_1.getStorage)(exports.app);
exports.functions = (0, functions_1.getFunctions)(exports.app);
var useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
if (useEmulators) {
    (0, auth_1.connectAuthEmulator)(exports.auth, "http://127.0.0.1:9099", { disableWarnings: true });
    (0, firestore_1.connectFirestoreEmulator)(exports.db, "127.0.0.1", 8080);
    (0, storage_1.connectStorageEmulator)(exports.storage, "127.0.0.1", 9199);
    (0, functions_1.connectFunctionsEmulator)(exports.functions, "127.0.0.1", 5001);
}
exports.default = exports.app;
