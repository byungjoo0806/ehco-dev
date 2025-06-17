'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
    Article,
    CuratedTimelineData,
    TimelinePoint
} from '@/types/definitions';

// --- TYPE DEFINITIONS ---
// Here we define the "shape" of all our data to fix the TypeScript errors.

// Props interface for the EventSources component
interface EventSourcesProps {
    articleIds: string[];
    articles: Article[];
}

// Props for our NEW component
interface TimelinePointWithSourcesProps {
    point: TimelinePoint;
    articles: Article[];
    isLast: boolean;
}

// Props interface for the main CuratedTimelineView component
interface CuratedTimelineViewProps {
    data: CuratedTimelineData;
    articles: Article[];
}

const ORDERED_MAIN_CATEGORIES = [
    'Creative Works',
    'Live & Broadcast',
    'Public Relations',
    'Personal Milestones',
    'Incidents & Controversies'
];

const formatTimelineDate = (dateStr: string): string => {
    if (!dateStr) return '';

    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    // Note: JavaScript months are 0-indexed (0=Jan, 11=Dec)
    const month = parts.length > 1 ? parseInt(parts[1]) - 1 : 0;
    const day = parts.length > 2 ? parseInt(parts[2]) : 1;

    // Create a date object in UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month, day));

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        timeZone: 'UTC' // Specify UTC to match the date creation
    };

    if (parts.length > 1) {
        options.month = 'long';
    }
    if (parts.length > 2) {
        options.day = 'numeric';
    }

    return date.toLocaleDateString('en-US', options);
};

const sortTimelinePoints = (points: TimelinePoint[]): TimelinePoint[] => {
    const parseDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        return {
            year: parseInt(parts[0]),
            month: parts.length > 1 ? parseInt(parts[1]) : 1,
            day: parts.length > 2 ? parseInt(parts[2]) : 1,
            specificity: parts.length
        };
    };

    return [...points].sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);

        // 1. Primary sort: Year (descending)
        if (dateA.year !== dateB.year) {
            return dateB.year - dateA.year;
        }

        // Year is the same. Now, handle the new "Year-only" rule.
        // If A is 'YYYY' (specificity 1) and B is not, A should come first.
        if (dateA.specificity === 1 && dateB.specificity > 1) {
            return -1; // Keep a before b
        }
        // If B is 'YYYY' and A is not, B should come first.
        if (dateB.specificity === 1 && dateA.specificity > 1) {
            return 1; // Put b before a
        }

        // If we're here, neither date is "year-only" (or both are), so proceed.
        // 2. Secondary sort: Month (descending)
        if (dateA.month !== dateB.month) {
            return dateB.month - dateA.month;
        }

        // 3. Tertiary sort: Specificity for Month vs Day (less specific first)
        if (dateA.specificity !== dateB.specificity) {
            return dateA.specificity - dateB.specificity;
        }

        // 4. Final sort: Day (descending)
        return dateB.day - dateA.day;
    });
};

// --- COMPONENTS ---

