// src/lib/firebase.ts

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { Analytics, getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { AppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, getToken } from 'firebase/app-check'; // Import AppCheck type

const firebaseConfig = {
  apiKey: "AIzaSyA-J-s8gtZtnUI74TqcDnxBLobJY0349iQ",
  authDomain: "ehco-85586.firebaseapp.com",
  projectId: "ehco-85586",
  storageBucket: "ehco-85586.firebasestorage.app",
  messagingSenderId: "129561385945",
  appId: "1:129561385945:web:61ce03231f7f0a307817c8",
  measurementId: "G-Q3N7EK4GHD"
};

const app = initializeApp(firebaseConfig);

// Initialize App Check
if (typeof window !== 'undefined') {
  try {
    let appCheck: AppCheck; // Define appCheck with its type

    // const reCaptchaV3SiteKey = '6LciT7ErAAAAACVflqaKdMWHPeTOKD3inwzHt6KV';

    if (process.env.NODE_ENV === 'production') {
      // enterprise
      // console.log('🔒 Initializing App Check for production...');
      // appCheck = initializeAppCheck(app, {
      //   provider: new ReCaptchaEnterpriseProvider('6LffA6srAAAAAMjIkLM4X4lRp9nIThubEzdHKplf'),
      //   isTokenAutoRefreshEnabled: true
      // });

      // v3
      // console.log('🔒 Initializing App Check for production with reCAPTCHA v3...');
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider("6LciT7ErAAAAACVflqaKdMWHPeTOKD3inwzHt6KV"),
        isTokenAutoRefreshEnabled: false
      });
      // console.log('✅ App Check initialized for production.');
    } else {
      // enterprise
      // console.log('🧪 Enabling App Check debug token for development...');
      // (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      // appCheck = initializeAppCheck(app, {
      //   provider: new ReCaptchaEnterpriseProvider('6LffA6srAAAAAMjIkLM4X4lRp9nIThubEzdHKplf'),
      //   isTokenAutoRefreshEnabled: true
      // });

      // v3
      // console.log('🧪 Enabling App Check debug token for development...');
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider("6LciT7ErAAAAACVflqaKdMWHPeTOKD3inwzHt6KV"),
        isTokenAutoRefreshEnabled: false
      });
      // console.log('✅ App Check debug mode enabled.');
    }

    // App Check token debugging
    // enterprise
    // console.log('Attempting to get App Check token...');
    // getToken(appCheck, /* forceRefresh= */ false)
    //   .then((token) => {
    //     if (token.token) {
    //       console.log('✅ Successfully retrieved App Check token:', token.token);
    //     } else {
    //       console.error('⚠️ App Check token is missing or empty.', token);
    //     }
    //   })
    //   .catch((error) => {
    //     console.error('❌ Failed to get App Check token on load:', error);
    //   });

    // v3
    // console.log('Attempting to get App Check token...');
    getToken(appCheck, false)
      .then((token) => {
        if (token.token) {
          // console.log('✅ Successfully retrieved App Check v3 token:', token.token);
        } else {
          // console.error('⚠️ App Check v3 token is missing or empty.', token);
        }
      })
      .catch((error) => console.error('❌ Failed to get App Check v3 token on load:', error));

  } catch (error) {
    console.error('⚠️ App Check initialization failed:', error);
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export let analytics: Analytics | null = null;

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  try {
    analytics = getAnalytics(app);
    console.log('📊 Firebase Analytics initialized');
  } catch (error) {
    console.error('Analytics error:', error);
  }
} else if (typeof window !== 'undefined') {
  console.log('🧪 Analytics disabled in development mode');
}