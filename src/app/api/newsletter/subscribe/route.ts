import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // Adjust path to your Firebase config
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Normalize email (lowercase and trim)
        const normalizedEmail = email.toLowerCase().trim();

        // Check if email already exists
        const subscriberDocRef = doc(db, 'subscribers', normalizedEmail);
        const subscriberDoc = await getDoc(subscriberDocRef);

        if (subscriberDoc.exists()) {
            return NextResponse.json(
                { error: 'This email is already subscribed to our newsletter.' },
                { status: 409 }
            );
        }

        // Add new subscriber
        await setDoc(subscriberDocRef, {
            email: normalizedEmail,
            createdAt: serverTimestamp(),
        });

        return NextResponse.json(
            { message: 'Successfully subscribed to newsletter' },
            { status: 200 }
        );

    } catch (error) {
        console.error('Newsletter subscription error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}