// src/components/LazyTimelineEvent.tsx

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CuratedEvent, Article } from '@/types/definitions';
import { TimelinePointWithSources } from './CuratedTimelineView';
import ScrapButton from './ScrapButton';
import ReportButton from './ReportButton';

interface LazyTimelineEventProps {
    event: CuratedEvent;
    eventIndex: number;
    figureId: string;
    figureName: string;
    figureNameKr: string;
    mainCategory: string;
    subcategory: string;
    articlesMap: Map<string, Article>;
    loadingArticleIds: Set<string>;
    onLoadArticles: (ids: string[]) => void;
    className?: string;
}

const LazyTimelineEvent: React.FC<LazyTimelineEventProps> = ({
    event,
    eventIndex,
    figureId,
    figureName,
    figureNameKr,
    mainCategory,
    subcategory,
    articlesMap,
    loadingArticleIds,
    onLoadArticles,
    className = ""
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [hasLoadedArticles, setHasLoadedArticles] = useState(false);
    const eventRef = useRef<HTMLDivElement>(null);

    // Collect all article IDs needed for this event
    const neededArticleIds = React.useMemo(() => {
        const ids = new Set<string>();

        // console.log(`🔍 Collecting article IDs for event: "${event.event_title}"`);

        // From event sources (old format)
        if (event.sources && Array.isArray(event.sources)) {
            // console.log(`  📋 Found ${event.sources.length} event sources`);
            event.sources.forEach((source, index) => {
                if (source && typeof source === 'object' && source.id) {
                    ids.add(source.id);
                    // console.log(`    ✓ Source ${index}: ${source.id}`);
                }
            });
        }

        // From timeline points (new format)
        if (event.timeline_points && Array.isArray(event.timeline_points)) {
            // console.log(`  🗓️ Found ${event.timeline_points.length} timeline points`);
            event.timeline_points.forEach((point, pointIndex) => {
                if (point.sourceIds && Array.isArray(point.sourceIds)) {
                    // console.log(`    📍 Point ${pointIndex} has ${point.sourceIds.length} sourceIds`);
                    point.sourceIds.forEach(id => {
                        if (id && typeof id === 'string') {
                            ids.add(id);
                            // console.log(`      ✓ Added: ${id}`);
                        }
                    });
                }
                // Legacy: check for point.sources as well
                if (point.sources && Array.isArray(point.sources)) {
                    // console.log(`    📍 Point ${pointIndex} has ${point.sources.length} legacy sources`);
                    point.sources.forEach((source: any) => {
                        if (source && source.id) {
                            ids.add(source.id);
                            // console.log(`      ✓ Legacy source: ${source.id}`);
                        }
                    });
                }
            });
        }

        const result = Array.from(ids);
        // console.log(`🎯 Total unique article IDs needed: ${result.length}`, result.slice(0, 3));
        return result;
    }, [event]);

    // Check if we need to load articles for this event
    const needsArticleLoading = React.useMemo(() => {
        const missingIds = neededArticleIds.filter(id =>
            !articlesMap.has(id) && !loadingArticleIds.has(id)
        );

        const needsLoading = missingIds.length > 0;

        // console.log(`🤔 Event "${event.event_title}" needs loading: ${needsLoading}`);
        // console.log(`  📊 Total needed: ${neededArticleIds.length}`);
        // console.log(`  ✅ Available: ${neededArticleIds.filter(id => articlesMap.has(id)).length}`);
        // console.log(`  ⏳ Loading: ${neededArticleIds.filter(id => loadingArticleIds.has(id)).length}`);
        // console.log(`  ❌ Missing: ${missingIds.length}`);

        if (missingIds.length > 0) {
            // console.log(`  🆔 Missing IDs:`, missingIds.slice(0, 3));
        }

        return needsLoading;
    }, [neededArticleIds, articlesMap, loadingArticleIds, event.event_title]);

    // Intersection Observer for visibility
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // console.log(`👀 Event became visible: "${event.event_title}"`);
                        setIsVisible(true);
                        // Disconnect observer once visible to save resources
                        observer.disconnect();
                    }
                });
            },
            {
                root: null,
                rootMargin: '500px', // Load articles when event is 500px away from viewport (increased from 200px)
                threshold: 0
            }
        );

        if (eventRef.current) {
            observer.observe(eventRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, [event.event_title]);

    // Load articles when event becomes visible
    useEffect(() => {
        if (isVisible && needsArticleLoading && !hasLoadedArticles && neededArticleIds.length > 0) {
            // console.log(`🚀 Loading articles for visible event: "${event.event_title}"`);
            // console.log(`  📝 Loading IDs:`, neededArticleIds.slice(0, 5));

            onLoadArticles(neededArticleIds);
            setHasLoadedArticles(true);
        } else if (isVisible && !needsArticleLoading) {
            // console.log(`✨ Event "${event.event_title}" is visible and all articles are available`);
        } else if (isVisible && neededArticleIds.length === 0) {
            // console.log(`⚠️ Event "${event.event_title}" is visible but has no article IDs`);
        }
    }, [isVisible, needsArticleLoading, hasLoadedArticles, neededArticleIds, onLoadArticles, event.event_title]);

    const slugify = (text: string) =>
        text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

    // Show loading state
    const isLoadingArticles = neededArticleIds.some(id => loadingArticleIds.has(id));

    return (
        <div
            ref={eventRef}
            id={slugify(event.event_title)}
            className={`p-4 border rounded-lg shadow-sm bg-white relative ${className}`}
        >
            {/* Action buttons positioned at top-right */}
            <div className="absolute top-4 right-4 flex gap-1">
                <ReportButton
                    figureId={figureId}
                    figureName={figureName}
                    figureNameKr={figureNameKr}
                    mainCategory={mainCategory}
                    subcategory={subcategory}
                    eventGroupIndex={eventIndex}
                    eventGroup={event}
                    size="sm"
                />
                <ScrapButton
                    figureId={figureId}
                    figureName={figureName}
                    figureNameKr={figureNameKr}
                    mainCategory={mainCategory}
                    subcategory={subcategory}
                    eventGroupIndex={eventIndex}
                    eventGroup={event}
                    size="sm"
                />
            </div>

            <h4 className="font-semibold text-lg text-gray-900 pr-16">
                {event.event_title}
            </h4>
            <p className="text-sm text-gray-600 italic mt-1 mb-3">
                {event.event_summary.replaceAll("*", "'")}
            </p>

            {/* Debug info (remove in production) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mb-3 p-2 bg-yellow-50 rounded text-xs">
                    <div>Articles needed: {neededArticleIds.length}</div>
                    <div>Articles available: {neededArticleIds.filter(id => articlesMap.has(id)).length}</div>
                    <div>Currently loading: {neededArticleIds.filter(id => loadingArticleIds.has(id)).length}</div>
                    <div>Visible: {isVisible ? 'Yes' : 'No'}</div>
                    <div>Has loaded: {hasLoadedArticles ? 'Yes' : 'No'}</div>
                </div>
            )}

            <div className="relative pl-5">
                {event.timeline_points?.map((point, index) => (
                    <TimelinePointWithSources
                        key={index}
                        point={point}
                        articlesMap={articlesMap}
                        isLast={index === event.timeline_points.length - 1}
                    />
                )) || <div className="text-gray-500 text-sm">No timeline points available</div>}
            </div>

            {/* Loading indicator for articles */}
            {isVisible && isLoadingArticles && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-center">
                    <div className="inline-flex items-center text-sm text-blue-700">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                        Loading more content... ({neededArticleIds.filter(id => loadingArticleIds.has(id)).length} articles)
                    </div>
                </div>
            )}

            {/* Show if no articles needed or no sources */}
            {isVisible && neededArticleIds.length === 0 && (
                <div className="mt-3 p-2 bg-gray-50 rounded text-center text-sm text-gray-600">
                    No additional sources required for this event
                </div>
            )}
        </div>
    );
};

export default LazyTimelineEvent;