// src/hooks/useSimpleArticleLoading.ts

import { useState, useCallback, useRef } from 'react';
import { Article } from '@/types/definitions';

interface UseSimpleArticleLoadingProps {
    initialArticles: Article[];
    remainingArticleIds: string[];
    figureId: string;
    batchSize?: number;
}

interface UseSimpleArticleLoadingReturn {
    articles: Article[];
    isLoading: boolean;
    hasMore: boolean;
    loadedCount: number;
    totalCount: number;
    loadMore: () => void;
    error: string | null;
}

export function useSimpleArticleLoading({
    initialArticles,
    remainingArticleIds,
    figureId,
    batchSize = 50
}: UseSimpleArticleLoadingProps): UseSimpleArticleLoadingReturn {

    // Store all loaded articles
    const [articles, setArticles] = useState<Article[]>(initialArticles);

    // Track loading state
    const [isLoading, setIsLoading] = useState(false);

    // Track error state
    const [error, setError] = useState<string | null>(null);

    // Keep track of remaining IDs to load
    const [remainingIds, setRemainingIds] = useState<string[]>(remainingArticleIds);

    // Keep track of which articles we've already attempted to load
    const attemptedIds = useRef<Set<string>>(new Set(initialArticles.map(a => a.id)));

    const loadMore = useCallback(async () => {
        if (remainingIds.length === 0 || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            // Get next batch of IDs
            const nextBatch = remainingIds.slice(0, batchSize);
            // console.log(`Loading next batch of ${nextBatch.length} articles`);

            const response = await fetch(`/api/articles/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    articleIds: nextBatch,
                    figureId: figureId
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to load articles: ${response.status}`);
            }

            const newArticles: Article[] = await response.json();
            // console.log(`Loaded ${newArticles.length} new articles`);

            // ADD THIS DEBUG LOG
            console.log(`New article IDs:`, newArticles.slice(0, 10).map(a => a.id));

            // ADD THIS TOO - to see what the events are looking for
            console.log(`Expected article IDs from events:`, nextBatch.slice(0, 10));

            // Add new articles to the list
            setArticles(prev => [...prev, ...newArticles]);

            // Remove loaded IDs from remaining
            setRemainingIds(prev => prev.slice(batchSize));

            // Mark as attempted
            nextBatch.forEach(id => attemptedIds.current.add(id));

        } catch (err) {
            console.error('Error loading more articles:', err);
            setError(err instanceof Error ? err.message : 'Failed to load articles');
        } finally {
            setIsLoading(false);
        }
    }, [remainingIds, isLoading, batchSize, figureId]);

    return {
        articles,
        isLoading,
        hasMore: remainingIds.length > 0,
        loadedCount: articles.length,
        totalCount: initialArticles.length + remainingArticleIds.length,
        loadMore,
        error
    };
}