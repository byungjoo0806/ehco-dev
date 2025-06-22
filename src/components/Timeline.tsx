'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

// Interfaces
interface ArticleSummaryData {
    id: string;
    event_contents?: Record<string, string>;
    subCategory?: string;
    category?: string;
    content?: string;
    title?: string;
}

interface WikiContentItem {
    id: string;
    category: string;
    subcategory?: string;
    content: string;
    articleIds: string[];
}

interface ArticleData {
    id: string;
    subTitle: string;
    body: string;
    source: string;
    link: string;
    imageUrls: string[];
    sendDate: string;
}

interface Event {
    id: string;
    date: string;
    content: string;
    category: string;
    subcategory?: string;
    title?: string;
    originalId?: string;
}

interface TimelineProps {
    articleSummaries: ArticleSummaryData[];
    categoryContent: WikiContentItem[];
    selectedCategory: string;
    selectedSubcategories: string[];
    articles: ArticleData[];
}

// ArticleCard component for Timeline
const TimelineArticleCard: React.FC<{ article: ArticleData }> = ({ article }) => {
    const firstImage = article.imageUrls?.[0] || '';
    // const caption = article.imageCaptions?.[0] || '';

    const formatDate = (dateStr: string) => {
        if (dateStr.length === 8) {
            return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        }
        return dateStr;
    };

    const formattedDate = formatDate(article.sendDate);

    return (
        <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full"
        >
            <div className="flex h-24">
                {firstImage && (
                    <div className="w-20 h-full relative flex-shrink-0">
                        <img
                            src={firstImage}
                            alt={"article image"}
                            className="object-cover w-full h-full"
                        />
                    </div>
                )}
                <div className="p-2 flex-1 overflow-hidden">
                    <div className="text-xs font-medium text-gray-500 mb-1 truncate">
                        {article.source} • {formattedDate}
                    </div>
                    <h4 className="font-medium text-sm mb-1 line-clamp-1">
                        {article.subTitle}
                    </h4>
                    <p className="text-xs text-gray-600 line-clamp-2">
                        {article.body}
                    </p>
                </div>
            </div>
        </a>
    );
};

// Enhanced SourceSwiper component for Timeline with toggle and count
interface TimelineSourceSwiperProps {
    articles: ArticleData[];
    eventId: string;
}

