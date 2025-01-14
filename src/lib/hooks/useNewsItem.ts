import { useState, useEffect } from 'react';
import type { NewsItem } from './useNews';

interface NewsItemState {
    newsItem: NewsItem | null;
    loading: boolean;
    error: string | null;
}

export function useNewsItems(documentIds: (string | null)[]) {
    const [newsItems, setNewsItems] = useState<NewsItemState[]>([]);

    useEffect(() => {
        // Reset state with initial values for all IDs
        setNewsItems(documentIds.map(() => ({
            newsItem: null,
            loading: false,
            error: null
        })));

        // Filter out null IDs and create a map of their original indices
        const validIds = documentIds
            .map((id, index) => ({ id, index }))
            .filter((item): item is { id: string; index: number } => item.id !== null);

        const fetchNewsItems = async () => {
            // Start loading state for valid IDs
            setNewsItems(prev => {
                const next = [...prev];
                validIds.forEach(({ index }) => {
                    next[index] = {
                        ...next[index],
                        loading: true,
                        error: null
                    };
                });
                return next;
            });

            // Fetch all items in parallel
            const promises = validIds.map(async ({ id, index }) => {
                try {
                    const response = await fetch(`/api/news/item/${id}`);

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    const finalData = {
                        id,
                        ...data
                    };

                    // Update state for this specific item
                    setNewsItems(prev => {
                        const next = [...prev];
                        next[index] = {
                            newsItem: finalData,
                            loading: false,
                            error: null
                        };
                        return next;
                    });
                } catch (err) {
                    // Update error state for this specific item
                    setNewsItems(prev => {
                        const next = [...prev];
                        next[index] = {
                            newsItem: null,
                            loading: false,
                            error: err instanceof Error ? err.message : 'Failed to fetch news item'
                        };
                        return next;
                    });
                }
            });

            await Promise.all(promises);
        };

        if (validIds.length > 0) {
            fetchNewsItems();
        }
    }, [documentIds]); // Dependency on documentIds array

    // Compute aggregated states
    const isLoading = newsItems.some(item => item.loading);
    const hasError = newsItems.some(item => item.error !== null);
    const validNewsItems = newsItems.filter(item => item.newsItem !== null);

    return {
        newsItems,      // Full state array including loading and error states
        isLoading,      // True if any item is loading
        hasError,       // True if any item has an error
        validNewsItems, // Only items that were successfully loaded
    };
}