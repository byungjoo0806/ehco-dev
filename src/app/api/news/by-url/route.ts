// app/api/news/by-url/route.ts
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        // Get the URL from the query parameters
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');

        if (!url) {
            return NextResponse.json(
                { error: 'URL parameter is required' },
                { status: 400 }
            );
        }

        // Query Firestore for documents where url field matches the provided URL
        const newsCollection = collection(db, 'news');
        const q = query(
            newsCollection,
            where('url', '==', url),
            limit(1) // We expect only one document with this URL
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return NextResponse.json(
                { error: 'News item not found with this URL' },
                { status: 404 }
            );
        }

        // Get the first document from the query results
        const docSnap = querySnapshot.docs[0];
        const fullData = docSnap.data();
        
        // Extract only the requested fields
        const data = {
            title: fullData.title || null,
            formatted_date: fullData.formatted_date || null,
            content: fullData.content || null
        };

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching news item by URL:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}