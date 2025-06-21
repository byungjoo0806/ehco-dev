'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
    Article,
    CuratedTimelineData,
    TimelinePoint
} from '@/types/definitions';

// --- TYPE DEFINITIONS ---
// (No changes here)
interface EventSourcesProps {
    articleIds: string[];
    articlesMap: Map<string, Article>;
}

interface TimelinePointWithSourcesProps {
    point: TimelinePoint;
    isLast: boolean;
    articlesMap: Map<string, Article>;
}

interface CuratedTimelineViewProps {
    data: CuratedTimelineData;
    articles: Article[];
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
// (No changes here)
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

const sortTimelinePoints = (points: TimelinePoint[]): TimelinePoint[] => {
    const parseDate = (dateStr: string) => ({
        year: parseInt(dateStr.split('-')[0]),
        month: dateStr.split('-').length > 1 ? parseInt(dateStr.split('-')[1]) : 1,
        day: dateStr.split('-').length > 2 ? parseInt(dateStr.split('-')[2]) : 1,
        specificity: dateStr.split('-').length
    });
    return [...points].sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        if (dateA.year !== dateB.year) return dateB.year - dateA.year;
        if (dateA.specificity === 1 && dateB.specificity > 1) return -1;
        if (dateB.specificity === 1 && dateA.specificity > 1) return 1;
        if (dateA.month !== dateB.month) return dateB.month - dateA.month;
        if (dateA.specificity !== dateB.specificity) return dateA.specificity - dateB.specificity;
        return dateB.day - dateA.day;
    });
};

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


// --- CHILD COMPONENTS ---
// (No changes here)
const EventSources: React.FC<EventSourcesProps> = ({ articleIds, articlesMap }) => {
    const relevantArticles = articleIds
        .map(id => articlesMap.get(id))
        .filter(Boolean) as Article[];
    // We'll sort by 'sendDate' from newest to oldest.
    // The 'YYYYMMDD' format allows for simple string comparison.
    relevantArticles.sort((a, b) => {
        if (!a.sendDate) return 1; // Articles without a date go to the end
        if (!b.sendDate) return -1;
        return b.sendDate.localeCompare(a.sendDate); // 'b' vs 'a' for descending order (newest first)
    });
    const formatArticleDate = (dateString: string | undefined): string => {
        if (!dateString || dateString.length !== 8) return dateString || '';
        try {
            const year = parseInt(dateString.substring(0, 4)), month = parseInt(dateString.substring(4, 6)) - 1, day = parseInt(dateString.substring(6, 8));
            const date = new Date(Date.UTC(year, month, day));
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        } catch (error) { console.error("Could not parse date:", dateString, error); return dateString; }
    };
    if (relevantArticles.length === 0) return null;
    return (
        <div className="mt-3 pt-3 border-t border-gray-200/80 "><div className="grid grid-cols-1 gap-4">
            {relevantArticles.map(article => (
                <a key={article.id} href={article.link} target="_blank" rel="noopener noreferrer" className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 border rounded-lg hover:bg-gray-50/80 transition-all duration-200 shadow-sm dark:bg-gray-400 dark:hover:bg-gray-300">
                    {article.imageUrls?.[0] && (<img src={article.imageUrls[0]} alt={article.subTitle || 'Source image'} className="w-full h-32 sm:w-20 sm:h-20 object-cover rounded-md flex-shrink-0 bg-gray-100" />)}
                    <div className="flex flex-col">
                        <h6 className="font-semibold text-sm text-blue-700 hover:underline leading-tight">{article.subTitle || article.title || 'Source Article'}</h6>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            {article.source && <span>{article.source}</span>}
                            {article.source && article.sendDate && <span>&middot;</span>}
                            {article.sendDate && <time dateTime={article.sendDate}>{formatArticleDate(article.sendDate)}</time>}
                        </div>
                        {article.body && (() => { const parts = article.body.split(' -- '), mainContent = (parts.length > 1 ? parts[1] : parts[0]).trim(); return <p className="text-xs text-gray-600 mt-2 leading-relaxed">{mainContent.substring(0, 120)}...</p>; })()}
                    </div>
                </a>
            ))}
        </div></div>
    );
};