// This component now uses the EventSourcesProps interface
const EventSources: React.FC<EventSourcesProps> = ({ articleIds, articles }) => {
    const relevantArticles = articles.filter(article => articleIds.includes(article.id));

    // A small helper to format the article's sendDate
    const formatArticleDate = (dateString: string | undefined): string => {
        // Return immediately if the string is invalid or not the expected length.
        if (!dateString || dateString.length !== 8) {
            return dateString || '';
        }

        try {
            // Manually parse the 'YYYYMMDD' string.
            const year = parseInt(dateString.substring(0, 4));
            const month = parseInt(dateString.substring(4, 6)) - 1; // JS months are 0-indexed (0=Jan, 11=Dec)
            const day = parseInt(dateString.substring(6, 8));

            // Create a date object in UTC to avoid timezone issues.
            const date = new Date(Date.UTC(year, month, day));

            // Check if the created date is valid.
            if (isNaN(date.getTime())) {
                return dateString; // Return original string if date is invalid
            }

            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC'
            });
        } catch (error) {
            console.error("Could not parse date:", dateString, error);
            return dateString; // On any error, return the original string.
        }
    };

    if (relevantArticles.length === 0) return null;

    return (
        <div className="mt-3 pt-3 border-t border-gray-200/80">
            {/* The grid will now contain our new source cards */}
            <div className="grid grid-cols-1 gap-4">
                {relevantArticles.map(article => (
                    <a
                        key={article.id}
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 border rounded-lg hover:bg-gray-50/80 transition-all duration-200 shadow-sm"
                    >
                        {/* Image Section */}
                        {article.imageUrls?.[0] && (
                            <img
                                src={article.imageUrls[0]}
                                alt={article.subTitle || 'Source image'}
                                className="w-full h-32 sm:w-20 sm:h-20 object-cover rounded-md flex-shrink-0 bg-gray-100"
                            />
                        )}

                        {/* Text Content Section */}
                        <div className="flex flex-col">
                            <h6 className="font-semibold text-sm text-blue-700 hover:underline leading-tight">
                                {article.subTitle || article.title || 'Source Article'}
                            </h6>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                {/* Source Agency */}
                                {article.source && <span>{article.source}</span>}

                                {/* Separator Dot */}
                                {article.source && article.sendDate && <span>&middot;</span>}

                                {/* Publish Date */}
                                {article.sendDate && <time dateTime={article.sendDate}>{formatArticleDate(article.sendDate)}</time>}
                            </div>
                            {article.body && (() => {
                                const parts = article.body.split(' -- ');
                                // Use the part after ' -- ' if it exists, otherwise use the whole body. Trim whitespace.
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

// --- NEW COMPONENT TO MANAGE ITS OWN STATE ---
const TimelinePointWithSources: React.FC<TimelinePointWithSourcesProps> = ({ point, articles, isLast }) => {
    // 1. Each timeline point now has its own state for visibility.
    const [isSourcesVisible, setIsSourcesVisible] = useState(false);

    const hasSources = point.sourceIds && point.sourceIds.length > 0;

    const toggleSources = () => {
        setIsSourcesVisible(prev => !prev);
    };

    return (
        <div className="relative pb-4">
            <div className="absolute w-3 h-3 bg-red-500 rounded-full left-[-20px] top-1 border-2 border-white"></div>
            {!isLast && <div className="absolute w-px h-full bg-gray-200 left-[-14px] top-4"></div>}
            <p className="text-sm font-medium text-gray-500">{formatTimelineDate(point.date)}</p>

            {/* 1. This new div uses Flexbox to position the description and button */}
            <div className="flex justify-between items-start gap-4">
                <p className="text-base text-gray-700">{point.description}</p>

                {/* 2. The button is now inside the flex container and uses icons */}
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

            {/* 3. Conditionally render the sources based on the state */}
            {isSourcesVisible && (
                <EventSources
                    articles={articles}
                    articleIds={point.sourceIds || []}
                />
            )}
        </div>
    );
};

// This component now uses the CuratedTimelineViewProps interface
const CuratedTimelineView: React.FC<CuratedTimelineViewProps> = ({ data, articles }) => {
    const formatCategoryName = (name: string) => name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const mainCategories = useMemo(() => {
        const availableCategories = Object.keys(data);
        return availableCategories.sort((a, b) => {
            const formattedA = formatCategoryName(a);
            const formattedB = formatCategoryName(b);
            return ORDERED_MAIN_CATEGORIES.indexOf(formattedA) - ORDERED_MAIN_CATEGORIES.indexOf(formattedB);
        });
    }, [data]);

    // --- STATE FOR BOTH LAYOUTS ---
    // 1. State for the DESKTOP tab view
    const [activeCategory, setActiveCategory] = useState(mainCategories[0] || '');
    // 2. State for the MOBILE accordion view
    const [openCategories, setOpenCategories] = useState<string[]>([mainCategories[0] || '']);

    // --- HANDLER FOR MOBILE ACCORDION ---
    const handleToggleCategory = (category: string) => {
        setOpenCategories(prevOpen => {
            const isOpen = prevOpen.includes(category);
            return isOpen ? prevOpen.filter(c => c !== category) : [...prevOpen, category];
        });
    };

    return (
        <div className="w-full max-w-[100vw] flex flex-row justify-center">
            <div className='w-[90%] sm:w-[70%] px-2'>

                {/* ================================================================== */}
                {/* --- DESKTOP VIEW (sm screens and up) --- */}
                {/* `hidden sm:block` makes this entire section visible only on desktop */}
                {/* ================================================================== */}
                <div className="hidden sm:block">
                    {/* Main Category Tabs */}
                    <div className="w-full h-12 mt-3 mb-6 py-2 sticky top-16 z-10 bg-white dark:bg-slate-900/95 backdrop-blur-sm dark:border-gray-800">
                        <div className="flex flex-row overflow-x-auto space-x-2 pb-2 hide-scrollbar">
                            {mainCategories.map(category => (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`px-4 py-2 whitespace-nowrap font-medium text-sm transition-colors ${activeCategory === category
                                        ? 'text-red-500 border-b-2 border-red-500'
                                        : 'text-gray-500 hover:text-gray-800'
                                        }`}
                                >
                                    {formatCategoryName(category)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Display for Desktop */}
                    <div className="pb-12">
                        {activeCategory && data[activeCategory] && Object.entries(data[activeCategory]).map(([subCategory, eventList]) => (
                            <div key={subCategory} className="mb-8">
                                <h3 className="text-xl font-bold border-b pb-2 mb-4 text-gray-800">{subCategory}</h3>
                                <div className="space-y-6">
                                    {eventList.map(event => (
                                        <div key={event.event_title} className="p-4 border rounded-lg shadow-sm bg-white">
                                            <h4 className="font-semibold text-lg text-gray-900">{event.event_title}</h4>
                                            <p className="text-sm text-gray-600 italic mt-1 mb-3">{event.event_summary}</p>
                                            <div className="relative pl-5">
                                                {sortTimelinePoints(event.timeline_points).map((point, index) => (
                                                    <TimelinePointWithSources key={index} point={point} articles={articles} isLast={index === event.timeline_points.length - 1} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ================================================================== */}
                {/* --- MOBILE VIEW (screens smaller than sm) --- */}
                {/* `sm:hidden` makes this entire section visible only on mobile */}
                {/* ================================================================== */}
                <div className="sm:hidden">
                    <div className="w-full mt-3 mb-12 space-y-4">
                        {mainCategories.map(category => {
                            const isOpen = openCategories.includes(category);
                            return (
                                <div key={category} className="border border-gray-200/80 rounded-lg shadow-sm overflow-hidden transition-all duration-300">
                                    <button onClick={() => handleToggleCategory(category)} className="w-full flex justify-between items-center px-4 py-3 text-left font-semibold text-gray-800 bg-gray-50/80 hover:bg-gray-100">
                                        <span className='text-lg'>{formatCategoryName(category)}</span>
                                        {isOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 py-5 bg-white border-t border-gray-200/80">
                                            {data[category] && Object.entries(data[category]).map(([subCategory, eventList]) => (
                                                <div key={subCategory} className="mb-8 last:mb-0">
                                                    <h3 className="text-xl font-bold border-b pb-2 mb-4 text-gray-800">{subCategory}</h3>
                                                    <div className="space-y-6">
                                                        {eventList.map(event => (
                                                            <div key={event.event_title} className="p-4 border rounded-lg shadow-sm bg-white">
                                                                <h4 className="font-semibold text-lg text-gray-900">{event.event_title}</h4>
                                                                <p className="text-sm text-gray-600 italic mt-1 mb-3">{event.event_summary}</p>
                                                                <div className="relative pl-5">
                                                                    {sortTimelinePoints(event.timeline_points).map((point, index) => (
                                                                        <TimelinePointWithSources key={index} point={point} articles={articles} isLast={index === event.timeline_points.length - 1} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
            <div className='w-[10%] border-l mt-10 hidden sm:block'></div>
        </div>
    );
};

export default CuratedTimelineView;