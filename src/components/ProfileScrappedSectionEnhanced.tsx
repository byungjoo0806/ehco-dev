// src/components/ProfileScrappedSectionEnhanced.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { getUserScrappedEvents, removeFromScrappedEvents, ScrappedEventItem } from '@/lib/scrapping-service';
import { Bookmark, Trash2, ExternalLink, Calendar, Tag, Loader2, ChevronDown, ChevronUp, Clock, User as UserIcon } from 'lucide-react';
import { createUrlSlug } from '@/lib/slugify';

interface ProfileScrappedSectionEnhancedProps {
    maxItems?: number;
    isFullView?: boolean;
    isLoading?: boolean; // Receive loading state
    articles?: Article[];
    figureData?: Map<string, FigureData>;
    scrappedEvents?: ScrappedEventItem[]; // Receive the data array
    onRemove?: (id: string) => void; // Receive the remove handler function
}

// Article interface (should match your existing Article type)
interface Article {
    id: string;
    link: string;
    subTitle: string;
    title: string;
    body: string;
    source: string;
    sendDate: string;
    imageUrls: string[];
}

// Figure data interface
interface FigureData {
    id: string;
    name: string;
    name_kr?: string;
    profilePic?: string;
}

// 1. Defined a specific type for a timeline point
interface TimelinePoint {
    date: string;
    description: string;
    sourceIds?: string[];
    sources?: { id?: string }[];
}

// Component to display sources for timeline points
interface TimelineSourcesProps {
    sourceIds: string[];
    articlesMap: Map<string, Article>;
}

const slugify = (text: string) =>
    text
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w-]+/g, ''); // Remove all non-word chars

