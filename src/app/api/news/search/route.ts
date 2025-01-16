// app/api/articles/search/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { query, collection, where, orderBy, limit, getDocs, QuerySnapshot, DocumentData, QueryConstraint } from 'firebase/firestore';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q');
    const showAll = searchParams.get('showAll') === 'true';
    const limitSize = showAll ? 100 : (Number(searchParams.get('limit')) || 5);

    if (!searchQuery) {
        return NextResponse.json([], { status: 200 });
    }

    try {
        const articlesRef = collection(db, 'news');

        // Create queries with constraints
        const createQueryConstraints = (field: string): QueryConstraint[] => {
            const constraints: QueryConstraint[] = [
                where(field, '>=', searchQuery),
                where(field, '<=', searchQuery + '\uf8ff'),
                orderBy(field)
            ];

            if (!showAll) {
                constraints.push(limit(limitSize));
            }

            return constraints;
        };

        // Create a compound query for title
        const titleQuery = query(
            articlesRef,
            ...createQueryConstraints('title')
        );

        // Query for excerpt
        const excerptQuery = query(
            articlesRef,
            ...createQueryConstraints('content')
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
                // Handle string dates in YYYY-MM-DD format
                let dateA = 0;
                let dateB = 0;

                if (a.date) {
                    const parsedDateA = new Date(a.date);
                    dateA = isNaN(parsedDateA.getTime()) ? 0 : parsedDateA.getTime();
                }

                if (b.date) {
                    const parsedDateB = new Date(b.date);
                    dateB = isNaN(parsedDateB.getTime()) ? 0 : parsedDateB.getTime();
                }

                return dateB - dateA;
            })
            .slice(0, showAll ? undefined : limitSize)
            // .slice(0, limitSize)
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