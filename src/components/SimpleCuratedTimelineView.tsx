// src/components/SimpleCuratedTimelineView.tsx

'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { CheckSquare, ChevronDown, ChevronUp, Square, Loader2 } from 'lucide-react';
import {
    Article,
    CuratedEvent,
    CuratedTimelineData,
} from '@/types/definitions';
import MainCategorySummary from './MainCategorySummary';
import { useSimpleArticleLoading } from '@/hooks/useSimpleArticleLoading';
import SimpleTimelineEvent from './SimpleTimelineEvent';

interface SimpleCuratedTimelineViewProps {
    data: CuratedTimelineData;
    articles: Article[];
    remainingArticleIds: string[];
    figureId: string;
    figureName: string;
    figureNameKr: string;
}

// --- CONSTANTS ---
const ORDERED_MAIN_CATEGORIES = [
    'Creative Works',
    'Live & Broadcast',
    'Public Relations',
    'Personal Milestones',
    'Incidents & Controversies'
];

const ORDERED_SUB_CATEGORIES: { [key: string]: string[] } = {
    "Creative Works": ["Music", "Film & TV", "Publications & Art", "Awards & Honors"],
    "Live & Broadcast": ["Concerts & Tours", "Fan Events", "Broadcast Appearances"],
    "Public Relations": ["Media Interviews", "Endorsements & Ambassadors", "Social & Digital"],
    "Personal Milestones": ["Relationships & Family", "Health & Service", "Education & Growth"],
    "Incidents & Controversies": ["Legal & Scandal", "Accidents & Emergencies", "Public Backlash"]
};

// --- HELPER FUNCTIONS ---
const formatCategoryForURL = (name: string) => name.toLowerCase().replace(/ & /g, '-and-').replace(/[ &]/g, '-');

const getCategoryFromSlug = (slug: string | null): string => {
    if (!slug) return '';
    return ORDERED_MAIN_CATEGORIES.find(cat => formatCategoryForURL(cat) === slug) || '';
};

const getSubCategoryFromSlug = (slug: string | null, mainCategory: string): string => {
    if (!slug || !mainCategory || !ORDERED_SUB_CATEGORIES[mainCategory]) return '';
    const subCategories = ORDERED_SUB_CATEGORIES[mainCategory];
    return subCategories.find(subCat => formatCategoryForURL(subCat) === slug) || '';
};

const slugify = (text: string) =>
    text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

// --- CHILD COMPONENTS ---

