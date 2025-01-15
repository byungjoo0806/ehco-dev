// app/api/articles/search/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { query, collection, where, orderBy, limit, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q');
    const limitSize = Number(searchParams.get('limit')) || 5;

    if (!searchQuery) {
        return NextResponse.json([], { status: 200 });
    }

    try {
        const articlesRef = collection(db, 'news');

        // Create a compound query for title
        const titleQuery = query(
            articlesRef,
            where('title', '>=', searchQuery),
            where('title', '<=', searchQuery + '\uf8ff'),
            orderBy('title'),
            limit(limitSize)
        );

        // Query for excerpt
        const excerptQuery = query(
            articlesRef,
            where('content', '>=', searchQuery),
            where('content', '<=', searchQuery + '\uf8ff'),
            orderBy('content'),
            limit(limitSize)
        );

        // Execute queries in parallel
        const [titleSnap, excerptSnap] = await Promise.all([
            getDocs(titleQuery),
            getDocs(excerptQuery)
        ]);

        // Combine and deduplicate results
        const results = new Map();

        // Helper function to add documents to results map
        const addDocsToResults = (snapshot: QuerySnapshot<DocumentData>) => {
            snapshot.forEach(doc => {
                if (!results.has(doc.id)) {
                    const data = doc.data();
                    // console.log(data);
                    results.set(doc.id, {
                        id: doc.id,
                        name: data.title,
                        content: data.content,
                        date: data.formatted_date,
                        category: data.mainCategory,
                        source: data.source,
                        celebrity: data.celebrity,
                        thumbnail: data.thumbnail,
                        url: data.url
                    });
                }
            });
        };

        addDocsToResults(titleSnap);
        addDocsToResults(excerptSnap);

        // console.log(results);

        // Convert results to array and sort by formatted_date
        const articles = Array.from(results.values())
            .sort((a, b) => {
                const dateA = a.date?.toMillis?.() ?? 0;
                const dateB = b.date?.toMillis?.() ?? 0;
                return dateB - dateA;
            })
            .slice(0, limitSize)
            .map(article => ({
                id: article.id,
                name: article.name,
                content: article.content,
                date: article.date,
                category: article.category,
                source: article.source,
                celebrity: article.celebrity,
                thumbnail: article.thumbnail,
                url: article.url
            }));

            // console.log(articles);
        return NextResponse.json(articles, { status: 200 });

    } catch (error) {
        console.error('Error searching articles:', error);
        return NextResponse.json(
            { error: 'Failed to search articles' },
            { status: 500 }
        );
    }
}