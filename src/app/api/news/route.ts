import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query, orderBy } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        // Query articles ordered by formatted_date in descending order
        const articlesQuery = query(
            collection(db, 'news'),
            orderBy('formatted_date', 'desc'),  // Sort by YYYY-MM-DD string
            limit(10)
        );

        const articlesSnapshot = await getDocs(articlesQuery);
        const articles = articlesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`Fetched ${articles.length} most recent articles sorted by formatted_date`);

        return NextResponse.json({ articles });
    } catch (error) {
        console.error('Error fetching articles:', error);
        return NextResponse.json(
            { error: 'Failed to fetch articles' },
            { status: 500 }
        );
    }
}