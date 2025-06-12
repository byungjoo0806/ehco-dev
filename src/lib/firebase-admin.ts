// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const apps = getApps();

if (!apps.length) {
    try {
        // Clean and prepare the private key
        let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';

        // Check if the key starts with quotes and remove them
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }

        // Replace literal \n with actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');

        // Verify the key has the correct format
        if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') ||
            !privateKey.includes('-----END PRIVATE KEY-----')) {
            throw new Error('Private key is missing PEM headers/footers');
        }

        // console.log("Private key format looks correct (first 25 chars):",
        //     privateKey.substring(0, 25), "...[redacted]");

        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
        });
        // console.log("Firebase admin initialized successfully");
    } catch (error) {
        console.error("Error initializing Firebase admin:", error);
        throw error; // Re-throw so it's visible in server logs
    }
}

export const db = getFirestore();