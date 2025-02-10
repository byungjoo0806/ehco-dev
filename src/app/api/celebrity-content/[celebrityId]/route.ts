// src/app/api/celebrity-content/[celebrityId]/route.ts
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ celebrityId: string }> }
): Promise<NextResponse> {
    try {
        // Await the params object to resolve it
        const { celebrityId } = await params;

        const id = celebrityId.toLowerCase();

        // Reference to the subcollection
        const contentCollectionRef = collection(
            db,
            'generated_content',
            id,
            'content'
        );

        // Get all documents from the subcollection
        const querySnapshot = await getDocs(contentCollectionRef);

        // Separate special documents from regular content
        const specialDocs = ['key_works', 'overall_summary'];

        const regularContent = [];
        const specialContent = [];

        for (const doc of querySnapshot.docs) {
            const data = doc.data();

            if (specialDocs.includes(doc.id)) {
                specialContent.push({
                    id: doc.id,
                    ...data
                });
            } else {
                regularContent.push({
                    id: doc.id,
                    subcategory: data.subcategory || '',
                    subcategory_overview: data.subcategory_overview || '',
                    source_articles: data.source_articles || [],
                    chronological_developments: data.chronological_developments || ''
                });
            }
        }

        return NextResponse.json({
            regularContent,
            specialContent
        });
    } catch (error) {
        console.error('Error fetching celebrity content:', error);
        return NextResponse.json(
            { error: 'Failed to fetch celebrity content' },
            { status: 500 }
        );
    }
}