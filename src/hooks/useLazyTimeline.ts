// hooks/useLazyTimeline.ts - Fixed version to prevent stack overflow
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Article } from '@/types/definitions';

interface LazyTimelineState {
    loadedArticleIds: Set<string>;
    articlesMap: Map<string, Article>;
    loadingArticleIds: Set<string>;
    isLoading: boolean;
}

interface UseLazyTimelineOptions {
    figureId: string;
    rootMargin?: string;
    threshold?: number;
    enablePreloading?: boolean;
    preloadDistance?: string;
}

export const useLazyTimeline = (
    initialArticles: Article[] = [],
    options: UseLazyTimelineOptions
) => {
    const {
        figureId,
        rootMargin = '200px',
        threshold = 0.1,
        enablePreloading = true,
        preloadDistance = '400px'
    } = options;

    // Initialize state once with initial articles
    const [state, setState] = useState<LazyTimelineState>(() => {
        const initialMap = new Map<string, Article>();
        const initialIds = new Set<string>();

        initialArticles.forEach(article => {
            initialMap.set(article.id, article);
            initialIds.add(article.id);
        });

        return {
            loadedArticleIds: initialIds,
            articlesMap: initialMap,
            loadingArticleIds: new Set(),
            isLoading: false
        };
    });

    // Intersection Observer refs
    const observerRef = useRef<IntersectionObserver | null>(null);
    const preloadObserverRef = useRef<IntersectionObserver | null>(null);
    const observedElements = useRef<Set<Element>>(new Set());

    // Article loading function - removed dependencies that could cause circular refs
    const loadArticles = useCallback(async (articleIds: string[]): Promise<Article[]> => {
        // Get current state to avoid stale closures
        setState(currentState => {
            const idsToLoad = articleIds.filter(id =>
                !currentState.loadedArticleIds.has(id) && !currentState.loadingArticleIds.has(id)
            );

            if (idsToLoad.length === 0) {
                return currentState; // No change needed
            }

            // Mark articles as loading
            return {
                ...currentState,
                loadingArticleIds: new Set([...currentState.loadingArticleIds, ...idsToLoad]),
                isLoading: true
            };
        });

        try {
            // Filter again to get only unloaded articles
            const currentLoadedIds = state.loadedArticleIds;
            const currentLoadingIds = state.loadingArticleIds;
            const idsToLoad = articleIds.filter(id =>
                !currentLoadedIds.has(id) && !currentLoadingIds.has(id)
            );

            if (idsToLoad.length === 0) {
                return [];
            }

            // Call the article summaries API
            const response = await fetch(
                `/api/article-summaries?publicFigure=${encodeURIComponent(figureId)}&articleIds=${encodeURIComponent(idsToLoad.join(','))}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch articles');
            }

            const articleSummaries = await response.json();

            // Transform summaries to Article format
            const newArticles: Article[] = articleSummaries.map((summary: any) => ({
                id: summary.id,
                title: summary.title || '',
                subTitle: summary.title || '',
                body: summary.content || '',
                source: summary.category || '',
                sendDate: '',
                link: '#',
                imageUrls: []
            }));

            // Update state with new articles
            setState(prevState => {
                const newMap = new Map(prevState.articlesMap);
                const newLoadedIds = new Set(prevState.loadedArticleIds);
                const newLoadingIds = new Set(prevState.loadingArticleIds);

                newArticles.forEach(article => {
                    newMap.set(article.id, article);
                    newLoadedIds.add(article.id);
                    newLoadingIds.delete(article.id);
                });

                return {
                    ...prevState,
                    articlesMap: newMap,
                    loadedArticleIds: newLoadedIds,
                    loadingArticleIds: newLoadingIds,
                    isLoading: newLoadingIds.size > 0
                };
            });

            return newArticles;
        } catch (error) {
            console.error('Error loading articles:', error);

            // Remove from loading state on error
            setState(prevState => ({
                ...prevState,
                loadingArticleIds: new Set([...prevState.loadingArticleIds].filter(id => !articleIds.includes(id))),
                isLoading: prevState.loadingArticleIds.size > articleIds.length
            }));

            return [];
        }
    }, [figureId]); // Only depend on figureId to avoid circular refs

    // Intersection Observer callback for main loading - simplified
    const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target as HTMLElement;
                const articleIds = element.dataset.articleIds;

                if (articleIds) {
                    const ids = articleIds.split(',').filter(Boolean);
                    if (ids.length > 0) {
                        loadArticles(ids);
                    }
                }
            }
        });
    }, [loadArticles]);

    // Intersection Observer callback for preloading - simplified
    const handlePreloadIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
        if (!enablePreloading) return;

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target as HTMLElement;
                const preloadIds = element.dataset.preloadIds;

                if (preloadIds) {
                    const ids = preloadIds.split(',').filter(Boolean);
                    if (ids.length > 0) {
                        loadArticles(ids);
                    }
                }
            }
        });
    }, [enablePreloading, loadArticles]);

    // Initialize observers
    useEffect(() => {
        // Main intersection observer
        observerRef.current = new IntersectionObserver(handleIntersection, {
            rootMargin,
            threshold
        });

        // Preload intersection observer
        if (enablePreloading) {
            preloadObserverRef.current = new IntersectionObserver(handlePreloadIntersection, {
                rootMargin: preloadDistance,
                threshold: 0.01
            });
        }

        return () => {
            observerRef.current?.disconnect();
            preloadObserverRef.current?.disconnect();
        };
    }, [handleIntersection, handlePreloadIntersection, rootMargin, threshold, preloadDistance, enablePreloading]);

    // Function to observe an element
    const observeElement = useCallback((element: Element, articleIds: string[], preloadIds: string[] = []) => {
        if (!element || observedElements.current.has(element)) return;

        // Set data attributes for the observers
        const htmlElement = element as HTMLElement;
        htmlElement.dataset.articleIds = articleIds.join(',');
        if (preloadIds.length > 0) {
            htmlElement.dataset.preloadIds = preloadIds.join(',');
        }

        // Start observing
        observerRef.current?.observe(element);
        if (enablePreloading && preloadIds.length > 0) {
            preloadObserverRef.current?.observe(element);
        }

        observedElements.current.add(element);
    }, [enablePreloading]);

    // Function to stop observing an element
    const unobserveElement = useCallback((element: Element) => {
        if (!element || !observedElements.current.has(element)) return;

        observerRef.current?.unobserve(element);
        preloadObserverRef.current?.unobserve(element);
        observedElements.current.delete(element);
    }, []);

    // Helper functions - simplified to avoid circular dependencies
    const areArticlesLoaded = useCallback((articleIds: string[]): boolean => {
        return articleIds.every(id => state.loadedArticleIds.has(id));
    }, [state.loadedArticleIds]);

    const areArticlesLoading = useCallback((articleIds: string[]): boolean => {
        return articleIds.some(id => state.loadingArticleIds.has(id));
    }, [state.loadingArticleIds]);

    return {
        // State
        articlesMap: state.articlesMap,
        isLoading: state.isLoading,
        loadedArticleIds: state.loadedArticleIds,

        // Actions
        loadArticles,
        observeElement,
        unobserveElement,

        // Helpers
        areArticlesLoaded,
        areArticlesLoading,

        // Direct access to articles
        getArticle: (id: string) => state.articlesMap.get(id),
        getArticles: (ids: string[]) => ids.map(id => state.articlesMap.get(id)).filter(Boolean) as Article[]
    };
};