// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { Analytics, getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "ehco-85586.firebaseapp.com",
  projectId: "ehco-85586",
  storageBucket: "ehco-85586.firebasestorage.app",
  messagingSenderId: "129561385945",
  appId: "1:129561385945:web:61ce03231f7f0a307817c8",
  measurementId: "G-Q3N7EK4GHD"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Analytics only on client side
export const initializeAnalytics = () => {
  if (typeof window !== 'undefined') {
    return getAnalytics(app);
  }
  return null;
};