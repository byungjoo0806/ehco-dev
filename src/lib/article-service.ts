// src/lib/article-service.ts

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Define the shape of an article, which you can expand later if needed
import { Article } from '@/types/definitions';

const MAX_IN_CLAUSE = 30; // Firestore's 'in' query limit

/**
 * Fetches multiple articles from Firestore based on a list of document IDs.
 * @param articleIds An array of article document IDs.
 * @returns A promise that resolves to an array of article objects.
 */
export async function getArticlesByIds(articleIds: string[]): Promise<Article[]> {
    // If no IDs are provided, return an empty array immediately.
    if (!articleIds || articleIds.length === 0) {
        return [];
    }

    try {
        // Ensure there are no duplicate IDs to make the query more efficient.
        const uniqueIds = [...new Set(articleIds)];

        // Firestore limits 'in' queries to 30 items, so we chunk the IDs.
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueIds.length; i += MAX_IN_CLAUSE) {
            chunks.push(uniqueIds.slice(i, i + MAX_IN_CLAUSE));
        }

        const articlesRef = collection(db, 'newsArticles');

        // Create a fetch promise for each chunk.
        const promises = chunks.map(chunk => {
            const q = query(articlesRef, where('__name__', 'in', chunk));
            return getDocs(q);
        });

        // Wait for all fetches to complete in parallel.
        const snapshots = await Promise.all(promises);

        // Flatten the results from all chunks into a single array.
        const articles = snapshots.flatMap(snapshot =>
            snapshot.docs.map(doc => ({
                id: doc.id,
                subTitle: doc.data().subTitle || '',
                link: doc.data().link || '',
                body: doc.data().body || '',
                source: doc.data().source || '',
                imageUrls: doc.data().imageUrls || [],
                sendDate: doc.data().sendDate || '',
                // Map other fields from your document here...
            }))
        );

        return articles as Article[];
    } catch (error) {
        console.error('Error fetching articles by IDs:', error);
        // Return an empty array in case of an error to prevent the page from crashing.
        return [];
    }
}