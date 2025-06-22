'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { CheckSquare, ChevronDown, ChevronUp, Square } from 'lucide-react';
import {
    Article,
    CuratedEvent,
    CuratedTimelineData,
    TimelinePoint
} from '@/types/definitions';

// --- TYPE DEFINITIONS ---
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

// Helper to create URL-safe IDs from titles
const slugify = (text: string) =>
    text
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w-]+/g, ''); // Remove all non-word chars

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

    // Handle click outside to close the dropdown
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
        <div className='relative p-4 border-b border-gray-200 dark:border-gray-700/60' ref={dropdownRef}>
            <label className="font-semibold text-sm mb-2 block text-gray-800 dark:text-gray-200">Filter by Year</label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-2 border border-gray-300 rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors flex justify-between items-center"
            >
                <span>{buttonText}</span>
                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <ul className="py-1">
                        <li
                            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                            onClick={onSelectAll}
                        >
                            {selectedYears.length === 0 ? (
                                <CheckSquare className="mr-2 h-5 w-5 text-red-500" />
                            ) : (
                                <Square className="mr-2 h-5 w-5 text-gray-400" />
                            )}
                            <span className="text-gray-800 dark:text-gray-200">All Years</span>
                        </li>
                        {years.map(year => (
                            <li
                                key={year}
                                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                                onClick={() => onToggleYear(year)}
                            >
                                {selectedYears.includes(year) ? (
                                    <CheckSquare className="mr-2 h-5 w-5 text-red-500" />
                                ) : (
                                    <Square className="mr-2 h-5 w-5 text-gray-400" />
                                )}
                                <span className="text-gray-800 dark:text-gray-200">{year}</span>
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
        return <div className="p-3 text-center text-xs text-gray-500 dark:text-gray-400">No events in this section.</div>;
    }

    return (
        <div className="w-full">
            <h3 className="font-semibold text-sm p-3 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">On This Page</h3>
            <nav>
                <ul className="py-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    {eventList.map(event => (
                        <li key={event.event_title}>
                            <button
                                onClick={() => onNavigate(slugify(event.event_title))}
                                className="w-full text-left text-sm px-3 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200 transition-colors duration-200 rounded-md"
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


const EventSources: React.FC<EventSourcesProps> = ({ articleIds, articlesMap }) => {
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
        const dataCopy: CuratedTimelineData = JSON.parse(JSON.stringify(data));
        for (const mainCategory in dataCopy) {
            for (const subCategory in dataCopy[mainCategory]) {
                const eventList = dataCopy[mainCategory][subCategory];
                eventList.forEach((event) => {
                    event.timeline_points = sortTimelinePoints(event.timeline_points);
                });
            }
        }
        return dataCopy;
    }, [data]);

    const articlesMap = useMemo(() => {
        return new Map<string, Article>(articles.map(article => [article.id, article]));
    }, [articles]);

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

    useEffect(() => {
        setLocalActiveCategory(urlActiveCategory);
        setLocalActiveSubCategory(urlActiveSubCategory);
    }, [urlActiveCategory, urlActiveSubCategory]);

    const [openCategories, setOpenCategories] = useState<string[]>([localActiveCategory]);

    const getAvailableSubCategories = useCallback((category: string) => {
        if (!category || !processedData[category]) return [];
        const subCategoryKeys = Object.keys(processedData[category]);
        const ordered = ORDERED_SUB_CATEGORIES[category] || [];
        return ordered.filter(sc => subCategoryKeys.includes(sc));
    }, [processedData]);

    const availableYears = useMemo(() => {
        const yearSet = new Set<number>();
        Object.values(processedData).forEach(subCategories => {
            Object.values(subCategories).forEach(events => {
                events.forEach(event => {
                    event.event_years?.forEach(year => yearSet.add(year));
                });
            });
        });
        return Array.from(yearSet).sort((a, b) => b - a);
    }, [processedData]);

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

    useEffect(() => {
        const availableSubCategories = getAvailableSubCategories(localActiveCategory);
        const currentSubCategoryIsValid = availableSubCategories.includes(localActiveSubCategory);
        if (localActiveCategory && !currentSubCategoryIsValid && availableSubCategories.length > 0) {
            handleSelectCategory(localActiveCategory, availableSubCategories[0]);
        }
    }, [localActiveCategory, localActiveSubCategory, getAvailableSubCategories, handleSelectCategory]);


    const handleToggleCategory = (category: string) => {
        if (!openCategories.includes(category)) {
            handleSelectCategory(category);
        }
        setOpenCategories(prevOpen => {
            const isOpen = prevOpen.includes(category);
            return isOpen ? prevOpen.filter(c => c !== category) : [...prevOpen, category];
        });
    };

    const displayedContent = useMemo(() => {
        if (!localActiveCategory || !localActiveSubCategory || !processedData[localActiveCategory]?.[localActiveSubCategory]) {
            return null;
        }
        
        let events = processedData[localActiveCategory][localActiveSubCategory];
        
        if (selectedYears.length > 0) {
            events = events.filter(event => 
                event.event_years?.some(year => selectedYears.includes(year))
            );
        }
        
        return { [localActiveSubCategory]: events };
    }, [localActiveCategory, localActiveSubCategory, processedData, selectedYears]);

    // Memoize the list of events for the navigator
    const eventListForNavigator = useMemo(() => {
        if (!displayedContent) return [];
        return Object.values(displayedContent)[0] || [];
    }, [displayedContent]);

    // Handler for smooth scrolling
    const handleEventNavigation = (id: string) => {
        const element = document.getElementById(id);
        element?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    };

    return (
        <div className="w-full max-w-[100vw] flex flex-row justify-start dark:bg-gray-800">
            {/* ================================================================== */}
            {/* --- Sticky Left Navigation ---                                     */}
            {/* ================================================================== */}
            <div className='hidden sm:flex w-[25%] max-w-xs flex-col'>
                <div className="sticky top-16 self-start w-full h-screen overflow-y-auto border-r border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800">
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

                {/* ================================================================== */}
                {/* --- DESKTOP VIEW (sm screens and up) ---                           */}
                {/* ================================================================== */}
                <div className="hidden sm:block">
                    <div className="w-full mt-3 mb-6 sticky top-16 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
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
                            <div key={subCategory} className="space-y-8">
                                {eventList.map(event => (
                                    // MODIFIED: Added id and scroll-mt for navigation
                                    <div id={slugify(event.event_title)} key={event.event_title} className="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-700 scroll-mt-40">
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
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {availableSubCats.map(subCat => (
                                                    <button
                                                        key={subCat}
                                                        onClick={(e) => { e.stopPropagation(); handleSelectCategory(category, subCat); }}
                                                        className={`px-3 py-1.5 whitespace-nowrap text-xs font-medium rounded-full transition-colors ${localActiveCategory === category && localActiveSubCategory === subCat
                                                            ? 'bg-red-500 text-white'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                                            }`}
                                                    >
                                                        {subCat}
                                                    </button>
                                                ))}
                                            </div>

                                            {localActiveCategory === category && displayedContent && (
                                                <div className="space-y-6 pt-4 border-t border-gray-200/80">
                                                    {Object.values(displayedContent)[0].map(event => (
                                                        // FIXED: Added id and scroll-mt for navigation on mobile
                                                        <div id={slugify(event.event_title)} key={event.event_title} className="p-4 border rounded-lg shadow-sm bg-white dark:bg-gray-600 scroll-mt-16">
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
        </div>
    );
};

export default CuratedTimelineView;
