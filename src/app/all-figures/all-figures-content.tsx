// app/all-figures/all-figures-content.tsx

// This component is interactive and uses hooks, so it must be a Client Component.
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Search, X, Loader2, CheckSquare, Square } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import algoliasearch from 'algoliasearch';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Image from 'next/image';
import { createUrlSlug } from '@/lib/slugify';

// Setup Algolia client
const searchClient = algoliasearch(
    "B1QF6MLIU5",
    "ef0535bdd12e549ffa7c9541395432a1"
);

// --- Component-Specific Interfaces ---
interface Figure {
    id: string;
    name: string;
    profilePic?: string;
    occupation?: string[];
    gender?: string;
    categories?: string[];
}

interface FiguresQueryResult {
    figures: Figure[];
    totalPages: number;
    totalCount: number;
}

type AlgoliaPublicFigure = {
    objectID: string;
    name?: string;
    profilePic?: string;
    occupation?: string[];
    gender?: string;
    categories?: string[];
};

const CATEGORY_ORDER = [
    'Male', 'Female', 'Group', 'South Korean', 'Singer', 'Singer-Songwriter',
    'Film Director', 'Rapper', 'Actor', 'Actress'
];

const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600" size={24} />
            <span className="text-slate-600 font-medium">Loading...</span>
        </div>
    </div>
);

