'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { Search, X, Loader2, CheckSquare, Square } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import algoliasearch from 'algoliasearch';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

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

interface FiguresQueryResult {
    figures: Figure[];
    totalPages: number;
    totalCount: number;
    isSearchMode: boolean;
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

function AllFiguresContent() {
    // const [figures, setFigures] = useState<Figure[]>([]);
    // const [loading, setLoading] = useState(true);
    // const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    // const [totalPages, setTotalPages] = useState(1);
    // const [totalCount, setTotalCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']); // Default to 'All'
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    // const [isSearchMode, setIsSearchMode] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(false);
    // const [isInitialized, setIsInitialized] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Categories from the API
    const categories = [
        'All', 'Male', 'Female', 'Group', 'Singer', 'Singer-Songwriter',
        'Film Director', 'Rapper', 'Actor', 'Actress', 'South Korean'
    ];

    const CATEGORY_ORDER = [
        'Male', 'Female', 'Group', 'South Korean', 'Singer', 'Singer-Songwriter',
        'Film Director', 'Rapper', 'Actor', 'Actress'
    ];

    // Map category selections to search fields
    // This helps translate user-facing categories to backend fields
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

    const itemsPerPage = 18;

    // --- DATA FETCHING WITH TANSTACK QUERY ---
    // This one hook replaces all your previous data-fetching logic.
    const {
        isLoading,
        isFetching,
        isError,
        error,
        data,
        isPlaceholderData, // Useful for pagination UX
    } = useQuery<FiguresQueryResult, Error>({
        // `queryKey` is an array that uniquely identifies this data request.
        // When any value in this array changes, React Query will re-fetch.
        queryKey: ['allFigures', { selectedCategories, currentPage, searchQuery }],

        // `queryFn` is the function that performs the actual data fetching.
        queryFn: async () => {
            if (searchQuery.trim()) {
                // Algolia search logic
                const { hits, nbHits, nbPages } = await searchClient.initIndex('selected-figures').search<AlgoliaPublicFigure>(searchQuery, {
                    hitsPerPage: 18,
                    page: currentPage - 1,
                    // Your other Algolia parameters...
                });
                const transformedResults: Figure[] = hits.map(hit => ({
                    id: hit.objectID, name: hit.name || '', profilePic: hit.profilePic, occupation: hit.occupation || [], gender: hit.gender, categories: hit.categories
                }));
                return { figures: transformedResults, totalPages: nbPages, totalCount: nbHits, isSearchMode: true };
            } else {
                // Your backend API fetching logic
                const params = new URLSearchParams({
                    page: currentPage.toString(),
                    pageSize: '18',
                });

                // Check for selected categories and add them to the params
                if (selectedCategories.length > 0 && !selectedCategories.includes('All')) {
                    const fieldFilters: Record<string, string[]> = {};

                    selectedCategories.forEach(category => {
                        const mappings = categoryToFieldMap[category];
                        if (mappings) {
                            mappings.forEach(mapping => {
                                if (!fieldFilters[mapping.field]) {
                                    fieldFilters[mapping.field] = [];
                                }
                                if (!fieldFilters[mapping.field].includes(mapping.value)) {
                                    fieldFilters[mapping.field].push(mapping.value);
                                }
                            });
                        }
                    });

                    Object.entries(fieldFilters).forEach(([field, values]) => {
                        values.forEach(value => {
                            params.append(field, value);
                        });
                    });
                }
                
                // Construct the final URL and fetch the data
                const response = await fetch(`/api/public-figures?${params}`);
                if (!response.ok) {
                    throw new Error(await response.text());
                }
                const jsonData = await response.json();
                return {
                    figures: jsonData.publicFigures || [],
                    totalPages: jsonData.totalPages || 1,
                    totalCount: jsonData.totalCount || 0,
                    isSearchMode: false
                };
            }
        },
        // Configuration options
        placeholderData: keepPreviousData, // Prevents UI flicker during pagination. Old data is kept while new data is fetched.
        staleTime: 1000 * 60 * 5, // Data is considered fresh for 5 minutes, preventing unnecessary re-fetches.
    });

    // Derive state from the `data` object returned by useQuery.
    // Provide default values to prevent errors on the initial render.
    const figures = data?.figures || [];
    const totalPages = data?.totalPages || 1;
    const totalCount = data?.totalCount || 0;
    const isSearchMode = data?.isSearchMode || false;




    // Handle click outside to close the dropdown
    useEffect(() => {
        // console.log('🖱️ Click outside useEffect ran');
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
        // console.log('📱 Mobile check useEffect ran');
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

    // For URL order
    const sortCategoriesForURL = (categories: string[]) => {
        return categories.sort((a, b) => {
            const indexA = CATEGORY_ORDER.indexOf(a);
            const indexB = CATEGORY_ORDER.indexOf(b);

            // If both categories are in the order array, sort by their position
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }

            // If only one is in the array, prioritize it
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            // If neither is in the array, sort alphabetically
            return a.localeCompare(b);
        });
    };

    // Function to update URL with current filters
    const updateURL = useCallback((newCategories: string[], newSearchQuery: string = '', newPage: number = 1, replace: boolean = false) => {
        // console.log('updateURL called with:', { newCategories, newSearchQuery, newPage, replace });

        const params = new URLSearchParams();

        // Add categories to URL (skip 'All' as it's default)
        if (newCategories.length > 0 && !newCategories.includes('All')) {
            const sortedCategories = sortCategoriesForURL(newCategories);
            sortedCategories.forEach(category => {
                params.append('category', category);
            });
        }

        // Add search query if present
        if (newSearchQuery.trim()) {
            params.set('search', newSearchQuery);
        }

        // Add page if it's not 1
        if (newPage > 1) {
            params.set('page', newPage.toString());
        }

        const queryString = params.toString();
        const newURL = queryString ? `?${queryString}` : '';
        const fullURL = `/all-figures${newURL}`;

        const currentURL = window.location.pathname + window.location.search;

        if (currentURL !== fullURL) {
            if (replace) {
                // Use replaceState for filter changes to avoid creating new history entries
                window.history.replaceState({}, '', fullURL);
                router.replace(fullURL, { scroll: false });
            } else {
                // Use pushState for actual navigation (like pagination)
                window.history.pushState({}, '', fullURL);
                router.replace(fullURL, { scroll: false });
            }
        }
    }, [router]);

    // Function to read initial state from URL
    const getInitialStateFromURL = useCallback(() => {
        const categories = searchParams.getAll('category');
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');

        // Ensure categories always has a valid value
        const validCategories = categories.length > 0 ? categories : ['All'];

        return {
            categories: validCategories,
            search,
            page: Math.max(1, page) // Ensure page is at least 1
        };
    }, [searchParams]);

    useEffect(() => {
        // console.log('🔄 Combined initialization useEffect ran');

        const urlState = getInitialStateFromURL();
        // console.log('📖 Reading from URL:', urlState);

        // Set all state at once
        setSelectedCategories(urlState.categories);
        setSearchQuery(urlState.search);
        setCurrentPage(urlState.page);

        // if (urlState.search && urlState.search.trim()) {
        //     setIsSearchMode(true);
        // } else {
        //     setIsSearchMode(false);
        // }

        // // Mark as initialized
        // setIsInitialized(true);

        // // Immediately fetch data with the URL state (don't wait for another useEffect)
        // // console.log('🚀 Immediate data fetch with URL state:', urlState);

        // if (urlState.search && urlState.search.trim()) {
        //     // console.log('🔍 Immediate Algolia search for:', urlState.search);
        //     performSearchForGridWithPage(urlState.search, urlState.page);
        // } else {
        //     // console.log('📋 Immediate fetch with categories:', urlState.categories);
        //     fetchFiguresWithCategories(urlState.page, urlState.categories);
        // }
    }, []); // Only run once on mount

    // useEffect(() => {
    //     // Skip if not initialized yet (prevents double-fetch on mount)
    //     if (!isInitialized) {
    //         // console.log('⏸️ Skipping subsequent useEffect - not initialized yet');
    //         return;
    //     }

    //     // console.log('🔄 Subsequent state change useEffect triggered');
    //     // console.log('📊 Current state:', {
    //     //     selectedCategories,
    //     //     searchQuery,
    //     //     currentPage,
    //     //     isSearchMode
    //     // });

    //     // Handle subsequent changes after initialization
    //     if (searchQuery && searchQuery.trim()) {
    //         // console.log('🔍 Subsequent Algolia search for:', searchQuery);
    //         setIsSearchMode(true);
    //         performSearchForGridWithPage(searchQuery, currentPage);
    //     } else {
    //         // console.log('📋 Subsequent fetch with filters:', selectedCategories);
    //         setIsSearchMode(false);
    //         fetchFigures(currentPage);
    //     }
    // }, [selectedCategories, searchQuery, currentPage, isInitialized]); // Add isInitialized to dependencies

    // 3. Handle browser back/forward navigation
    // useEffect(() => {
    //     const handlePopState = (event: PopStateEvent) => {
    //         // console.log('🔙 Browser navigation detected');

    //         // Reset initialization to allow fresh URL read
    //         setIsInitialized(false);

    //         const urlState = getInitialStateFromURL();
    //         // console.log('🔄 Restoring state from URL:', urlState);

    //         // Update all state at once
    //         setSelectedCategories(urlState.categories);
    //         setSearchQuery(urlState.search);
    //         setCurrentPage(urlState.page);

    //         if (urlState.search && urlState.search.trim()) {
    //             setIsSearchMode(true);
    //             performSearchForGridWithPage(urlState.search, urlState.page);
    //         } else {
    //             setIsSearchMode(false);
    //             fetchFiguresWithCategories(urlState.page, urlState.categories);
    //         }

    //         // Mark as initialized again
    //         setIsInitialized(true);
    //     };

    //     window.addEventListener('popstate', handlePopState);

    //     return () => {
    //         window.removeEventListener('popstate', handlePopState);
    //     };
    // }, [getInitialStateFromURL]);

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
                        if (!fieldFilters[mapping.field].includes(mapping.value)) {
                            fieldFilters[mapping.field].push(mapping.value);
                        }
                    });
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

