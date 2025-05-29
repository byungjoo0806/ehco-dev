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

        // For each articleId, get the document from article-summaries collection
        for (const articleId of articleIds) {
            const summaryRef = doc(db, 'selected-figures', publicFigure, 'article-summaries', articleId);
            const summaryDoc = await getDoc(summaryRef);

            if (summaryDoc.exists()) {
                const data = summaryDoc.data();
                summaries.push({
                    id: articleId,
                    event_contents: data.event_contents || {},
                    subCategory: data.subCategory,
                    category: data.category,
                    content: data.content,
                    title: data.title
                });
            }
        }

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