const TimelinePointWithSources: React.FC<TimelinePointWithSourcesProps> = ({ point, isLast, articlesMap }) => {
    const [isSourcesVisible, setIsSourcesVisible] = useState(false);
    const hasSources = point.sourceIds && point.sourceIds.length > 0;
    const toggleSources = () => setIsSourcesVisible(prev => !prev);
    return (
        <div className="relative pb-4">
            <div className="absolute w-3 h-3 bg-red-500 rounded-full left-[-20px] top-1 border-2 border-white dark:border-none"></div>
            {!isLast && <div className="absolute w-px h-full bg-gray-200 left-[-14px] top-4"></div>}
            <p className="text-sm font-medium text-gray-500 dark:text-gray-200">{formatTimelineDate(point.date)}</p>
            <div className="flex justify-between items-start gap-4">
                <p className="text-base text-gray-700 dark:text-gray-300">{point.description}</p>
                {hasSources && (<button onClick={toggleSources} className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0" aria-label="Toggle sources">{isSourcesVisible ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>)}
            </div>
            {isSourcesVisible && <EventSources articlesMap={articlesMap} articleIds={point.sourceIds || []} />}
        </div>
    );
};


// --- MAIN COMPONENT ---
const CuratedTimelineView: React.FC<CuratedTimelineViewProps> = ({ data, articles }) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const processedData: CuratedTimelineData = useMemo(() => {
        // This deep copy is important to avoid changing the original 'data' prop, which is a best practice in React.
        const dataCopy: CuratedTimelineData = JSON.parse(JSON.stringify(data));

        // Now, we iterate through the data just once and sort all the timeline_points arrays.
        for (const mainCategory in dataCopy) {
            for (const subCategory in dataCopy[mainCategory]) {
                const eventList = dataCopy[mainCategory][subCategory];
                eventList.forEach((event) => {
                    // We replace the original array with the newly sorted one.
                    event.timeline_points = sortTimelinePoints(event.timeline_points);
                });
            }
        }
        return dataCopy;
    }, [data]); // The hook only re-runs if the initial 'data' prop itself changes.

    const articlesMap = useMemo(() => {
        // We create a new Map where each article's 'id' is the key and the article object is the value.
        // This allows for instantaneous lookups instead of slow filtering.
        return new Map<string, Article>(articles.map(article => [article.id, article]));
    }, [articles]); // This only re-runs if the initial 'articles' prop changes.

    const mainCategories = useMemo(() => {
        const availableCategories = Object.keys(data);
        return ORDERED_MAIN_CATEGORIES.filter(c => availableCategories.includes(c));
    }, [data]);

    // We still derive the "true" active category from the URL.
    // This will be our source of truth for initialization and for reacting to browser back/forward buttons.
    const urlActiveCategory = useMemo(() => {
        const catFromUrl = getCategoryFromSlug(searchParams.get('category'));
        return mainCategories.includes(catFromUrl) ? catFromUrl : mainCategories[0] || '';
    }, [searchParams, mainCategories]);

    const urlActiveSubCategory = useMemo(() => {
        return getSubCategoryFromSlug(searchParams.get('subCategory'), urlActiveCategory);
    }, [searchParams, urlActiveCategory]);

    // NEW: Local state for INSTANT UI updates.
    // Initialize it with the values from the URL.
    const [localActiveCategory, setLocalActiveCategory] = useState(urlActiveCategory);
    const [localActiveSubCategory, setLocalActiveSubCategory] = useState(urlActiveSubCategory);

    // NEW: Effect to sync local state if the URL changes externally (e.g., back/forward button).
    useEffect(() => {
        setLocalActiveCategory(urlActiveCategory);
        setLocalActiveSubCategory(urlActiveSubCategory);
    }, [urlActiveCategory, urlActiveSubCategory]);

    // (openCategories state remains the same, but let's initialize it with the local state)
    const [openCategories, setOpenCategories] = useState<string[]>([localActiveCategory]);

    const getAvailableSubCategories = useCallback((category: string) => {
        if (!category || !processedData[category]) return [];
        const subCategoryKeys = Object.keys(processedData[category]);
        const ordered = ORDERED_SUB_CATEGORIES[category] || [];
        return ordered.filter(sc => subCategoryKeys.includes(sc));
    }, [processedData]);

    const handleSelectCategory = useCallback((category: string, subCategory?: string) => {
        // --- THIS IS THE KEY CHANGE ---
        // 1. Update the local state IMMEDIATELY for an instant UI change.
        setLocalActiveCategory(category);
        if (subCategory) {
            setLocalActiveSubCategory(subCategory);
        } else {
            // If no subcategory is provided, select the first available one.
            const availableSubCats = getAvailableSubCategories(category);
            setLocalActiveSubCategory(availableSubCats[0] || '');
        }

        // 2. Update the URL in the background.
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
        // Use router.replace to avoid cluttering browser history with tab clicks
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    }, [pathname, router, searchParams, getAvailableSubCategories]); // Added getAvailableSubCategories dependency

    useEffect(() => {
        const availableSubCategories = getAvailableSubCategories(localActiveCategory);
        const currentSubCategoryIsValid = availableSubCategories.includes(localActiveSubCategory);
        if (localActiveCategory && !currentSubCategoryIsValid && availableSubCategories.length > 0) {
            handleSelectCategory(localActiveCategory, availableSubCategories[0]);
        }
    }, [localActiveCategory, localActiveSubCategory, getAvailableSubCategories, handleSelectCategory]);


    const handleToggleCategory = (category: string) => {
        // When opening an accordion, also set it as the active category in the URL
        if (!openCategories.includes(category)) {
            handleSelectCategory(category);
        }
        setOpenCategories(prevOpen => {
            const isOpen = prevOpen.includes(category);
            return isOpen ? prevOpen.filter(c => c !== category) : [...prevOpen, category];
        });
    };

    const displayedContent = useMemo(() => {
        if (!localActiveCategory || !localActiveSubCategory || !processedData[localActiveCategory] || !processedData[localActiveCategory][localActiveSubCategory]) {
            return null;
        }
        return { [localActiveSubCategory]: processedData[localActiveCategory][localActiveSubCategory] };
    }, [localActiveCategory, localActiveSubCategory, processedData]);

    return (
        <div className="w-full max-w-[100vw] flex flex-row justify-center dark:bg-gray-800">
            <div className='w-[90%] sm:w-[70%] px-2'>

                {/* ================================================================== */}
                {/* --- DESKTOP VIEW (sm screens and up) ---                           */}
                {/* ================================================================== */}
                <div className="hidden sm:block">
                    <div className="w-full mt-3 mb-6 sticky top-16 z-10 bg-white dark:bg-slate-800 backdrop-blur-sm">
                        <div className="flex flex-row overflow-x-auto space-x-2 pb-2 hide-scrollbar border-b border-gray-200 dark:border-gray-600">
                            {mainCategories.map(category => (
                                <button key={category} onClick={() => handleSelectCategory(category)} className={`px-4 py-2 whitespace-nowrap font-medium text-sm transition-colors ${localActiveCategory === category ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}`}>
                                    {category}
                                </button>
                            ))}
                        </div>
                        {getAvailableSubCategories(localActiveCategory).length > 0 && (
                            <div className="flex flex-row overflow-x-auto space-x-2 py-2 hide-scrollbar border-b border-gray-200 dark:border-gray-600">
                                {getAvailableSubCategories(localActiveCategory).map(subCategory => (
                                    <button key={subCategory} onClick={() => handleSelectCategory(localActiveCategory, subCategory)} className={`px-3 py-1.5 whitespace-nowrap text-xs font-medium rounded-full transition-colors ${localActiveSubCategory === subCategory ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>
                                        {subCategory}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="pb-12">
                        {displayedContent && Object.entries(displayedContent).map(([subCategory, eventList]) => (
                            <div key={subCategory} className="space-y-6">
                                {eventList.map(event => (
                                    <div key={event.event_title} className="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-600">
                                        <h4 className="font-semibold text-lg text-gray-900 dark:text-white">{event.event_title}</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-200 italic mt-1 mb-3">{event.event_summary}</p>
                                        <div className="relative pl-5">
                                            {event.timeline_points.map((point, index) => (<TimelinePointWithSources key={index} point={point} articlesMap={articlesMap} isLast={index === event.timeline_points.length - 1} />))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {!displayedContent && localActiveCategory && (
                            <div className="text-center py-12 text-gray-500"><p>Select a subcategory to view events.</p></div>
                        )}
                    </div>
                </div>

                {/* ================================================================== */}
                {/* --- MOBILE VIEW (screens smaller than sm) ---                      */}
                {/* ================================================================== */}
                <div className="sm:hidden">
                    <div className="w-full mt-3 mb-12 space-y-4">
                        {mainCategories.map(category => {
                            const isOpen = openCategories.includes(category);
                            const availableSubCats = getAvailableSubCategories(category);

                            return (
                                <div key={category} className="border border-gray-200/80 rounded-lg shadow-sm overflow-hidden transition-all duration-300">
                                    <button onClick={() => handleToggleCategory(category)} className="w-full flex justify-between items-center px-4 py-3 text-left font-semibold text-gray-800 bg-gray-50/80 hover:bg-gray-100 dark:text-gray-400 dark:bg-slate-500 dark:hover:bg-slate-300">
                                        <span className='text-lg dark:text-gray-300'>{category}</span>
                                        {isOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 pt-4 pb-2 bg-white dark:bg-slate-500 border-t border-gray-200/80">
                                            {/* NEW: Subcategory tabs for mobile */}
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {availableSubCats.map(subCat => (
                                                    <button
                                                        key={subCat}
                                                        onClick={() => handleSelectCategory(category, subCat)}
                                                        className={`px-3 py-1.5 whitespace-nowrap text-xs font-medium rounded-full transition-colors ${localActiveCategory === category && localActiveSubCategory === subCat
                                                            ? 'bg-key-color text-white dark:text-gray-100'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                                            }`}
                                                    >
                                                        {subCat}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* NEW: Conditional content rendering based on active category and subcategory */}
                                            {localActiveCategory === category && displayedContent && (
                                                <div className="space-y-6 pt-4 border-t border-gray-200/80">
                                                    {Object.values(displayedContent)[0].map(event => (
                                                        <div key={event.event_title} className="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-600">
                                                            <h4 className="font-semibold text-lg text-gray-900 dark:text-white">{event.event_title}</h4>
                                                            <p className="text-sm text-gray-600 italic mt-1 mb-3 dark:text-gray-200">{event.event_summary}</p>
                                                            <div className="relative pl-5">
                                                                {event.timeline_points.map((point, index) => (
                                                                    <TimelinePointWithSources key={index} point={point} articlesMap={articlesMap} isLast={index === event.timeline_points.length - 1} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
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
            <div className='w-[10%] border-l mt-10 hidden sm:block'></div>
        </div>
    );
};

export default CuratedTimelineView;