    // const fetchFigures = async (page: number) => {
    //     // Add stack trace to see what's calling this function
    //     // console.log('🔍 fetchFigures called with page:', page);
    //     // console.log('📍 Called from:', new Error().stack?.split('\n')[2]?.trim());
    //     // console.log('🏷️ Current state:', {
    //     //     selectedCategories,
    //     //     searchQuery,
    //     //     currentPage,
    //     //     isSearchMode
    //     // });

    //     try {
    //         setLoading(true);
    //         let params = new URLSearchParams({
    //             page: page.toString(),
    //             pageSize: itemsPerPage.toString(),
    //         });

    //         // Add category filters
    //         params = buildCategoryParams(params);

    //         if (searchQuery && !isSearchMode) {
    //             params.append('search', searchQuery);
    //         }

    //         // DEBUG: Log the URL being called
    //         const apiUrl = `/api/public-figures?${params}`;
    //         // console.log('🌐 Fetching URL:', apiUrl);

    //         const response = await fetch(`/api/public-figures?${params}`);

    //         if (!response.ok) {
    //             throw new Error(`HTTP error! status: ${response.status}`);
    //         }

    //         const data = await response.json();

    //         setFigures(data.publicFigures || []);
    //         setCurrentPage(data.currentPage || page);
    //         setTotalPages(data.totalPages || 1);
    //         setTotalCount(data.totalCount || 0);

