// src/app/api/articles/route.ts
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { NextResponse } from 'next/server';

interface Article {
    id: string;
    subTitle: string;
    body: string;
    source: string;
    link: string;
    imageUrls: string[];
    imageCaptions: string[];
    sendDate: string;
}

const MAX_IN_CLAUSE = 30; // Firestore's limit

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ids = searchParams.get('ids');

        if (!ids) {
            return NextResponse.json(
                { error: 'Missing article IDs parameter' },
                { status: 400 }
            );
        }

        const articleIds = ids.split(',');

        if (articleIds.length === 0) {
            return NextResponse.json(
                { error: 'No article IDs provided' },
                { status: 400 }
            );
        }

        // Split into chunks of 30 IDs
        const chunks = [];
        for (let i = 0; i < articleIds.length; i += MAX_IN_CLAUSE) {
            chunks.push(articleIds.slice(i, i + MAX_IN_CLAUSE));
        }

        // Fetch all chunks in parallel
        const articlesRef = collection(db, 'newsArticles');
        const promises = chunks.map(chunk => {
            const q = query(articlesRef, where('__name__', 'in', chunk));
            return getDocs(q);
        });

        const snapshots = await Promise.all(promises);
        const articles = snapshots.flatMap(snapshot =>
            snapshot.docs.map(doc => ({
                id: doc.id,
                subTitle: doc.data().subTitle || '',
                body: doc.data().body || '',
                source: doc.data().source || '',
                link: doc.data().link || '',
                imageUrls: doc.data().imageUrls || [],
                imageCaptions: doc.data().imageCaptions || [],
                sendDate: doc.data().sendDate || '',
            }))
        );

        return NextResponse.json(articles);
    } catch (error) {
        console.error('Error fetching articles:', error);
        return NextResponse.json(
            { error: 'Failed to fetch articles' },
            { status: 500 }
        );
    }
}