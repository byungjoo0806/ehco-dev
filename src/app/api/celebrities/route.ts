import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const celebritiesQuery = query(
            collection(db, 'celebrities'),
            limit(10)
        );

        const celebritiesSnapshot = await getDocs(celebritiesQuery);
        const celebrities = celebritiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ celebrities });
    } catch (error) {
        console.error('Error fetching celebrities:', error);
        return NextResponse.json(
            { error: 'Failed to fetch celebrities' },
            { status: 500 }
        );
    }
}