    //         // console.log('✅ fetchFigures completed successfully');

    //     } catch (err) {
    //         console.error('Fetch error:', err);
    //         if (err instanceof Error) {
    //             setError(`Failed to load figures: ${err.message}`);
    //         } else {
    //             setError('Failed to load figures: Unknown error');
    //         }
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // const fetchFiguresWithCategories = async (page: number, categories: string[]) => {
    //     // console.log('🔍 fetchFiguresWithCategories called with:', { page, categories });

    //     try {
    //         setLoading(true);
    //         const params = new URLSearchParams({
    //             page: page.toString(),
    //             pageSize: itemsPerPage.toString(),
    //         });

    //         // Build category params with the provided categories (not current state)
    //         if (categories.length > 0 && !categories.includes('All')) {
    //             const fieldFilters: Record<string, string[]> = {};

    //             categories.forEach(category => {
    //                 const mappings = categoryToFieldMap[category];
    //                 if (mappings) {
    //                     mappings.forEach(mapping => {
    //                         if (!fieldFilters[mapping.field]) {
    //                             fieldFilters[mapping.field] = [];
    //                         }
    //                         if (!fieldFilters[mapping.field].includes(mapping.value)) {
    //                             fieldFilters[mapping.field].push(mapping.value);
    //                         }
    //                     });
    //                 }
    //             });

