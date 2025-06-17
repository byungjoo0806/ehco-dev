import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, collection, getDoc, query, where, getDocs } from 'firebase/firestore';

interface ArticleSummaryData {
    id: string;
    event_contents?: Record<string, string>;  // Map where keys are dates and values are strings
    subCategory?: string;
    category?: string;
    content?: string;
    title?: string;
}

const MAX_IN_CLAUSE = 30;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const publicFigureParam = searchParams.get('publicFigure');
    const articleIdsParam = searchParams.get('articleIds');

    if (!publicFigureParam || !articleIdsParam) {
        return NextResponse.json(
            { error: 'Missing required parameters: publicFigure and articleIds' },
            { status: 400 }
        );
    }

    const publicFigure = publicFigureParam.toLowerCase();
    const articleIds = articleIdsParam.split(',');

    try {
        const summaries: ArticleSummaryData[] = [];
        const summaryCollectionRef = collection(db, 'selected-figures', publicFigure, 'article-summaries');

        // Chunk the articleIds to handle Firestore's 'in' query limit
        const chunks: string[][] = [];
        for (let i = 0; i < articleIds.length; i += MAX_IN_CLAUSE) {
            chunks.push(articleIds.slice(i, i + MAX_IN_CLAUSE));
        }

        // Create a fetch promise for each chunk
        const promises = chunks.map(chunk => {
            const q = query(summaryCollectionRef, where('__name__', 'in', chunk));
            return getDocs(q);
        });

        // Wait for all fetches to complete in parallel
        const snapshots = await Promise.all(promises);

        // Flatten the results from all chunks into a single array
        snapshots.forEach(snapshot => {
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                summaries.push({
                    id: doc.id,
                    event_contents: data.event_contents || {},
                    subCategory: data.subCategory,
                    category: data.category,
                    content: data.content,
                    title: data.title
                });
            });
        });

        // console.log(summaries);
        return NextResponse.json(summaries);
    } catch (error) {
        console.error('Error fetching article summaries:', error);
        return NextResponse.json(
            { error: 'Failed to fetch article summaries' },
            { status: 500 }
        );
    }
}