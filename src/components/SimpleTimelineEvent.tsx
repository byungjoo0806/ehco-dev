// src/components/SimpleTimelineEvent.tsx

'use client';

import React, { useState } from 'react';
import { CuratedEvent, Article, TimelinePoint } from '@/types/definitions';
import ScrapButton from './ScrapButton';
import ReportButton from './ReportButton';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface SimpleTimelineEventProps {
    event: CuratedEvent;
    eventIndex: number;
    figureId: string;
    figureName: string;
    figureNameKr: string;
    mainCategory: string;
    subcategory: string;
    articles: Article[];
    className?: string;
}

// Helper functions
const formatTimelineDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parts.length > 1 ? parseInt(parts[1]) - 1 : 0;
    const day = parts.length > 2 ? parseInt(parts[2]) : 1;
    const date = new Date(Date.UTC(year, month, day));
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', timeZone: 'UTC' };
    if (parts.length > 1) options.month = 'long';
    if (parts.length > 2) options.day = 'numeric';
    return date.toLocaleDateString('en-US', options);
};

const slugify = (text: string) =>
    text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

// Event Sources Component
const EventSources: React.FC<{ articleIds: string[]; articles: Article[] }> = ({ articleIds, articles }) => {
    console.log(`EventSources called with ${articleIds.length} articleIds and ${articles.length} articles`);
    console.log(`ArticleIds:`, articleIds.slice(0, 3));
    console.log(`First few article IDs from articles array:`, articles.slice(0, 3).map(a => a.id));

    // Create a map for O(1) lookup
    const articlesMap = new Map(articles.map(article => [article.id, article]));

    const relevantArticles = articleIds
        .map(id => articlesMap.get(id))
        .filter(Boolean) as Article[];

    relevantArticles.sort((a, b) => {
        if (!a.sendDate) return 1;
        if (!b.sendDate) return -1;
        return b.sendDate.localeCompare(a.sendDate);
    });

    const formatArticleDate = (dateString: string | undefined): string => {
        if (!dateString || dateString.length !== 8) return dateString || '';
        try {
            const year = parseInt(dateString.substring(0, 4));
            const month = parseInt(dateString.substring(4, 6)) - 1;
            const day = parseInt(dateString.substring(6, 8));
            const date = new Date(Date.UTC(year, month, day));
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
            });
        } catch (error) {
            console.error("Could not parse date:", dateString, error);
            return dateString;
        }
    };

    if (relevantArticles.length === 0) {
        return (
            <div className="mt-3 pt-3 border-t border-gray-200/80">
                <p className="text-sm text-gray-500 italic">
                    {articleIds.length > 0
                        ? `${articleIds.length} source(s) not yet loaded`
                        : 'No sources available'
                    }
                </p>
            </div>
        );
    }

    return (
        <div className="mt-3 pt-3 border-t border-gray-200/80">
            <div className="grid grid-cols-1 gap-4">
                {relevantArticles.map(article => (
                    <a
                        key={article.id}
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 border rounded-lg hover:bg-gray-50/80 transition-all duration-200 shadow-sm"
                    >
                        {article.imageUrls?.[0] && (
                            <img
                                src={article.imageUrls[0]}
                                alt={article.subTitle || 'Source image'}
                                className="w-full h-32 sm:w-20 sm:h-20 object-cover rounded-md flex-shrink-0 bg-gray-100"
                            />
                        )}
                        <div className="flex flex-col">
                            <h6 className="font-semibold text-sm text-blue-700 hover:underline leading-tight">
                                {article.subTitle || article.title || 'Source Article'}
                            </h6>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                {article.source && <span>{article.source}</span>}
                                {article.source && article.sendDate && <span>&middot;</span>}
                                {article.sendDate && (
                                    <time dateTime={article.sendDate}>
                                        {formatArticleDate(article.sendDate)}
                                    </time>
                                )}
                            </div>
                            {article.body && (() => {
                                const parts = article.body.split(' -- ');
                                const mainContent = (parts.length > 1 ? parts[1] : parts[0]).trim();
                                return (
                                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                                        {mainContent.substring(0, 120)}...
                                    </p>
                                );
                            })()}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

// Timeline Point Component
const TimelinePointWithSources: React.FC<{
    point: TimelinePoint;
    isLast: boolean;
    articles: Article[];
}> = ({ point, isLast, articles }) => {
    const [isSourcesVisible, setIsSourcesVisible] = useState(false);

    const sourceIds = point.sourceIds ||
        (point.sources?.map((source: { id?: string }) => source.id).filter((id): id is string => Boolean(id))) ||
        [];
    const hasSources = sourceIds.length > 0;

    const toggleSources = () => setIsSourcesVisible(prev => !prev);

    return (
        <div className="relative pb-4">
            <div className="absolute w-3 h-3 bg-red-500 rounded-full left-[-20px] top-1 border-2 border-white"></div>
            {!isLast && <div className="absolute w-px h-full bg-gray-200 left-[-14px] top-4"></div>}
            <p className="text-sm font-medium text-gray-500">{formatTimelineDate(point.date)}</p>
            <div className="flex justify-between items-start gap-4">
                <p className="text-base text-gray-700">{point.description.replaceAll("*", "'")}</p>
                {hasSources && (
                    <button
                        onClick={toggleSources}
                        className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0"
                        aria-label="Toggle sources"
                    >
                        {isSourcesVisible ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                )}
            </div>
            {isSourcesVisible && hasSources && (
                <EventSources articles={articles} articleIds={sourceIds} />
            )}
        </div>
    );
};

// Main Component
const SimpleTimelineEvent: React.FC<SimpleTimelineEventProps> = ({
    event,
    eventIndex,
    figureId,
    figureName,
    figureNameKr,
    mainCategory,
    subcategory,
    articles,
    className = ""
}) => {
    // ADD THESE DEBUG LOGS
    console.log(`Event "${event.event_title}" received ${articles.length} articles`);

    // Check if this event needs any articles
    const neededArticleIds = new Set<string>();
    event.timeline_points?.forEach(point => {
        point.sourceIds?.forEach(id => neededArticleIds.add(id));
        point.sources?.forEach(source => source.id && neededArticleIds.add(source.id));
    });

    const availableArticles = Array.from(neededArticleIds).filter(id =>
        articles.some(article => article.id === id)
    );

    console.log(`Event "${event.event_title}" needs ${neededArticleIds.size} articles, has ${availableArticles.length} available`);
    console.log(`Needed IDs:`, Array.from(neededArticleIds).slice(0, 3));
    console.log(`Available articles:`, availableArticles.slice(0, 3));

    console.log(`First 5 actual article IDs in articles array:`, articles.slice(0, 5).map(a => a.id));
    console.log(`Are articles defined?`, articles.length > 0 ? 'Yes' : 'No');
    if (articles.length > 0) {
        console.log(`First article structure:`, articles[0]);
    }

    return (
        <div
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

            <div className="relative pl-5">
                {event.timeline_points?.map((point, index) => (
                    <TimelinePointWithSources
                        key={index}
                        point={point}
                        articles={articles}
                        isLast={index === event.timeline_points.length - 1}
                    />
                )) || <div className="text-gray-500 text-sm">No timeline points available</div>}
            </div>
        </div>
    );
};

export default SimpleTimelineEvent;