    //             Object.entries(fieldFilters).forEach(([field, values]) => {
    //                 values.forEach(value => {
    //                     params.append(field, value);
    //                 });
    //             });
    //         }

    //         const apiUrl = `/api/public-figures?${params}`;
    //         // console.log('🌐 Fetching URL with categories:', apiUrl);

    //         const response = await fetch(apiUrl);

    //         if (!response.ok) {
    //             throw new Error(`HTTP error! status: ${response.status}`);
    //         }

    //         const data = await response.json();

    //         setFigures(data.publicFigures || []);
    //         setCurrentPage(data.currentPage || page);
    //         setTotalPages(data.totalPages || 1);
    //         setTotalCount(data.totalCount || 0);

    //         // console.log('✅ fetchFiguresWithCategories completed successfully');

    //     } catch (err) {
    //         console.error('❌ Fetch error:', err);
    //         if (err instanceof Error) {
    //             setError(`Failed to load figures: ${err.message}`);
    //         } else {
    //             setError('Failed to load figures: Unknown error');
    //         }
    //     } finally {
    //         setLoading(false);
    //     }
    // };


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
    // const performSearchForGrid = async (query: string) => {
    //     if (!query.trim()) {
    //         setIsSearchMode(false);
    //         // fetchFigures(1);
    //         setCurrentPage(1);
    //         return;
    //     }

    //     setIsSearchMode(true);
    //     setLoading(true);

    //     try {
    //         // Create filter string for categories
    //         const filterString = buildAlgoliaFilterString();
    //         // console.log("Algolia filter string:", filterString); // For debugging

    //         const { hits, nbHits, nbPages } = await searchClient.initIndex('selected-figures').search<AlgoliaPublicFigure>(query, {
    //             hitsPerPage: itemsPerPage,
    //             page: currentPage - 1, // Algolia uses 0-based indexing
    //             attributesToHighlight: ['name', 'name_kr'],
    //             filters: filterString,
    //             queryType: 'prefixAll',
    //             typoTolerance: true
    //         });

    //         // Transform Algolia results to match Figure interface
    //         const transformedResults: Figure[] = hits.map(hit => ({
    //             id: hit.objectID,
    //             name: hit.name || '',
    //             profilePic: hit.profilePic,
    //             occupation: hit.occupation || [],
    //             gender: hit.gender,
    //             categories: hit.categories
    //         }));

    //         setFigures(transformedResults);
    //         setTotalCount(nbHits);
    //         setTotalPages(nbPages || 1);
    //         setCurrentPage(1);

    //     } catch (error) {
    //         console.error('Algolia search error:', error);
    //         setError('Search failed. Please try again.');
    //         setFigures([]);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // const performSearchForGridWithPage = async (query: string, page: number = 1) => {
    //     if (!query.trim()) {
    //         setIsSearchMode(false);
    //         return;
    //     }

