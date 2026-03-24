import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAAnZfGWU1H58BzuvuJgGiv3qTv1phUBys", // Fallback for local dev if .env is missing
  authDomain: "gen-lang-client-0514398810.firebaseapp.com",
  projectId: "gen-lang-client-0514398810",
  storageBucket: "gen-lang-client-0514398810.firebasestorage.app",
  messagingSenderId: "770078955285",
  appId: "1:770078955285:web:734bbf00bd11dd0b9f3b1c",
  measurementId: "",
  firestoreDatabaseId: "ai-studio-f794b658-6501-4fbf-80a3-5614a798944c"
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Sign in anonymously for basic security and UID tracking
signInAnonymously(auth).catch((error) => {
  console.error("Firebase Auth Error:", error);
});

export { collection, doc, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDoc, setDoc, onAuthStateChanged };
