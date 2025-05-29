'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, X, Loader2, CheckSquare, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';
import algoliasearch from 'algoliasearch';

// Setup Algolia client - same as in page.tsx
const searchClient = algoliasearch(
    "B1QF6MLIU5",
    "ef0535bdd12e549ffa7c9541395432a1"
);

// Updated interface to include gender and categories
interface Figure {
    id: string;
    name: string;
    profilePic?: string;
    occupation?: string[];
    gender?: string;      // Added gender field
    categories?: string[]; // Added categories field
}

// Updated Algolia type to include gender and categories
type AlgoliaPublicFigure = {
    objectID: string;
    name?: string;
    name_kr?: string;
    profilePic?: string;
    occupation?: string[];
    gender?: string;      // Added gender field
    categories?: string[]; // Added categories field
    _highlightResult?: {
        name?: {
            value: string;
            matchLevel: string;
            matchedWords: string[];
        };
        name_kr?: {
            value: string;
            matchLevel: string;
            matchedWords: string[];
        };
    };
}

const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
            <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
        </div>
    </div>
);

export default function AllFiguresPage() {
    const [figures, setFigures] = useState<Figure[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']); // Default to 'All'
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [sortBy, setSortBy] = useState('A-Z');
    const [isMobile, setIsMobile] = useState(false);
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Categories from the API
    const categories = [
        'All', 'Singer', 'Female', 'Male', 'Korean', 'Actor', 'Celebrity',
        'K-pop', 'Music', 'Actress', 'Entertainment', 'Fashion', 'Sports',
        'Beauty', 'Dance', 'Artist', 'Comedy', 'Model', 'Performance',
        'Talent Show', 'Rapper', 'Vocalist', 'Film', 'Television', 'DJ'
    ];

    // Map category selections to search fields
    // This helps translate user-facing categories to backend fields
    const categoryToFieldMap: Record<string, { field: string, value: string }[]> = {
        'Female': [{ field: 'gender', value: 'Female' }, { field: 'occupation', value: 'Girl Group' }],
        'Male': [{ field: 'gender', value: 'Male' }, { field: 'occupation', value: 'Boy Group' }],
        'Singer': [{ field: 'categories', value: 'Singer' }],
        'Korean': [{ field: 'categories', value: 'Korean' }],
        'Actor': [{ field: 'categories', value: 'Actor' }],
        'Actress': [{ field: 'categories', value: 'Actress' }],
        'K-pop': [{ field: 'categories', value: 'K-pop' }],
        // Add mappings for other categories...
    };

    const itemsPerPage = 18;

    // Handle click outside to close the dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setShowCategoryDropdown(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Check if device is mobile
    useEffect(() => {
        const checkIfMobile = () => {
            setIsMobile(window.innerWidth < 640);
        };

        // Initial check
        checkIfMobile();

        // Add event listener
        window.addEventListener('resize', checkIfMobile);

        // Cleanup
        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);

    useEffect(() => {
        if (!isSearchMode) {
            fetchFigures(1);
        }
    }, [selectedCategories, sortBy, isSearchMode]); // Refetch when categories or sort changes

    // Helper function to build category filters for the API
    const buildCategoryParams = (params: URLSearchParams) => {
        if (selectedCategories.length > 0 && !selectedCategories.includes('All')) {
            // Group parameters by field type
            const fieldFilters: Record<string, string[]> = {};

            selectedCategories.forEach(category => {
                const mappings = categoryToFieldMap[category];
                if (mappings) {
                    mappings.forEach(mapping => {
                        if (!fieldFilters[mapping.field]) {
                            fieldFilters[mapping.field] = [];
                        }
                        fieldFilters[mapping.field].push(mapping.value);
                    });
                } else {
                    // Fallback for categories without explicit mapping
                    if (!fieldFilters['categories']) {
                        fieldFilters['categories'] = [];
                    }
                    fieldFilters['categories'].push(category);
                }
            });

            // Add each field filter to params
            Object.entries(fieldFilters).forEach(([field, values]) => {
                values.forEach(value => {
                    params.append(field, value);
                });
            });
        }
        return params;
    };

    const fetchFigures = async (page: number) => {
        try {
            setLoading(true);
            let params = new URLSearchParams({
                page: page.toString(),
                pageSize: itemsPerPage.toString(),
            });

            // Add category filters
            params = buildCategoryParams(params);

            if (searchQuery && !isSearchMode) {
                params.append('search', searchQuery);
            }

            params.append('sort', sortBy.toLowerCase().replace('-', ''));

            const response = await fetch(`/api/public-figures?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            setFigures(data.publicFigures || []);
            setCurrentPage(data.currentPage || page);
            setTotalPages(data.totalPages || 1);
            setTotalCount(data.totalCount || 0);

        } catch (err) {
            console.error('Fetch error:', err);
            if (err instanceof Error) {
                setError(`Failed to load figures: ${err.message}`);
            } else {
                setError('Failed to load figures: Unknown error');
            }
        } finally {
            setLoading(false);
        }
    };

    // Build Algolia filter string from selected categories
    const buildAlgoliaFilterString = () => {
        if (selectedCategories.length === 0 || selectedCategories.includes('All')) {
            return '';
        }

        const filterConditions: string[] = [];

        // Group conditions by field for OR within same field type
        const fieldConditions: Record<string, string[]> = {};

        selectedCategories.forEach(category => {
            const mappings = categoryToFieldMap[category];
            if (mappings) {
                mappings.forEach(mapping => {
                    if (!fieldConditions[mapping.field]) {
                        fieldConditions[mapping.field] = [];
                    }
                    fieldConditions[mapping.field].push(`${mapping.field}:"${mapping.value}"`);
                });
            } else {
                // Fallback for categories without explicit mapping
                if (!fieldConditions['categories']) {
                    fieldConditions['categories'] = [];
                }
                fieldConditions['categories'].push(`categories:"${category}"`);
            }
        });

        // For each field type, join conditions with OR
        Object.values(fieldConditions).forEach(conditions => {
            if (conditions.length > 0) {
                filterConditions.push(`(${conditions.join(' OR ')})`);
            }
        });

        // Join different field types with AND
        return filterConditions.join(' AND ');
    };

    // Algolia search functionality for grid
    const performSearchForGrid = async (query: string) => {
        if (!query.trim()) {
            setIsSearchMode(false);
            fetchFigures(1);
            return;
        }

        setIsSearchMode(true);
        setLoading(true);

        try {
            // Create filter string for categories
            const filterString = buildAlgoliaFilterString();
            console.log("Algolia filter string:", filterString); // For debugging

            const { hits, nbHits, nbPages } = await searchClient.initIndex('selected-figures').search<AlgoliaPublicFigure>(query, {
                hitsPerPage: itemsPerPage,
                page: currentPage - 1, // Algolia uses 0-based indexing
                attributesToHighlight: ['name', 'name_kr'],
                filters: filterString,
                queryType: 'prefixAll',
                typoTolerance: true
            });

            // Transform Algolia results to match Figure interface
            const transformedResults: Figure[] = hits.map(hit => ({
                id: hit.objectID,
                name: hit.name || '',
                profilePic: hit.profilePic,
                occupation: hit.occupation || [],
                gender: hit.gender,
                categories: hit.categories
            }));

            setFigures(transformedResults);
            setTotalCount(nbHits);
            setTotalPages(nbPages || 1);
            setCurrentPage(1);

        } catch (error) {
            console.error('Algolia search error:', error);
            setError('Search failed. Please try again.');
            setFigures([]);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);

        // Clear timeout if it exists
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Debounce search to avoid too many requests
        searchTimeoutRef.current = setTimeout(() => {
            performSearchForGrid(query);
        }, 300);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            e.preventDefault();
            performSearchForGrid(searchQuery);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && !loading) {
            setCurrentPage(newPage);

            if (isSearchMode && searchQuery) {
                // For Algolia pagination
                setLoading(true);

                // Create filter string for categories
                const filterString = buildAlgoliaFilterString();

                searchClient.initIndex('selected-figures').search<AlgoliaPublicFigure>(searchQuery, {
                    hitsPerPage: itemsPerPage,
                    page: newPage - 1,
                    filters: filterString,
                }).then(({ hits }) => {
                    const transformedResults: Figure[] = hits.map(hit => ({
                        id: hit.objectID,
                        name: hit.name || '',
                        profilePic: hit.profilePic,
                        occupation: hit.occupation || [],
                        gender: hit.gender,
                        categories: hit.categories
                    }));

                    setFigures(transformedResults);
                    setLoading(false);
                }).catch(err => {
                    console.error('Algolia pagination error:', err);
                    setLoading(false);
                    setError('Failed to load more results');
                });
            } else {
                // For regular API pagination
                fetchFigures(newPage);
            }
        }
    };

    // Handle category checkbox change
    const handleCategoryChange = (category: string) => {
        if (category === 'All') {
            // If "All" is selected, clear all other selections
            setSelectedCategories(['All']);
        } else {
            // If any other category is selected, remove "All" if it exists
            setSelectedCategories(prev => {
                const newCategories = prev.filter(c => c !== 'All');

                // Toggle the selected category
                if (newCategories.includes(category)) {
                    // If no categories would be left, select "All"
                    if (newCategories.length === 1) {
                        return ['All'];
                    }
                    // Otherwise remove this category
                    return newCategories.filter(c => c !== category);
                } else {
                    // Add the category
                    return [...newCategories, category];
                }
            });
        }

        setCurrentPage(1);

        // If in search mode, refresh the search with new categories
        if (isSearchMode && searchQuery) {
            // Use setTimeout to ensure state is updated before search
            setTimeout(() => {
                performSearchForGrid(searchQuery);
            }, 0);
        }
    };

    // Remove a category when clicked in the selected categories display
    const removeCategory = (category: string) => {
        setSelectedCategories(prev => {
            const filtered = prev.filter(c => c !== category);
            // If no categories left, default to "All"
            return filtered.length === 0 ? ['All'] : filtered;
        });
    };

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSortBy(e.target.value);
        setCurrentPage(1);

        // If in search mode with Algolia, we might need to handle sorting differently
        // This depends on how your Algolia index is configured
        if (isSearchMode) {
            // Reset to normal mode if sorting changes while in search
            setIsSearchMode(false);
        }
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

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900">
            <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900 dark:text-white">All Figures</h1>

                {/* Search Section - Now integrated with main grid */}
                <div className="flex justify-center mb-6 sm:mb-8">
                    <div className="relative w-full max-w-xl">
                        <input
                            type="text"
                            placeholder="Search for a public figure..."
                            value={searchQuery}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            className="w-full px-4 sm:px-6 py-2.5 sm:py-3 text-base border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 pl-10 sm:pl-12 dark:bg-gray-800 dark:text-white"
                        />

                        {searchQuery ? (
                            <X
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                                size={20}
                                onClick={() => {
                                    setSearchQuery('');
                                    setIsSearchMode(false);
                                    fetchFigures(1);
                                }}
                            />
                        ) : (
                            <Search className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-key-color" />
                        )}
                    </div>
                </div>

                {/* Category and Sort Filters */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 mb-6 sm:mb-8">
                    {/* Category Filter - Now with multiple selection dropdown */}
                    <div className="flex items-center gap-2 w-full sm:w-auto relative" ref={categoryDropdownRef}>
                        <label className="text-gray-700 dark:text-gray-300 whitespace-nowrap">Categories :</label>
                        <div className="relative flex-1 sm:flex-auto">
                            <button
                                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                className="w-full sm:w-auto bg-white dark:bg-gray-800 border-2 border-key-color rounded-full px-4 sm:px-8 py-1 text-left flex items-center justify-between focus:outline-none focus:border-pink-500 dark:text-white"
                            >
                                <span className="truncate">
                                    {selectedCategories.includes('All')
                                        ? 'All Categories'
                                        : selectedCategories.length > 0
                                            ? `${selectedCategories.length} selected`
                                            : 'Select Categories'}
                                </span>
                                <svg className={`fill-current h-4 w-4 transition-transform ${showCategoryDropdown ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </button>

                            {/* Dropdown for categories with checkboxes */}
                            {showCategoryDropdown && (
                                <div className="absolute z-10 mt-1 w-full sm:w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    <ul className="py-1">
                                        {categories.map(category => (
                                            <li
                                                key={category}
                                                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                                                onClick={() => handleCategoryChange(category)}
                                            >
                                                {category === 'All' && selectedCategories.includes('All') ? (
                                                    <CheckSquare className="mr-2 h-5 w-5 text-key-color" />
                                                ) : category !== 'All' && selectedCategories.includes(category) ? (
                                                    <CheckSquare className="mr-2 h-5 w-5 text-key-color" />
                                                ) : (
                                                    <Square className="mr-2 h-5 w-5 text-gray-400" />
                                                )}
                                                <span className="text-gray-800 dark:text-gray-200">{category}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <label className="text-gray-700 dark:text-gray-300 whitespace-nowrap">Sort By :</label>
                        <div className="relative flex-1 sm:flex-auto">
                            <select
                                value={sortBy}
                                onChange={handleSortChange}
                                className="w-full sm:w-auto appearance-none bg-white dark:bg-gray-800 border-2 border-key-color rounded-full px-4 sm:px-8 py-1 pr-8 focus:outline-none focus:border-pink-500 dark:text-white"
                                disabled={isSearchMode} // Disable sorting when in search mode if Algolia doesn't support it
                            >
                                <option value="A-Z">A-Z</option>
                                <option value="Z-A">Z-A</option>
                                <option value="Recent">Most Recent</option>
                                <option value="Popular">Most Popular</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selected Categories Display with removal functionality */}
                <div className="flex flex-wrap justify-center items-center gap-2 mb-6 sm:mb-8">
                    {searchQuery && (
                        <span className="bg-key-color text-white px-4 py-1 rounded-full text-sm flex items-center gap-1">
                            <span>Search: {searchQuery}</span>
                            <X
                                className="h-4 w-4 ml-1 cursor-pointer"
                                onClick={() => {
                                    setSearchQuery('');
                                    setIsSearchMode(false);
                                    fetchFigures(1);
                                }}
                            />
                        </span>
                    )}

                    {/* Show selected categories as clickable tags */}
                    {!selectedCategories.includes('All') && selectedCategories.map(category => (
                        <div
                            key={category}
                            className="bg-key-color text-white px-4 py-1 rounded-full text-sm flex items-center gap-1 cursor-pointer"
                            onClick={() => removeCategory(category)}
                        >
                            <span>{category}</span>
                            <X className="h-4 w-4 ml-1" />
                        </div>
                    ))}
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-8 sm:py-12">
                        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-key-color mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading figures...</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="text-center py-8 sm:py-12 text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Figures Grid - Now shows search results directly */}
                {!loading && figures.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12">
                        {/* Create a hidden div with all images to force them to be loaded once */}
                        <div className="hidden">
                            {figures.map(figure => (
                                figure.profilePic && (
                                    <img
                                        key={`preload-${figure.id}`}
                                        src={figure.profilePic}
                                        alt=""
                                        aria-hidden="true"
                                    />
                                )
                            ))}
                        </div>

                        {figures.map((figure) => (
                            <Link
                                href={`/${figure.id}`}
                                key={figure.id}
                                className="flex flex-col items-center group"
                            >
                                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-40 lg:h-40 relative mb-2 sm:mb-3 rounded-full overflow-hidden border-2 border-gray-200 group-hover:border-[#E4287C] transition-colors">
                                    <img
                                        src={figure.profilePic || '/images/default-profile.png'}
                                        alt={figure.name}
                                        className="w-full h-full object-cover rounded-full"
                                        referrerPolicy="no-referrer"
                                        loading="eager"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = '/images/default-profile.png';
                                        }}
                                    />
                                </div>
                                <span className="text-center text-gray-900 dark:text-white font-medium text-sm sm:text-base truncate w-full">
                                    {figure.name}
                                </span>
                                {figure.occupation && figure.occupation.length > 0 && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center">
                                        {figure.occupation[0]}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                )}

                {/* No Results */}
                {!loading && figures.length === 0 && !error && (
                    <div className="text-center py-8 sm:py-12 text-gray-600 dark:text-gray-400">
                        {searchQuery ? `No figures found matching "${searchQuery}"` : 'No figures found'}
                    </div>
                )}

                {/* Pagination Controls */}
                {!loading && figures.length > 0 && totalPages > 1 && (
                    <div className="flex justify-center items-center gap-1 sm:gap-2 flex-wrap">
                        <button
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                            className="px-2 sm:px-3 py-1 text-gray-600 dark:text-gray-400 disabled:opacity-50"
                            aria-label="First page"
                        >
                            «
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-2 sm:px-3 py-1 text-gray-600 dark:text-gray-400 disabled:opacity-50"
                            aria-label="Previous page"
                        >
                            ‹
                        </button>

                        {getPageNumbers().map(page => (
                            <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className={`px-2 sm:px-3 py-1 rounded-full ${currentPage === page
                                    ? 'bg-key-color text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                aria-label={`Page ${page}`}
                                aria-current={currentPage === page ? 'page' : undefined}
                            >
                                {page}
                            </button>
                        ))}

                        {totalPages > (isMobile ? 3 : 5) && currentPage < totalPages - (isMobile ? 1 : 2) && (
                            <span className="px-2 sm:px-3 py-1 text-gray-600 dark:text-gray-400">...</span>
                        )}

                        {totalPages > (isMobile ? 3 : 5) && currentPage < totalPages - (isMobile ? 1 : 2) && (
                            <button
                                onClick={() => handlePageChange(totalPages)}
                                className={`px-2 sm:px-3 py-1 rounded-full ${currentPage === totalPages
                                    ? 'bg-key-color text-white'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                aria-label={`Page ${totalPages}`}
                            >
                                {totalPages}
                            </button>
                        )}

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="px-2 sm:px-3 py-1 text-gray-600 dark:text-gray-400 disabled:opacity-50"
                            aria-label="Next page"
                        >
                            ›
                        </button>
                        <button
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="px-2 sm:px-3 py-1 text-gray-600 dark:text-gray-400 disabled:opacity-50"
                            aria-label="Last page"
                        >
                            »
                        </button>
                    </div>
                )}

                {/* Results Count */}
                {!loading && figures.length > 0 && (
                    <div className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
                        {isSearchMode ?
                            `Search results: ${figures.length} of ${totalCount} figures | Page ${currentPage} of ${totalPages}` :
                            `Showing ${figures.length} of ${totalCount} figures | Page ${currentPage} of ${totalPages}`
                        }
                    </div>
                )}
            </main>

            {isPageLoading && <LoadingOverlay />}
        </div>
    );
}