    //     setIsSearchMode(true);
    //     setLoading(true);

    //     try {
    //         const filterString = buildAlgoliaFilterString();

    //         const { hits, nbHits, nbPages } = await searchClient.initIndex('selected-figures').search<AlgoliaPublicFigure>(query, {
    //             hitsPerPage: itemsPerPage,
    //             page: page - 1, // Algolia uses 0-based indexing
    //             attributesToHighlight: ['name', 'name_kr'],
    //             filters: filterString,
    //             queryType: 'prefixAll',
    //             typoTolerance: true
    //         });

    //         const transformedResults: Figure[] = hits.map(hit => ({
    //             id: hit.objectID,
    //             name: hit.name || '',
    //             profilePic: hit.profilePic,
    //             occupation: hit.occupation || [],
    //             gender: hit.gender,
    //             categories: hit.categories
    //         }));

    //         setFigures(transformedResults);
    //         setTotalCount(nbHits);
    //         setTotalPages(nbPages || 1);

    //     } catch (error) {
    //         console.error('Algolia search error:', error);
    //         setError('Search failed. Please try again.');
    //         setFigures([]);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        // console.log('Search query changed to:', query);

        setSearchQuery(query);
        setCurrentPage(1);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Update URL immediately
        updateURL(selectedCategories, query, 1, true);
    };

    // const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    //     if (e.key === 'Enter' && searchQuery.trim()) {
    //         e.preventDefault();
    //         performSearchForGrid(searchQuery);
    //     }
    // };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && !isLoading) {
            setCurrentPage(newPage); // This will trigger the main useEffect
            updateURL(selectedCategories, searchQuery, newPage, false);
        }
    };

    // Handle category checkbox change
    const handleCategoryChange = (category: string, forceRemove: boolean = false) => {
        // console.log('🏷️ handleCategoryChange called:', { category, forceRemove });
        // console.log('📍 Called from:', new Error().stack?.split('\n')[2]?.trim());

        let newCategories: string[];

        if (forceRemove) {
            newCategories = selectedCategories.filter(c => c !== category);
            newCategories = newCategories.length === 0 ? ['All'] : newCategories;
        } else {
            if (category === 'All') {
                newCategories = ['All'];
            } else {
                const currentCategories = selectedCategories.filter(c => c !== 'All');

                if (currentCategories.includes(category)) {
                    if (currentCategories.length === 1) {
                        newCategories = ['All'];
                    } else {
                        newCategories = currentCategories.filter(c => c !== category);
                    }
                } else {
                    newCategories = [...currentCategories, category];
                }
            }
        }

        // console.log('Updating categories to:', newCategories);

        // Update state - DON'T manually set isSearchMode here
        setSelectedCategories(newCategories);
        setCurrentPage(1);

        // Update URL
        setTimeout(() => {
            updateURL(newCategories, searchQuery, 1, true);
        }, 0);
        // console.log('✅ handleCategoryChange completed - should trigger useEffect');
    };

    // Remove a category when clicked in the selected categories display
    const removeCategory = (category: string) => {
        handleCategoryChange(category, true);
    };

    // const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    //     setCurrentPage(1);

    //     // If in search mode with Algolia, we might need to handle sorting differently
    //     // This depends on how your Algolia index is configured
    //     if (isSearchMode) {
    //         // Reset to normal mode if sorting changes while in search
    //         setIsSearchMode(false);
    //     }
    // };

    const clearAllFilters = () => {
        // console.log('Clearing all filters');

        // Update all state in a single batch
        setSelectedCategories(['All']);
        setSearchQuery('');
        setCurrentPage(1);
        // Don't manually set isSearchMode - let useEffect handle it

        // Clear URL
        setTimeout(() => {
            router.replace('/all-figures', { scroll: false });
        }, 0);
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
                            // onKeyDown={handleKeyDown}
                            className="w-full px-4 sm:px-6 py-2.5 sm:py-3 text-base border-2 border-key-color rounded-full focus:outline-none focus:border-pink-700 pl-10 sm:pl-12 dark:bg-gray-800 dark:text-white"
                        />

                        {searchQuery ? (
                            <X
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer"
                                size={20}
                                onClick={() => {
                                    setSearchQuery(''); // This will trigger the useEffect to fetch normally
                                    setCurrentPage(1);
                                    updateURL(selectedCategories, '', 1, true);
                                }}
                            />
                        ) : (
                            <Search className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-key-color" />
                        )}
                    </div>
                </div>

                {/* Category and Sort Filters */}
                <div className="flex justify-center items-center mb-6 sm:mb-8">
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

                    {/* <div className="flex items-center gap-2 w-full sm:w-auto">
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
                    </div> */}
                </div>

                {/* Selected Categories Display with removal functionality */}
                <div className="flex flex-wrap justify-center items-center gap-2 mb-6 sm:mb-8">
                    {searchQuery && (
                        <span className="bg-key-color text-white px-4 py-1 rounded-full text-sm flex items-center gap-1">
                            <span>Search: {searchQuery}</span>
                            <X
                                className="h-4 w-4 ml-1 cursor-pointer"
                                onClick={() => {
                                    setSearchQuery(''); // This will trigger the useEffect to fetch normally
                                    setCurrentPage(1);
                                    updateURL(selectedCategories, '', 1, true);
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

                {/* Clear Filters */}
                {(selectedCategories.length > 0 && !selectedCategories.includes('All')) || searchQuery ? (
                    <div className="flex justify-center mb-6">
                        <button
                            onClick={clearAllFilters}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline transition-colors"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : null}

                {/* Loading State */}
                {isLoading && (
                    <div className="text-center py-8 sm:py-12">
                        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-key-color mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading figures...</p>
                    </div>
                )}

                {/* Error State */}
                {isError && (
                    <div className="text-center py-8 sm:py-12 text-red-600 dark:text-red-400">
                        {error.message}
                    </div>
                )}

                {/* Figures Grid - Now shows search results directly */}
                {!isLoading && figures.length > 0 && (
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
                {!isLoading && figures.length === 0 && !error && (
                    <div className="text-center py-8 sm:py-12 text-gray-600 dark:text-gray-400">
                        {searchQuery ? `No figures found matching "${searchQuery}"` : 'No figures found'}
                    </div>
                )}

                {/* Pagination Controls */}
                {!isLoading && figures.length > 0 && totalPages > 1 && (
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

                        {(() => {
                            const pageNumbers = getPageNumbers();
                            if (pageNumbers.length === 0) return null;
                            const firstVisiblePage = pageNumbers[0];
                            const lastVisiblePage = pageNumbers[pageNumbers.length - 1];

                            return (
                                <>
                                    {/* First page and ellipsis at the start */}
                                    {firstVisiblePage > 1 && (
                                        <button
                                            onClick={() => handlePageChange(1)}
                                            className="px-2 sm:px-3 py-1 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                            aria-label="Page 1"
                                        >
                                            1
                                        </button>
                                    )}
                                    {firstVisiblePage > 2 && (
                                        <span className="px-2 sm:px-3 py-1 text-gray-600 dark:text-gray-400">...</span>
                                    )}

                                    {/* Page number buttons */}
                                    {pageNumbers.map(page => (
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

                                    {/* Ellipsis and last page at the end */}
                                    {lastVisiblePage < totalPages - 1 && (
                                        <span className="px-2 sm:px-3 py-1 text-gray-600 dark:text-gray-400">...</span>
                                    )}
                                    {lastVisiblePage < totalPages && (
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
                                </>
                            );
                        })()}

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
                {!isLoading && figures.length > 0 && (
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

export default function AllFiguresPage() {
    return (
        <Suspense fallback={<LoadingOverlay />}>
            <AllFiguresContent />
        </Suspense>
    );
}