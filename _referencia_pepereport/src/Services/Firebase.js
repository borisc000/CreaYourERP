// src/Services/Firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace this with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyD-fKG75PBHRBRd6flKqQP1-acn8UaXltw",
  authDomain: "reportespepe.firebaseapp.com",
  projectId: "reportespepe",
  storageBucket: "reportespepe.firebasestorage.app",
  messagingSenderId: "204994485498",
  appId: "1:204994485498:web:fedc0e4d05d005b937fd43",
  measurementId: "G-BPM7T68QSQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

// Helper functions for auth
export const emailLogin = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export default app;
