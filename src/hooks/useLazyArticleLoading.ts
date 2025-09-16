// src/hooks/useLazyArticleLoading.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import { Article } from '@/types/definitions';

interface UseLazyArticleLoadingProps {
    initialArticles: Article[];
    remainingArticleIds: string[];
    figureId: string;
    batchSize?: number;
}

interface UseLazyArticleLoadingReturn {
    articlesMap: Map<string, Article>;
    loadingArticleIds: Set<string>;
    loadArticlesByIds: (ids: string[]) => Promise<void>;
    isLoading: boolean;
    loadedCount: number;
    totalCount: number;
    loadNextBatch: () => void;
}

export function useLazyArticleLoading({
    initialArticles,
    remainingArticleIds,
    figureId,
    batchSize = 20
}: UseLazyArticleLoadingProps): UseLazyArticleLoadingReturn {

    // Store all articles in a Map for O(1) lookup
    const [articlesMap, setArticlesMap] = useState<Map<string, Article>>(() => {
        const map = new Map(initialArticles.map(article => [article.id, article]));
        console.log(`🏗️ Initialized articlesMap with ${map.size} articles`);
        return map;
    });

    // Track which articles are currently being loaded
    const [loadingArticleIds, setLoadingArticleIds] = useState<Set<string>>(new Set());

    // Track overall loading state
    const [isLoading, setIsLoading] = useState(false);

    // Keep track of which articles we've already attempted to load
    const attemptedIds = useRef<Set<string>>(new Set(initialArticles.map(a => a.id)));

    // Keep track of remaining IDs to load
    const [remainingIds, setRemainingIds] = useState<string[]>(remainingArticleIds);

    // Debug initial state
    useEffect(() => {
        console.log(`🔧 useLazyArticleLoading initialized:`, {
            initialArticles: initialArticles.length,
            remainingArticleIds: remainingArticleIds.length,
            figureId,
            batchSize
        });
    }, []);

    const loadArticlesByIds = useCallback(async (requestedIds: string[]) => {
        console.log(`📥 loadArticlesByIds called with ${requestedIds.length} IDs:`, requestedIds.slice(0, 5));

        // Filter out already loaded or loading articles
        const idsToLoad = requestedIds.filter(id =>
            !articlesMap.has(id) &&
            !loadingArticleIds.has(id) &&
            !attemptedIds.current.has(id)
        );

        console.log(`🔍 After filtering - IDs to load: ${idsToLoad.length}`, idsToLoad.slice(0, 5));

        if (idsToLoad.length === 0) {
            console.log(`⏭️ No new articles to load`);
            return;
        }

        // Mark these IDs as loading
        setLoadingArticleIds(prev => {
            const updated = new Set([...prev, ...idsToLoad]);
            console.log(`🔄 Now loading ${updated.size} articles`);
            return updated;
        });
        setIsLoading(true);

        try {
            // Load in smaller batches to prevent overwhelming the server
            const batches = [];
            for (let i = 0; i < idsToLoad.length; i += batchSize) {
                batches.push(idsToLoad.slice(i, i + batchSize));
            }

            console.log(`📦 Loading ${batches.length} batches`);

            for (const [batchIndex, batch] of batches.entries()) {
                console.log(`📤 Loading batch ${batchIndex + 1}/${batches.length} with ${batch.length} articles`);

                try {
                    const response = await fetch(`/api/articles/batch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            articleIds: batch,
                            figureId: figureId
                        })
                    });

                    console.log(`📡 Batch ${batchIndex + 1} response:`, response.status, response.statusText);

                    if (response.ok) {
                        const newArticles: Article[] = await response.json();
                        console.log(`✅ Received ${newArticles.length} articles in batch ${batchIndex + 1}`);
                        console.log(`📋 First article:`, newArticles[0]?.id || 'none');

                        // Update the articles map
                        setArticlesMap(prev => {
                            const updated = new Map(prev);
                            let addedCount = 0;
                            newArticles.forEach(article => {
                                if (article?.id) {
                                    updated.set(article.id, article);
                                    addedCount++;
                                }
                            });
                            console.log(`📝 Added ${addedCount} articles to map. Total: ${updated.size}`);
                            return updated;
                        });
                    } else {
                        console.error(`❌ Batch ${batchIndex + 1} failed:`, response.status, await response.text());
                    }
                } catch (error) {
                    console.error(`❌ Failed to load article batch ${batchIndex + 1}:`, error);
                }

                // Mark these as attempted regardless of success/failure
                batch.forEach(id => attemptedIds.current.add(id));

                // Remove from loading state
                setLoadingArticleIds(prev => {
                    const updated = new Set(prev);
                    batch.forEach(id => updated.delete(id));
                    return updated;
                });

                // Small delay between batches to prevent overwhelming
                if (batches.length > 1 && batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error('❌ Critical error in loadArticlesByIds:', error);
        } finally {
            setIsLoading(false);
            console.log(`🏁 Finished loading articles. Total in map: ${articlesMap.size}`);
        }
    }, [batchSize, figureId]); // Removed articlesMap from dependencies to prevent infinite loops

    // Auto-load next batch when needed
    const loadNextBatch = useCallback(() => {
        if (remainingIds.length === 0 || isLoading) {
            console.log(`⏭️ Skipping loadNextBatch: remainingIds=${remainingIds.length}, isLoading=${isLoading}`);
            return;
        }

        const nextBatch = remainingIds.slice(0, batchSize);
        console.log(`📦 Loading next batch of ${nextBatch.length} articles`);
        setRemainingIds(prev => prev.slice(batchSize));

        loadArticlesByIds(nextBatch);
    }, [remainingIds, isLoading, batchSize, loadArticlesByIds]);

    return {
        articlesMap,
        loadingArticleIds,
        loadArticlesByIds,
        isLoading,
        loadedCount: articlesMap.size,
        totalCount: initialArticles.length + remainingArticleIds.length,
        loadNextBatch
    };
}