// Year filter
const YearFilter: React.FC<{
    years: number[];
    selectedYears: number[];
    onToggleYear: (year: number) => void;
    onSelectAll: () => void;
}> = ({ years, selectedYears, onToggleYear, onSelectAll }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const buttonText = selectedYears.length === 0
        ? 'All Years'
        : `${selectedYears.length} year${selectedYears.length > 1 ? 's' : ''} selected`;

    return (
        <div className='relative p-4 border-b border-gray-200' ref={dropdownRef}>
            <label className="font-semibold text-sm mb-2 block text-gray-800">Filter by Year</label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-2 text-black border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-key-color focus:border-key-color transition-colors flex justify-between items-center"
            >
                <span>{buttonText}</span>
                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <ul className="py-1">
                        <li
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                            onClick={onSelectAll}
                        >
                            {selectedYears.length === 0 ? (
                                <CheckSquare className="mr-2 h-5 w-5 text-key-color" />
                            ) : (
                                <Square className="mr-2 h-5 w-5 text-gray-400" />
                            )}
                            <span className="text-gray-800">All Years</span>
                        </li>
                        {years.map(year => (
                            <li
                                key={year}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                                onClick={() => onToggleYear(year)}
                            >
                                {selectedYears.includes(year) ? (
                                    <CheckSquare className="mr-2 h-5 w-5 text-key-color" />
                                ) : (
                                    <Square className="mr-2 h-5 w-5 text-gray-400" />
                                )}
                                <span className="text-gray-800">{year}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// Navigation component for events in the current view
const EventNavigator: React.FC<{ eventList: CuratedEvent[], onNavigate: (id: string) => void }> = ({ eventList, onNavigate }) => {
    if (!eventList || eventList.length === 0) {
        return <div className="p-3 text-center text-xs text-gray-500">No events in this section.</div>;
    }

    return (
        <div className="w-full">
            <h3 className="font-semibold text-sm p-3 text-gray-800 border-b border-gray-200">On This Page</h3>
            <nav>
                <ul className="py-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    {eventList.map((event, index) => (
                        <li key={`nav-${index}-${event.event_title}`}>
                            <button
                                onClick={() => onNavigate(slugify(event.event_title))}
                                className="w-full text-left text-sm px-3 py-2.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200 rounded-md"
                            >
                                {event.event_title}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
};

// Load More Button Component
const LoadMoreButton: React.FC<{
    isLoading: boolean;
    hasMore: boolean;
    loadedCount: number;
    totalCount: number;
    onLoadMore: () => void;
    error: string | null;
}> = ({ isLoading, hasMore, loadedCount, totalCount, onLoadMore, error }) => {
    if (!hasMore && !error) return null;

    return (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg text-center">
            {error ? (
                <div className="text-red-600">
                    <p className="font-medium">Error loading articles</p>
                    <p className="text-sm mt-1">{error}</p>
                    <button
                        onClick={onLoadMore}
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            ) : hasMore ? (
                <div>
                    <p className="text-gray-600 mb-4">
                        Loaded {loadedCount} of {totalCount} sources
                    </p>
                    <button
                        onClick={onLoadMore}
                        disabled={isLoading}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 mx-auto"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Loading More Sources...
                            </>
                        ) : (
                            `Load More Sources (${totalCount - loadedCount} remaining)`
                        )}
                    </button>
                </div>
            ) : (
                <p className="text-green-600 font-medium">All sources loaded!</p>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const SimpleCuratedTimelineView: React.FC<SimpleCuratedTimelineViewProps> = ({
    data,
    articles,
    remainingArticleIds,
    figureId,
    figureName,
    figureNameKr
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Initialize article loading
    const {
        articles: allArticles,
        isLoading,
        hasMore,
        loadedCount,
        totalCount,
        loadMore,
        error
    } = useSimpleArticleLoading({
        initialArticles: articles,
        remainingArticleIds,
        figureId,
        batchSize: 50
    });

    const mainCategories = useMemo(() => {
        const availableCategories = Object.keys(data);
        return ORDERED_MAIN_CATEGORIES.filter(c => availableCategories.includes(c));
    }, [data]);

    const urlActiveCategory = useMemo(() => {
        const catFromUrl = getCategoryFromSlug(searchParams.get('category'));
        return mainCategories.includes(catFromUrl) ? catFromUrl : mainCategories[0] || '';
    }, [searchParams, mainCategories]);

    const urlActiveSubCategory = useMemo(() => {
        return getSubCategoryFromSlug(searchParams.get('subCategory'), urlActiveCategory);
    }, [searchParams, urlActiveCategory]);

    const [localActiveCategory, setLocalActiveCategory] = useState(urlActiveCategory);
    const [localActiveSubCategory, setLocalActiveSubCategory] = useState(urlActiveSubCategory);
    const [selectedYears, setSelectedYears] = useState<number[]>([]);
    const [openEvents, setOpenEvents] = useState<string[]>([]);
    const [openCategories, setOpenCategories] = useState<string[]>([localActiveCategory]);

    useEffect(() => {
        setLocalActiveCategory(urlActiveCategory);
        setLocalActiveSubCategory(urlActiveSubCategory);
    }, [urlActiveCategory, urlActiveSubCategory]);

    const getAvailableSubCategories = useCallback((category: string) => {
        if (!category || !data[category] || !data[category].subCategories) return [];
        const subCategoryKeys = Object.keys(data[category].subCategories);
        const ordered = ORDERED_SUB_CATEGORIES[category] || [];
        return ordered.filter(sc => subCategoryKeys.includes(sc));
    }, [data]);

    const availableYears = useMemo(() => {
        const yearSet = new Set<number>();
        Object.values(data).forEach(mainCatData => {
            if (mainCatData && mainCatData.subCategories) {
                Object.values(mainCatData.subCategories).forEach(events => {
                    events.forEach(event => {
                        event.event_years?.forEach(year => yearSet.add(year));
                    });
                });
            }
        });
        return Array.from(yearSet).sort((a, b) => b - a);
    }, [data]);

    const handleSelectCategory = useCallback((category: string, subCategory?: string) => {
        setLocalActiveCategory(category);
        if (subCategory) {
            setLocalActiveSubCategory(subCategory);
        } else {
            const availableSubCats = getAvailableSubCategories(category);
            setLocalActiveSubCategory(availableSubCats[0] || '');
        }

        const params = new URLSearchParams(searchParams.toString());
        params.set('category', formatCategoryForURL(category));
        if (subCategory) {
            params.set('subCategory', formatCategoryForURL(subCategory));
        } else {
            const availableSubCats = getAvailableSubCategories(category);
            if (availableSubCats.length > 0) {
                params.set('subCategory', formatCategoryForURL(availableSubCats[0]));
            } else {
                params.delete('subCategory');
            }
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [pathname, router, searchParams, getAvailableSubCategories]);

    const handleToggleYear = (year: number) => {
        setSelectedYears(prev =>
            prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
        );
    };

    const handleSelectAllYears = () => {
        setSelectedYears([]);
    };

    const handleToggleCategory = (category: string) => {
        const isCurrentlyOpen = openCategories.includes(category);

        if (isCurrentlyOpen) {
            setOpenCategories([]);
            setLocalActiveCategory('');
            setLocalActiveSubCategory('');
        } else {
            setOpenCategories([category]);
            handleSelectCategory(category);
        }
    };

    const handleToggleEvent = useCallback((eventTitle: string) => {
        const eventId = slugify(eventTitle);
        setOpenEvents(prevOpen => {
            const isOpen = prevOpen.includes(eventId);
            return isOpen ? prevOpen.filter(id => id !== eventId) : [...prevOpen, eventId];
        });
    }, []);

    const displayedContent = useMemo(() => {
        if (!localActiveCategory || !localActiveSubCategory || !data[localActiveCategory]?.subCategories?.[localActiveSubCategory]) {
            return null;
        }

        let events = data[localActiveCategory].subCategories[localActiveSubCategory];

        if (selectedYears.length > 0) {
            events = events.filter(event =>
                event.event_years?.some(year => selectedYears.includes(year))
            );
        }

        return { [localActiveSubCategory]: events };
    }, [localActiveCategory, localActiveSubCategory, data, selectedYears]);

    // Memoize the list of events for the navigator
    const eventListForNavigator = useMemo(() => {
        if (!localActiveCategory || !localActiveSubCategory || !data[localActiveCategory]?.subCategories?.[localActiveSubCategory]) {
            return [];
        }

        let events = data[localActiveCategory].subCategories[localActiveSubCategory];

        if (selectedYears.length > 0) {
            events = events.filter(event =>
                event.event_years?.some(year => selectedYears.includes(year))
            );
        }

        return events;
    }, [localActiveCategory, localActiveSubCategory, data, selectedYears]);

    // Handler for smooth scrolling
    const handleEventNavigation = (id: string) => {
        history.replaceState(null, '', `#${id}`);
        const element = document.getElementById(id);
        element?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    };

    return (
        <div className="w-full max-w-[100vw] flex flex-row justify-start">
            {/* Sticky Left Navigation */}
            <div className='hidden sm:flex w-[25%] max-w-xs flex-col'>
                <div className="sticky top-16 self-start w-full h-fit overflow-y-auto border-r border-gray-200 bg-white">
                    <YearFilter
                        years={availableYears}
                        selectedYears={selectedYears}
                        onToggleYear={handleToggleYear}
                        onSelectAll={handleSelectAllYears}
                    />
                    <div className='p-2'>
                        <EventNavigator eventList={eventListForNavigator} onNavigate={handleEventNavigation} />
                    </div>
                </div>
            </div>

            <div className='w-full sm:w-[75%] px-2 sm:px-8'>
                {/* DESKTOP VIEW */}
                <div className="hidden sm:block">
                    <div id="timeline-sticky-header" className="w-full mt-3 mb-6 sticky top-16 z-10 bg-white/80 backdrop-blur-sm">
                        <div className="flex flex-row flex-wrap gap-x-2 gap-y-1 pb-2 border-b border-gray-200">
                            {mainCategories.map(category => (
                                <button key={category} onClick={() => handleSelectCategory(category)} className={`px-4 py-2 whitespace-nowrap font-medium text-sm transition-colors ${localActiveCategory === category ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-800'}`}>
                                    {category}
                                </button>
                            ))}
                        </div>

                        {localActiveCategory && data[localActiveCategory] && (
                            <MainCategorySummary content={data[localActiveCategory].description} />
                        )}

                        {getAvailableSubCategories(localActiveCategory).length > 0 && (
                            <div className="flex flex-row overflow-x-auto space-x-2 py-2 hide-scrollbar border-b border-gray-200">
                                {getAvailableSubCategories(localActiveCategory).map(subCategory => (
                                    <button key={subCategory} onClick={() => handleSelectCategory(localActiveCategory, subCategory)} className={`px-3 py-1.5 whitespace-nowrap text-xs font-medium rounded-full transition-colors ${localActiveSubCategory === subCategory ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {subCategory}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Timeline content */}
                    <div className="pb-12">
                        {displayedContent && Object.entries(displayedContent).map(([subCategory, eventList]) => (
                            <div key={subCategory} className="space-y-8">
                                {eventList.map((event, eventIndex) => (
                                    <SimpleTimelineEvent
                                        key={`${localActiveCategory}-${localActiveSubCategory}-${eventIndex}`}
                                        event={event}
                                        eventIndex={eventIndex}
                                        figureId={figureId}
                                        figureName={figureName}
                                        figureNameKr={figureNameKr}
                                        mainCategory={localActiveCategory}
                                        subcategory={localActiveSubCategory}
                                        articles={allArticles}
                                    />
                                ))}
                            </div>
                        ))}

                        {/* Load More Button */}
                        <LoadMoreButton
                            isLoading={isLoading}
                            hasMore={hasMore}
                            loadedCount={loadedCount}
                            totalCount={totalCount}
                            onLoadMore={loadMore}
                            error={error}
                        />

                        {!displayedContent && localActiveCategory && (
                            <div className="text-center py-12 text-gray-500">
                                <p>Select a subcategory to view events.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* MOBILE VIEW */}
                <div className="sm:hidden">
                    <div className="w-full mt-3 mb-12 space-y-4">
                        {mainCategories.map(category => {
                            const isOpen = openCategories.includes(category);
                            const availableSubCats = getAvailableSubCategories(category);

                            return (
                                <div key={category} className="border border-gray-200/80 rounded-lg shadow-sm overflow-hidden transition-all duration-300">
                                    <button onClick={() => handleToggleCategory(category)} className="w-full flex justify-between items-center px-4 py-3 text-left font-semibold text-gray-800 bg-gray-50/80 hover:bg-gray-100">
                                        <span className='text-lg'>{category}</span>
                                        {isOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 pt-4 pb-2 bg-white border-t border-gray-200/80">
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {availableSubCats.map(subCat => (
                                                    <button
                                                        key={subCat}
                                                        onClick={(e) => { e.stopPropagation(); handleSelectCategory(category, subCat); }}
                                                        className={`px-3 py-1.5 whitespace-nowrap text-xs font-medium rounded-full transition-colors ${localActiveCategory === category && localActiveSubCategory === subCat
                                                            ? 'bg-key-color text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {subCat}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Mobile timeline */}
                                            {localActiveCategory === category && displayedContent && (
                                                <div className="space-y-6 pt-4 border-t border-gray-200/80">
                                                    {Object.values(displayedContent)[0].map((event, eventIndex) => {
                                                        const isEventOpen = openEvents.includes(slugify(event.event_title));
                                                        return (
                                                            <div key={`${localActiveCategory}-${localActiveSubCategory}-${eventIndex}`} className="border rounded-lg overflow-hidden bg-white">
                                                                <button
                                                                    onClick={() => handleToggleEvent(event.event_title)}
                                                                    className="w-full flex justify-between items-center p-4 text-left"
                                                                >
                                                                    <h4 className="font-semibold text-base text-gray-800 pr-4">{event.event_title}</h4>
                                                                    {isEventOpen ? <ChevronUp size={20} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={20} className="text-gray-500 flex-shrink-0" />}
                                                                </button>

                                                                {isEventOpen && (
                                                                    <div className="px-4 pb-4">
                                                                        <SimpleTimelineEvent
                                                                            event={event}
                                                                            eventIndex={eventIndex}
                                                                            figureId={figureId}
                                                                            figureName={figureName}
                                                                            figureNameKr={figureNameKr}
                                                                            mainCategory={localActiveCategory}
                                                                            subcategory={localActiveSubCategory}
                                                                            articles={allArticles}
                                                                            className="border-none shadow-none p-0 bg-transparent"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Load More Button for Mobile */}
                                                    <LoadMoreButton
                                                        isLoading={isLoading}
                                                        hasMore={hasMore}
                                                        loadedCount={loadedCount}
                                                        totalCount={totalCount}
                                                        onLoadMore={loadMore}
                                                        error={error}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SimpleCuratedTimelineView;