export default function AllFiguresContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // --- State Management ---
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);

    const categories = [
        'All', 'Male', 'Female', 'Group', 'Singer', 'Singer-Songwriter',
        'Film Director', 'Rapper', 'Actor', 'Actress', 'South Korean'
    ];

    const categoryToFieldMap: Record<string, { field: string, value: string }[]> = {
        'Male': [{ field: 'gender', value: 'Male' }],
        'Female': [{ field: 'gender', value: 'Female' }],
        'Group': [{ field: 'gender', value: 'Group' }],
        'Singer': [{ field: 'occupation', value: 'Singer' }],
        'Singer-Songwriter': [{ field: 'occupation', value: 'Singer-Songwriter' }],
        'Film Director': [{ field: 'occupation', value: 'Film Director' }],
        'Rapper': [{ field: 'occupation', value: 'Rapper' }],
        'Actor': [{ field: 'occupation', value: 'Actor' }],
        'Actress': [{ field: 'occupation', value: 'Actress' }],
        'South Korean': [{ field: 'nationality', value: 'South Korean' }]
    };

    // --- Data Fetching with React Query ---
    const {
        isLoading,
        isFetching,
        isError,
        error,
        data,
    } = useQuery<FiguresQueryResult, Error>({
        queryKey: ['allFigures', { selectedCategories, currentPage, searchQuery }],
        queryFn: async () => {
            const itemsPerPage = 18;
            if (searchQuery.trim()) {
                // Algolia search logic
                const { hits, nbHits, nbPages } = await searchClient.initIndex('selected-figures').search<AlgoliaPublicFigure>(searchQuery, {
                    hitsPerPage: itemsPerPage,
                    page: currentPage - 1,
                });
                const transformedResults: Figure[] = hits.map(hit => ({
                    id: hit.objectID, name: hit.name || '', profilePic: hit.profilePic, occupation: hit.occupation || [], gender: hit.gender, categories: hit.categories
                }));
                return { figures: transformedResults, totalPages: nbPages, totalCount: nbHits };
            } else {
                // Backend API fetching logic
                const params = new URLSearchParams({
                    page: currentPage.toString(),
                    pageSize: itemsPerPage.toString(),
                });

                if (selectedCategories.length > 0 && !selectedCategories.includes('All')) {
                    const fieldFilters: Record<string, string[]> = {};
                    selectedCategories.forEach(category => {
                        const mappings = categoryToFieldMap[category];
                        if (mappings) {
                            mappings.forEach(mapping => {
                                fieldFilters[mapping.field] = fieldFilters[mapping.field] || [];
                                if (!fieldFilters[mapping.field].includes(mapping.value)) {
                                    fieldFilters[mapping.field].push(mapping.value);
                                }
                            });
                        }
                    });
                    Object.entries(fieldFilters).forEach(([field, values]) => {
                        values.forEach(value => params.append(field, value));
                    });
                }

                const response = await fetch(`/api/public-figures?${params}`);
                if (!response.ok) throw new Error(await response.text());
                const jsonData = await response.json();
                return {
                    figures: jsonData.publicFigures || [],
                    totalPages: jsonData.totalPages || 1,
                    totalCount: jsonData.totalCount || 0,
                };
            }
        },
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Derived state from useQuery for cleaner rendering
    const figures = data?.figures || [];
    const totalPages = data?.totalPages || 1;
    const totalCount = data?.totalCount || 0;
    const isSearchMode = !!searchQuery.trim();

    // --- Side Effects ---
    // Handle click outside to close the category dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setShowCategoryDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Check if device is mobile on mount and resize
    useEffect(() => {
        const checkIfMobile = () => setIsMobile(window.innerWidth < 640);
        checkIfMobile();
        window.addEventListener('resize', checkIfMobile);
        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);

    // Initialize state from URL on initial load
    useEffect(() => {
        const initialCategories = searchParams.getAll('category');
        const initialSearch = searchParams.get('search') || '';
        const initialPage = parseInt(searchParams.get('page') || '1');

        setSelectedCategories(initialCategories.length > 0 ? initialCategories : ['All']);
        setSearchQuery(initialSearch);
        setCurrentPage(Math.max(1, initialPage));
    }, [searchParams]); // This effect now correctly depends only on searchParams

    // --- Event Handlers and Callbacks ---
    const updateURL = useCallback((newCategories: string[], newSearchQuery: string = '', newPage: number = 1) => {
        const params = new URLSearchParams();
        if (newCategories.length > 0 && !newCategories.includes('All')) {
            const sortedCategories = newCategories.sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
            sortedCategories.forEach(cat => params.append('category', cat));
        }
        if (newSearchQuery.trim()) {
            params.set('search', newSearchQuery);
        }
        if (newPage > 1) {
            params.set('page', newPage.toString());
        }
        router.replace(`/all-figures?${params.toString()}`, { scroll: false });
    }, [router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        setCurrentPage(1);
        updateURL(selectedCategories, query, 1);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            updateURL(selectedCategories, searchQuery, newPage);
        }
    };

    const handleCategoryChange = useCallback((category: string) => {
        const newCategories = selectedCategories.includes('All')
            ? [category]
            : selectedCategories.includes(category)
                ? selectedCategories.filter(c => c !== category)
                : [...selectedCategories, category];

        const finalCategories = newCategories.length === 0 ? ['All'] : newCategories;
        setSelectedCategories(finalCategories);
        setCurrentPage(1);
        updateURL(finalCategories, searchQuery, 1);
    }, [selectedCategories, searchQuery, updateURL]);

    const clearAllFilters = () => {
        setSelectedCategories(['All']);
        setSearchQuery('');
        setCurrentPage(1);
        router.replace('/all-figures', { scroll: false });
    };

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = isMobile ? 3 : 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    // --- Render Logic ---
    return (
        <div className="min-h-screen bg-white">
            <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900">
                    All Figures
                </h1>

                {/* Filters and Search Bar */}
                <div className="mb-6 sm:mb-8 space-y-4">
                    {/* Search Input */}
                    <div className="relative w-full max-w-xl mx-auto">
                        <input
                            type="text"
                            placeholder="Search for a public figure..."
                            value={searchQuery}
                            onChange={handleInputChange}
                            className="w-full px-4 sm:px-6 py-2.5 sm:py-3 text-base border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 pl-10 sm:pl-12 text-black"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-key-color" />
                        {searchQuery && (
                            <X
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                                size={20}
                                onClick={() => handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)}
                            />
                        )}
                    </div>

                    {/* Category Filter */}
                    <div className="flex justify-center items-center gap-2 relative" ref={categoryDropdownRef}>
                        <label className="text-gray-700 whitespace-nowrap">Categories:</label>
                        <div className="relative">
                            <button
                                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                className="bg-white border-2 border-key-color rounded-full px-4 py-1 text-left flex items-center justify-between focus:outline-none w-48"
                            >
                                <span className="truncate text-gray-700">
                                    {selectedCategories.includes('All') ? 'All Categories' : `${selectedCategories.length} selected`}
                                </span>
                                <svg className={`fill-current h-4 w-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </button>
                            {showCategoryDropdown && (
                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    <ul className="py-1">
                                        {categories.map(category => (
                                            <li key={category} className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center" onClick={() => handleCategoryChange(category)}>
                                                {selectedCategories.includes(category) ? <CheckSquare className="mr-2 h-5 w-5 text-key-color" /> : <Square className="mr-2 h-5 w-5 text-gray-400" />}
                                                <span className="text-gray-800">{category}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Filters Display */}
                    <div className="flex flex-wrap justify-center items-center gap-2 min-h-[32px]">
                        {!selectedCategories.includes('All') && selectedCategories.map(category => (
                            <div key={category} className="bg-key-color text-white px-3 py-1 rounded-full text-sm flex items-center gap-1 cursor-pointer" onClick={() => handleCategoryChange(category)}>
                                <span>{category}</span><X className="h-4 w-4" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Clear Filters Button */}
                {(!selectedCategories.includes('All') || searchQuery) && (
                    <div className="flex justify-center mb-6">
                        <button onClick={clearAllFilters} className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors">
                            Clear all filters
                        </button>
                    </div>
                )}


                {/* Main Content Area */}
                {isLoading && (
                    <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-key-color mx-auto"></div><p className="mt-4 text-gray-600">Loading figures...</p></div>
                )}
                {isError && (
                    <div className="text-center py-12 text-red-600">{error.message}</div>
                )}
                {!isLoading && !isError && figures.length > 0 && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12">
                            {figures.map((figure) => (
                                <Link href={`/${createUrlSlug(figure.id)}`} key={figure.id} className="flex flex-col items-center group">
                                    <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-40 lg:h-40 relative mb-3 rounded-full overflow-hidden border-2 border-gray-200 group-hover:border-key-color transition-colors">
                                        <Image src={figure.profilePic || '/images/default-profile.png'} alt={figure.name} fill sizes="(max-width: 640px) 6rem, 10rem" className="object-cover" priority />
                                    </div>
                                    <span className="text-center text-gray-900 font-medium text-sm sm:text-base truncate w-full">{figure.name}</span>
                                    {figure.occupation?.[0] && <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">{figure.occupation[0]}</span>}
                                </Link>
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-1 sm:gap-2 flex-wrap">
                                <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="px-2 py-1 text-gray-600 disabled:opacity-50" aria-label="First page">«</button>
                                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-2 py-1 text-gray-600 disabled:opacity-50" aria-label="Previous page">‹</button>
                                {getPageNumbers().map(page => (
                                    <button key={page} onClick={() => handlePageChange(page)} className={`px-3 py-1 rounded-full ${currentPage === page ? 'bg-key-color text-white' : 'text-gray-600 hover:bg-gray-100'}`} aria-label={`Page ${page}`} aria-current={currentPage === page ? 'page' : undefined}>{page}</button>
                                ))}
                                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-2 py-1 text-gray-600 disabled:opacity-50" aria-label="Next page">›</button>
                                <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 text-gray-600 disabled:opacity-50" aria-label="Last page">»</button>
                            </div>
                        )}
                        <div className="text-center mt-4 text-sm text-gray-500">
                            Showing {figures.length} of {totalCount} figures | Page {currentPage} of {totalPages}
                        </div>
                    </>
                )}
                {!isLoading && figures.length === 0 && (
                    <div className="text-center py-12 text-gray-600">{isSearchMode ? `No figures found for "${searchQuery}"` : 'No figures match the selected categories'}</div>
                )}
            </main>
            {isFetching && !isLoading && <LoadingOverlay />}
        </div>
    );
}
