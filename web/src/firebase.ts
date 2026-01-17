
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// This is automatically configured when using Firebase Hosting
const firebaseConfig = {
  apiKey: "/__/firebase/apiKey",
  authDomain: "/__/firebase/authDomain",
  projectId: "/__/firebase/projectId",
  storageBucket: "/__/firebase/storageBucket",
  messagingSenderId: "/__/firebase/messagingSenderId",
  appId: "/__/firebase/appId"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the database service
const db = getFirestore(app);

// Get a reference to the authentication service
const auth = getAuth(app);

// Get a reference to the storage service
const storage = getStorage(app);

export { db, auth, storage };