const TimelineSources: React.FC<TimelineSourcesProps> = ({ sourceIds, articlesMap }) => {
    const [isVisible, setIsVisible] = useState(false);

    const relevantArticles = sourceIds
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

    if (relevantArticles.length === 0) return null;

    return (
        <div className="mt-2">
            {/* Sources Header with Toggle and Count */}
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="flex items-center gap-2 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
            >
                <span>Sources ({relevantArticles.length})</span>
                <ChevronDown
                    size={12}
                    className={`transition-transform ${isVisible ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Sources Content */}
            {isVisible && (
                <div className="mt-2 space-y-2">
                    {relevantArticles.map(article => (
                        <a
                            key={article.id}
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm"
                        >
                            {article.imageUrls?.[0] && (
                                <img
                                    src={article.imageUrls[0]}
                                    alt={article.subTitle || 'Source image'}
                                    className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-gray-100"
                                />
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                                <h6 className="font-medium text-xs text-blue-700 hover:underline leading-tight truncate">
                                    {article.subTitle || article.title || 'Source Article'}
                                </h6>
                                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                    {article.source && <span className="truncate">{article.source}</span>}
                                    {article.source && article.sendDate && <span>&middot;</span>}
                                    {article.sendDate && (
                                        <time dateTime={article.sendDate} className="truncate">
                                            {formatArticleDate(article.sendDate)}
                                        </time>
                                    )}
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

// Enhanced timeline point component with sources
interface TimelinePointProps {
    point: TimelinePoint;
    isLast: boolean;
    articlesMap: Map<string, Article>;
}

const TimelinePointDisplay: React.FC<TimelinePointProps> = ({ point, isLast, articlesMap }) => {
    const formatDate = (dateStr: string): string => {
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

    // Get source IDs from either sourceIds or sources array
    const sourceIds = point.sourceIds ||
        (point.sources?.map((source: { id?: string }) => source.id).filter((id): id is string => Boolean(id))) ||
        [];

    return (
        <div className="relative pb-3">
            {/* Timeline dot */}
            <div className="absolute w-2 h-2 bg-key-color rounded-full left-[-12px] top-1 border border-white"></div>
            {/* Timeline line */}
            {!isLast && <div className="absolute w-px h-full bg-gray-200 left-[-8px] top-3"></div>}

            {/* Content */}
            <div className="ml-4">
                <p className="text-xs font-medium text-gray-500 mb-1">{formatDate(point.date)}</p>
                <p className="text-sm text-gray-700 mb-1">{point.description.replaceAll("*", "'")}</p>

                {/* Sources */}
                {sourceIds.length > 0 && (
                    <TimelineSources sourceIds={sourceIds} articlesMap={articlesMap} />
                )}
            </div>
        </div>
    );
};

// Component for individual scrapped event
interface ScrappedEventCardProps {
    scrappedEvent: ScrappedEventItem;
    onRemove: (id: string) => void;
    isRemoving: boolean;
    isFullView?: boolean;
    articlesMap: Map<string, Article>;
    figureData?: Map<string, FigureData>; // Add figureData prop
}

const ScrappedEventCard: React.FC<ScrappedEventCardProps> = ({
    scrappedEvent,
    onRemove,
    isRemoving,
    isFullView = false,
    articlesMap,
    figureData
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const timelinePoints = scrappedEvent.eventGroup?.timeline_points || [];
    const hasTimelinePoints = timelinePoints.length > 0;
    // console.log(scrappedEvent);

    // Get figure data for profile picture
    const figure = figureData?.get(scrappedEvent.figureId);
    // console.log(figure);

    const formatEventTitle = () => {
        if (scrappedEvent.eventGroup?.event_title) {
            return scrappedEvent.eventGroup.event_title;
        }
        return 'Event Group';
    };

    const formatEventSummary = () => {
        if (scrappedEvent.eventGroup?.event_summary) {
            return scrappedEvent.eventGroup.event_summary.replaceAll("*", "'");
        }
        return '';
    };

    const formatEventYears = () => {
        if (scrappedEvent.eventGroup?.event_years && scrappedEvent.eventGroup.event_years.length > 0) {
            const years = scrappedEvent.eventGroup.event_years.sort((a: number, b: number) => b - a);
            if (years.length === 1) {
                return years[0].toString();
            } else {
                return `${years[years.length - 1]} - ${years[0]}`;
            }
        }
        return null;
    };

    return (
        <div className={`bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow ${isFullView ? 'p-6' : 'p-4'}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="text-blue-500" size={14} />
                    <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
                        {scrappedEvent.subcategory}
                    </span>
                    {formatEventYears() && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {formatEventYears()}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => onRemove(scrappedEvent.id)}
                    disabled={isRemoving}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50 flex-shrink-0"
                    title="Remove from scrapped events"
                >
                    {isRemoving ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                </button>
            </div>

            {/* Figure Info with Profile Picture */}
            <div className="mb-3">
                <Link href={`/${createUrlSlug(scrappedEvent.figureId)}`}>
                    <div className="flex items-center gap-3 hover:text-key-color transition-colors">
                        {/* Profile Picture */}
                        <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                            {figure?.profilePic ? (
                                <Image
                                    src={figure.profilePic}
                                    alt={scrappedEvent.figureName}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                />
                            ) : (
                                <UserIcon size={20} className="text-gray-400" />
                            )}
                        </div>

                        {/* Figure Info */}
                        <div>
                            <h3 className="font-medium text-gray-900 text-sm">
                                {scrappedEvent.figureName}
                            </h3>
                            <p className="text-xs text-gray-500">{scrappedEvent.figureNameKr}</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Event Info */}
            <div className="mb-4">
                <h4 className="font-semibold text-gray-800 mb-1 text-base">
                    {formatEventTitle()}
                </h4>

                {formatEventSummary() && (
                    <p className="text-sm text-gray-600 italic mb-2">
                        {formatEventSummary()}
                    </p>
                )}

                {/* Category Path */}
                <div className="text-xs text-gray-500 mb-2">
                    {scrappedEvent.mainCategory} → {scrappedEvent.subcategory}
                </div>

                {/* Timeline Preview/Toggle */}
                {hasTimelinePoints && (
                    <div className="border-t border-gray-100 pt-3">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            <Clock size={14} />
                            <span>{timelinePoints.length} timeline point{timelinePoints.length !== 1 ? 's' : ''}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {/* Timeline Points with Sources */}
                        {isExpanded && (
                            <div className="mt-3 pl-4 border-l-2 border-gray-100">
                                <div className="relative">
                                    {/* 2. Replaced 'any' with the 'TimelinePoint' type */}
                                    {timelinePoints.map((point: TimelinePoint, index: number) => (
                                        <TimelinePointDisplay
                                            key={index}
                                            point={point}
                                            isLast={index === timelinePoints.length - 1}
                                            articlesMap={articlesMap}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-400">
                    Scrapped {scrappedEvent.scrappedAt.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                    })}
                </div>
                <Link
                    href={`/${scrappedEvent.figureId}${scrappedEvent.eventGroup?.event_title ? `#${slugify(scrappedEvent.eventGroup.event_title)}` : ''}`}
                    className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium py-2 px-3 rounded hover:bg-blue-700 transition-colors"
                >
                    <ExternalLink size={12} />
                    View Timeline
                </Link>
            </div>
        </div>
    );
};

export default function ProfileScrappedSectionEnhanced({
    maxItems = 3,
    isFullView = false,
    isLoading = true, // 2. Use the new props, with default values
    articles = [],
    figureData = new Map(),
    scrappedEvents = [],
    onRemove = () => { }
}: ProfileScrappedSectionEnhancedProps) {
    const [removingId, setRemovingId] = useState<string | null>(null);

    // Create articles map for efficient lookup
    const articlesMap = React.useMemo(() => {
        return new Map<string, Article>(articles.map(article => [article.id, article]));
    }, [articles]);

    const handleRemoveScrappedEvent = async (scrappedEventId: string) => {
        setRemovingId(scrappedEventId);
        await onRemove(scrappedEventId); // Call the function passed from the parent
        setRemovingId(null);
    };

    const displayedEvents = isFullView ? scrappedEvents : scrappedEvents.slice(0, maxItems);

    if (isFullView) {
        // Full view layout for the main scrapped events tab
        return (
            <div className="bg-gray-50 rounded-2xl p-8">
                <div className="hidden md:flex md:flex-row items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Bookmark className="text-blue-500 fill-blue-500" size={24} />
                        <h2 className="text-2xl font-bold text-gray-900">Scrapped Events</h2>
                    </div>
                    <span className="text-sm text-gray-500 bg-gray-200 px-3 py-1 mt-2 md:mt-0 rounded-full">
                        {scrappedEvents.length} event{scrappedEvents.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-gray-400" size={32} />
                    </div>
                ) : scrappedEvents.length === 0 ? (
                    <div className="text-center py-12">
                        <Bookmark className="mx-auto mb-4 text-gray-300" size={64} />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No scrapped events yet</h3>
                        <p className="text-gray-500 text-sm mb-6">Start scrapping events from timelines to see them here</p>
                        <Link
                            href="/all-figures"
                            className="inline-block bg-key-color text-white font-medium py-3 px-6 rounded-full hover:bg-pink-700 transition-colors"
                        >
                            Explore Timelines
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {displayedEvents.map((scrappedEvent) => (
                            <ScrappedEventCard
                                key={scrappedEvent.id}
                                scrappedEvent={scrappedEvent}
                                onRemove={handleRemoveScrappedEvent} // Pass the updated handler
                                isRemoving={removingId === scrappedEvent.id}
                                isFullView={true}
                                articlesMap={articlesMap}
                                figureData={figureData}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Compact view for profile overview
    return (
        <div className="bg-gray-50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Bookmark className="text-blue-500 fill-blue-500" size={24} />
                    <h2 className="text-xl font-bold text-gray-900">Scrapped Events</h2>
                </div>
                {scrappedEvents.length > maxItems && (
                    <span className="text-key-color hover:underline text-sm font-medium cursor-pointer">
                        View All ({scrappedEvents.length})
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
            ) : scrappedEvents.length === 0 ? (
                <div className="text-center py-8">
                    <Bookmark className="mx-auto mb-3 text-gray-300" size={48} />
                    <p className="text-gray-500 text-sm mb-4">No scrapped events yet</p>
                    <Link
                        href="/all-figures"
                        className="inline-block bg-key-color text-white text-sm font-medium py-2 px-4 rounded-full hover:bg-pink-700 transition-colors"
                    >
                        Explore Timelines
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {displayedEvents.map((scrappedEvent) => (
                        <ScrappedEventCard
                            key={scrappedEvent.id}
                            scrappedEvent={scrappedEvent}
                            onRemove={handleRemoveScrappedEvent}
                            isRemoving={removingId === scrappedEvent.id}
                            isFullView={false}
                            articlesMap={articlesMap}
                            figureData={figureData}
                        />
                    ))}

                    {/* Show remaining count and link to full scrapped events tab */}
                    {scrappedEvents.length > maxItems && (
                        <div className="text-center pt-2">
                            <span className="text-key-color hover:underline text-sm cursor-pointer">
                                +{scrappedEvents.length - maxItems} more scrapped events
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}