// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { Analytics, getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API,
  authDomain: "ehco-85586.firebaseapp.com",
  projectId: "ehco-85586",
  storageBucket: "ehco-85586.firebasestorage.app",
  messagingSenderId: "129561385945",
  appId: "1:129561385945:web:61ce03231f7f0a307817c8",
  measurementId: "G-Q3N7EK4GHD"
};

// Add this debug log
// console.log('Firebase API Key exists:', !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// // Initialize Analytics with type safety
// export let analytics: Analytics | null = null;
// if (typeof window !== 'undefined') {
//   analytics = getAnalytics(app);
// }

// Initialize Analytics only on client side
// export const initializeAnalytics = () => {
//   if (typeof window !== 'undefined') {
//     return getAnalytics(app);
//   }
//   return null;
// };

// Initialize Analytics with better error handling and type safety
export let analytics: Analytics | null = null;

if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
    console.log('Firebase Analytics initialized successfully');
  } catch (error) {
    console.error('Firebase Analytics initialization error:', error);
  }
}

// export const initializeAnalytics = () => {
//   if (typeof window !== 'undefined') {
//     try {
//       return getAnalytics(app);
//     } catch (error) {
//       console.error('Analytics initialization error:', error);
//       return null;
//     }
//   }
//   return null;
// };