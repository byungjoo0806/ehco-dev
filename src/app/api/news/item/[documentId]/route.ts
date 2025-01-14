// app/api/news/item/[documentId]/route.ts
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { NextResponse } from 'next/server';

// You'll need to import your database client here
// For example, if using Firebase:
// import { db } from '@/lib/firebase';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ documentId: string }> }
) {
    try {
        const resolvedDocumentId = await params;
        const documentId = resolvedDocumentId.documentId;

        // Add your database query here
        // Example with Firebase:
        const docRef = doc(db, 'news', documentId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return NextResponse.json(
                { error: 'News item not found' },
                { status: 404 }
            );
        }

        const data = docSnap.data();

        // For testing, return mock data:
        // const mockData = {
        //     id: documentId,
        //     title: 'Test News Item',
        //     content: 'This is a test news item content',
        //     date: new Date().toISOString(),
        // };

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching news item:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}