const TimelineSourceSwiper: React.FC<TimelineSourceSwiperProps> = ({ articles, eventId }) => {
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const prevRef = React.useRef<HTMLDivElement>(null);
    const nextRef = React.useRef<HTMLDivElement>(null);

    if (!articles || articles.length === 0) return null;

    return (
        <div className="mt-4">
            {/* Sources Header with Toggle and Count */}
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={() => setIsVisible(!isVisible)}
                    className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                    <span>Sources ({articles.length})</span>
                    <svg
                        className={`w-4 h-4 transition-transform ${isVisible ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {/* Sources Content */}
            {isVisible && (
                <div className="relative">
                    {articles.length === 1 ? (
                        // Single source - no swiper needed
                        <div className="pb-2">
                            <TimelineArticleCard article={articles[0]} />
                        </div>
                    ) : (
                        // Multiple sources - use swiper
                        <Swiper
                            slidesPerView={1}
                            spaceBetween={16}
                            modules={[Navigation]}
                            onInit={(swiper) => {
                                // @ts-expect-error Swiper navigation params are not properly typed
                                swiper.params.navigation.prevEl = prevRef.current;
                                // @ts-expect-error Swiper navigation params are not properly typed
                                swiper.params.navigation.nextEl = nextRef.current;
                                swiper.navigation.init();
                                swiper.navigation.update();
                            }}
                            breakpoints={{
                                640: { slidesPerView: 2, spaceBetween: 20 },
                                768: { slidesPerView: 2, spaceBetween: 30 },
                            }}
                            className="sources-swiper pb-10"
                        >
                            {articles.map((article) => (
                                <SwiperSlide key={article.id} className="h-auto">
                                    <TimelineArticleCard article={article} />
                                </SwiperSlide>
                            ))}

                            {/* Custom Navigation Buttons */}
                            <div
                                ref={prevRef}
                                className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full shadow-md w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-50"
                            >
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </div>
                            <div
                                ref={nextRef}
                                className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full shadow-md w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-50"
                            >
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </Swiper>
                    )}
                </div>
            )}
        </div>
    );
};

// Parse date string to determine its granularity
const parseDateGranularity = (dateStr: string): {
    level: 'year' | 'year-month' | 'year-month-day',
    year: number,
    month?: number,
    day?: number
} => {
    const parts = dateStr.split('-');

    if (parts.length === 1) {
        return { level: 'year', year: parseInt(parts[0]) };
    } else if (parts.length === 2) {
        return {
            level: 'year-month',
            year: parseInt(parts[0]),
            month: parseInt(parts[1])
        };
    } else if (parts.length === 3) {
        return {
            level: 'year-month-day',
            year: parseInt(parts[0]),
            month: parseInt(parts[1]),
            day: parseInt(parts[2])
        };
    }

    // Fallback for any other format
    return { level: 'year', year: new Date(dateStr).getFullYear() };
};

interface EventItemProps {
    event: Event;
    index: number;
    isLastInGroup: boolean;
    eventArticles: ArticleData[];
    showFullDate?: boolean;
    indentLevel?: number;
}

const EventItem: React.FC<EventItemProps> = ({
    event,
    index,
    isLastInGroup,
    eventArticles,
    showFullDate = true,
    indentLevel = 0
}) => {

    const formatDate = (dateStr: string) => {
        if (!showFullDate) return '';

        const dateInfo = parseDateGranularity(dateStr);
        if (dateInfo.level === 'year-month-day') {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit'
            });
        }
        return '';
    };

    return (
        <div className="relative pl-6">
            {/* Event dot with line */}
            <div className="absolute w-2 h-2 bg-red-500 rounded-full left-0 top-2"></div>
            {/* {!isLastInGroup && (
                <div className="absolute w-px h-full bg-gray-200 left-1" style={{ top: '10px' }}></div>
            )} */}

            {/* Event content */}
            <div className='mt-2'>
                {showFullDate && formatDate(event.date) && (
                    <div className="text-sm text-gray-500">
                        {formatDate(event.date)}
                    </div>
                )}
                {/* <div className="font-medium">
                    {event.subcategory && (
                        <span className="mr-2">{event.subcategory}.</span>
                    )} */}
                {/* If it's a combined event (with newlines in content), don't show content in the header,
                        as it will be shown in the body. Otherwise, show the first line of content or title */}
                {/* {event.content?.includes('\n\n')
                        ? 'Multiple Events'
                        : (event.title || event.content?.split('\n')[0])}
                </div> */}

                {/* Show event content - split by line breaks for multiple events */}
                {event.content && event.content.trim() && (
                    <div className="mt-1">
                        {event.content.split('\n\n').map((contentItem, idx) => (
                            <p key={idx} className="text-base text-gray-600 mb-2">
                                {contentItem}
                            </p>
                        ))}
                    </div>
                )}

                {/* Enhanced Source display with toggle and count */}
                {eventArticles.length > 0 && (
                    <TimelineSourceSwiper articles={eventArticles} eventId={event.id} />
                )}
            </div>
        </div>
    );
};

const Timeline: React.FC<TimelineProps> = ({
    articleSummaries,
    categoryContent,
    selectedCategory,
    selectedSubcategories,
    articles
}) => {
    const [selectedYears, setSelectedYears] = useState<string[]>([]);

    // Process article summaries into timeline events
    const timelineEvents = useMemo(() => {
        // Use a Map to group events by date
        const eventsByDate = new Map<string, { events: Event[]; articleIds: Set<string>; }>();

        articleSummaries.forEach(summary => {
            let articleCategory = '';
            let articleSubcategory = '';

            if (selectedCategory === 'Overview') {
                const wikiItem = categoryContent.find(content =>
                    content.articleIds.includes(summary.id)
                );
                if (wikiItem) {
                    articleCategory = wikiItem.category;
                    articleSubcategory = wikiItem.subcategory || '';
                }
            } else {
                articleCategory = selectedCategory;
                const wikiItem = categoryContent.find(content =>
                    content.category === selectedCategory &&
                    content.articleIds.includes(summary.id) &&
                    (selectedSubcategories.length === 0 ||
                        (content.subcategory && selectedSubcategories.includes(content.subcategory)))
                );
                if (wikiItem) {
                    articleSubcategory = wikiItem.subcategory || '';
                }
            }

            if (selectedCategory === 'Overview' ||
                (articleCategory === selectedCategory &&
                    (selectedSubcategories.length === 0 ||
                        (articleSubcategory && selectedSubcategories.includes(articleSubcategory))))) {

                // Using event_contents instead of event_dates
                if (summary.event_contents) {
                    Object.entries(summary.event_contents).forEach(([date, eventContent]) => {
                        if (!eventsByDate.has(date)) {
                            eventsByDate.set(date, {
                                events: [],
                                articleIds: new Set<string>()
                            });
                        }

                        const dateGroup = eventsByDate.get(date)!;
                        dateGroup.articleIds.add(summary.id);

                        dateGroup.events.push({
                            id: `${summary.id}-${date}`,
                            date,
                            // Use the event content as the primary text
                            content: eventContent || '',
                            category: articleCategory,
                            subcategory: articleSubcategory,
                            title: summary.title, // This will be used as fallback
                            originalId: summary.id
                        });
                    });
                }
            }
        });

        // Convert the Map to an array of events
        const events: Event[] = [];
        eventsByDate.forEach(({ events: dateEvents }, date) => {
            // Group events by same date
            if (dateEvents.length === 1) {
                // Just one event for this date
                events.push(dateEvents[0]);
            } else {
                // Multiple events for this date - create a "merged" event
                const articleIds = dateEvents.map(e => e.originalId || '');
                events.push({
                    id: `combined-${date}-${articleIds.join('-')}`,
                    date,
                    // Combine all event contents with line breaks (will be displayed as separate lines)
                    content: dateEvents.map(e => e.content).join('\n\n'),
                    category: dateEvents[0].category,
                    subcategory: dateEvents[0].subcategory,
                    originalId: JSON.stringify(articleIds) // Store all article IDs as a JSON string
                });
            }
        });

        return events.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB.getTime() - dateA.getTime();
        });
    }, [articleSummaries, categoryContent, selectedCategory, selectedSubcategories]);

    // Get available years from events
    const availableYears = useMemo(() => {
        const years = new Set<string>();
        timelineEvents.forEach(event => {
            const dateInfo = parseDateGranularity(event.date);
            years.add(dateInfo.year.toString());
        });
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    }, [timelineEvents]);

    // Initialize selected years to include all available years
    useEffect(() => {
        if (selectedYears.length === 0 && availableYears.length > 0) {
            setSelectedYears(availableYears);
        }
    }, [availableYears]);

    // Group events by year
    const eventsByYear = useMemo(() => {
        const groups: {
            [year: string]: {
                yearEvents: Event[],
                monthEvents: {
                    [month: string]: {
                        monthEvents: Event[],
                        dayEvents: Event[]
                    }
                }
            }
        } = {};

        timelineEvents.forEach(event => {
            const dateInfo = parseDateGranularity(event.date);
            const yearKey = dateInfo.year.toString();

            if (!groups[yearKey]) {
                groups[yearKey] = {
                    yearEvents: [],
                    monthEvents: {}
                };
            }

            if (dateInfo.level === 'year') {
                groups[yearKey].yearEvents.push(event);
            } else if (dateInfo.level === 'year-month') {
                const monthKey = dateInfo.month!.toString();
                if (!groups[yearKey].monthEvents[monthKey]) {
                    groups[yearKey].monthEvents[monthKey] = {
                        monthEvents: [],
                        dayEvents: []
                    };
                }
                groups[yearKey].monthEvents[monthKey].monthEvents.push(event);
            } else if (dateInfo.level === 'year-month-day') {
                const monthKey = dateInfo.month!.toString();
                if (!groups[yearKey].monthEvents[monthKey]) {
                    groups[yearKey].monthEvents[monthKey] = {
                        monthEvents: [],
                        dayEvents: []
                    };
                }
                groups[yearKey].monthEvents[monthKey].dayEvents.push(event);
            }
        });

        return groups;
    }, [timelineEvents]);

    // Handle year selection
    const handleYearSelect = (year: string) => {
        setSelectedYears(prev => {
            const isSelected = prev.includes(year);
            if (isSelected) {
                return prev.filter(y => y !== year);
            } else {
                return [...prev, year];
            }
        });
    };

    const handleYearSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
        setSelectedYears(selectedOptions);
    };

    // Handle select/deselect all years
    const handleToggleAllYears = () => {
        if (selectedYears.length === availableYears.length) {
            setSelectedYears([]);
        } else {
            setSelectedYears(availableYears);
        }
    };

    // Get articles for a specific event
    const getEventArticles = (event: Event): ArticleData[] => {
        try {
            // Check if this is a combined event with multiple article IDs
            if (event.originalId && event.originalId.startsWith('[')) {
                // Parse the JSON array of article IDs
                const articleIds = JSON.parse(event.originalId) as string[];
                // Find all matching articles
                return articles.filter(article => articleIds.includes(article.id));
            } else {
                // Single article event
                const articleId = event.originalId || event.id.split('-').slice(0, -2).join('-');
                const matchingArticle = articles.find(article => article.id === articleId);
                return matchingArticle ? [matchingArticle] : [];
            }
        } catch (error) {
            console.error('Error parsing article IDs:', error);
            return [];
        }
    };

    // Filter displayed years based on selection
    const displayedYearData = Object.entries(eventsByYear)
        .filter(([year]) => selectedYears.includes(year))
        .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA));

    return (
        <div className="mt-8">
            <div className="rounded-md">
                <h2 className="text-lg font-medium mb-4">
                    Timeline
                </h2>

                {/* NEW: Flexbox container for the two-column layout */}
                <div className="flex flex-col sm:flex-row gap-8">

                    {/* --- LEFT COLUMN: YEAR FILTERS --- */}
                    <div className="w-full sm:w-48 flex-shrink-0">
                        <div className="sticky top-24"> {/* Makes the filter stick on scroll */}
                            <h3 className="font-semibold text-gray-700 mb-3">Years</h3>
                            <div className="flex flex-row sm:flex-col flex-wrap sm:flex-nowrap gap-2">
                                <button
                                    onClick={handleToggleAllYears}
                                    className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${selectedYears.length === availableYears.length
                                        ? 'bg-red-500 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                >
                                    All Years
                                </button>
                                {availableYears.map(year => (
                                    <button
                                        key={year}
                                        onClick={() => handleYearSelect(year)}
                                        className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${selectedYears.includes(year)
                                            ? 'bg-red-500 text-white'
                                            : 'bg-gray-100 hover:bg-gray-200'
                                            }`}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* --- RIGHT COLUMN: TIMELINE EVENTS --- */}
                    <div className="flex-grow w-full">
                        <div className="space-y-8">
                            {displayedYearData.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    Select years to view timeline events
                                </div>
                            ) : (
                                displayedYearData.map(([year, yearData]) => (
                                    <div key={year}>
                                        <div className="relative">
                                            {/* Year label */}
                                            <div className="bg-red-500 text-white px-2 py-1 rounded-full text-sm inline-block mb-4">
                                                {year}
                                            </div>

                                            <div className="space-y-4">
                                                {/* Year-only events */}
                                                {yearData.yearEvents.map((event, index) => (
                                                    <EventItem
                                                        key={event.id}
                                                        event={event}
                                                        index={index}
                                                        isLastInGroup={index === yearData.yearEvents.length - 1}
                                                        eventArticles={getEventArticles(event)}
                                                        showFullDate={false}
                                                    />
                                                ))}

                                                {/* Month-level events */}
                                                {Object.entries(yearData.monthEvents)
                                                    .sort(([monthA], [monthB]) => parseInt(monthB) - parseInt(monthA))
                                                    .map(([month, monthData]) => (
                                                        <div key={`${year}-${month}`}>
                                                            {/* Month header */}
                                                            {monthData.monthEvents.length > 0 && (
                                                                <div className="text-sm font-medium text-gray-700 mb-2">
                                                                    {new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' })}
                                                                </div>
                                                            )}

                                                            {/* Month-only events */}
                                                            {monthData.monthEvents.map((event, index) => (
                                                                <EventItem
                                                                    key={event.id}
                                                                    event={event}
                                                                    index={index}
                                                                    isLastInGroup={index === monthData.monthEvents.length - 1}
                                                                    eventArticles={getEventArticles(event)}
                                                                    showFullDate={false}
                                                                    indentLevel={1}
                                                                />
                                                            ))}

                                                            {/* Day-level events */}
                                                            {monthData.dayEvents.map((event, index) => (
                                                                <EventItem
                                                                    key={event.id}
                                                                    event={event}
                                                                    index={index}
                                                                    isLastInGroup={index === monthData.dayEvents.length - 1}
                                                                    eventArticles={getEventArticles(event)}
                                                                    showFullDate={true}
                                                                    indentLevel={1}
                                                                />
                                                            ))}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Timeline;