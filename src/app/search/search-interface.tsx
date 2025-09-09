// src/app/search/search-interface.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import algoliasearch from 'algoliasearch';
import Image from 'next/image';
import { createUrlSlug } from '@/lib/slugify';

// Setup Algolia client
const searchClient = algoliasearch(
    "B1QF6MLIU5",
    "ef0535bdd12e549ffa7c9541395432a1"
);

// Algolia search result type
type AlgoliaPublicFigure = {
    objectID: string;
    name?: string;
    name_kr?: string;
    profilePic?: string;
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

export default function SearchInterface() {
    const router = useRouter();

    // States for search functionality
    const [searchQuery, setSearchQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [searchResults, setSearchResults] = useState<AlgoliaPublicFigure[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Handle clicks outside of search results
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search functionality for dropdown suggestions
    const performDropdownSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);

        try {
            const { hits } = await searchClient.initIndex('selected-figures').search<AlgoliaPublicFigure>(query, {
                hitsPerPage: 8, // Limit for dropdown
                attributesToHighlight: ['name', 'name_kr'],
                highlightPreTag: '<mark class="bg-yellow-200">',
                highlightPostTag: '</mark>',
                queryType: 'prefixAll',
                typoTolerance: true
            });

            setSearchResults(hits);
            setShowResults(true);
        } catch (error) {
            console.error('Algolia search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        performDropdownSearch(query);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (searchQuery.trim()) {
            setShowResults(false);
            // Navigate to full search results using your existing search-results component
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
    };

    const renderHighlightedText = (text: string) => {
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    const handleResultClick = (result: AlgoliaPublicFigure) => {
        setShowResults(false);
        setIsPageLoading(true);
        router.push(`/${createUrlSlug(result.objectID)}`);

        setTimeout(() => {
            setIsPageLoading(false);
        }, 500);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Loading Overlay */}
            {isPageLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
                        <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
                        <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
                    </div>
                </div>
            )}

            <main className="w-[92%] sm:w-[90%] md:w-[80%] mx-auto px-2 sm:px-4 py-12 sm:py-16">
                {/* Header Section */}
                <section className="text-center mb-8 sm:mb-12">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4 text-black">
                        Search <span className="text-key-color">Figures</span>
                    </h1>
                    <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8">
                        Find detailed profiles and information about your favorite public figures.
                    </p>

                    {/* Search bar */}
                    <div className="w-full max-w-xl mx-auto mb-6 relative" ref={searchRef}>
                        <form onSubmit={handleSearchSubmit}>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleInputChange}
                                    placeholder="Search for a public figure..."
                                    className="w-full px-4 md:px-6 py-2.5 md:py-3 text-black text-base md:text-lg border-2 border-key-color rounded-full focus:outline-none focus:border-key-color pl-12"
                                    autoFocus
                                />
                                {searchQuery ? (
                                    <X
                                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer hover:text-gray-600"
                                        size={20}
                                        onClick={handleClearSearch}
                                    />
                                ) : (
                                    <button type="submit" aria-label="Search" className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                        <Search className="w-5 h-5 md:w-6 md:h-6 text-key-color" />
                                    </button>
                                )}
                            </div>
                        </form>

                        {/* Search Results Dropdown */}
                        {isSearching ? (
                            <div className="absolute z-50 mt-2 bg-white border rounded-lg shadow-lg w-full left-0 right-0">
                                <div className="px-3 py-3 text-sm text-gray-500 text-center">
                                    Loading...
                                </div>
                            </div>
                        ) : (
                            <>
                                {showResults && searchResults.length > 0 && (
                                    <div className="absolute z-50 mt-2 bg-white border rounded-lg shadow-lg w-full left-0 right-0 max-h-96 overflow-y-auto">
                                        <div className="grid grid-cols-1 md:grid-cols-2">
                                            {searchResults.map((result) => (
                                                <button
                                                    key={result.objectID}
                                                    onClick={() => handleResultClick(result)}
                                                    className="flex flex-row items-center px-4 py-3 hover:bg-gray-100 w-full text-left"
                                                >
                                                    <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden flex-shrink-0">
                                                        <Image
                                                            src={result.profilePic || '/images/default-profile.png'}
                                                            alt={result.name || 'Profile'}
                                                            fill
                                                            sizes="(max-width: 768px) 48px, 64px"
                                                            className="object-cover"
                                                        />
                                                    </div>

                                                    <div className="flex-1 pl-4">
                                                        <div className="font-medium text-sm md:text-md text-black truncate">
                                                            {result._highlightResult?.name ?
                                                                renderHighlightedText(result._highlightResult.name.value) :
                                                                result.name}
                                                        </div>
                                                        {result.name_kr && (
                                                            <div className="text-xs md:text-sm text-gray-500 truncate">
                                                                {result._highlightResult?.name_kr ?
                                                                    renderHighlightedText(result._highlightResult.name_kr.value) :
                                                                    result.name_kr}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {/* "Search for more results" button */}
                                        {searchQuery && (
                                            <div className="border-t p-3">
                                                <button
                                                    onClick={handleSearchSubmit}
                                                    className="w-full text-center text-key-color hover:bg-gray-50 py-2 rounded text-sm font-medium"
                                                >
                                                    Search for more results →
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {showResults && searchQuery && searchResults.length === 0 && (
                                    <div className="absolute z-50 mt-2 bg-white border rounded-lg shadow-lg w-full left-0 right-0">
                                        <div className="px-3 py-3 text-sm text-gray-500 text-center">
                                            No results found
                                        </div>
                                        {searchQuery && (
                                            <div className="border-t p-3">
                                                <button
                                                    onClick={handleSearchSubmit}
                                                    className="w-full text-center text-key-color hover:bg-gray-50 py-2 rounded text-sm font-medium"
                                                >
                                                    Search articles instead →
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>

                {/* Default state */}
                <section className="text-center py-16">
                    <div className="text-gray-400 mb-6">
                        <Search size={64} className="mx-auto mb-4" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">
                        Start typing to search
                    </h3>
                    <p className="text-gray-500 mb-8">
                        Enter a name or keyword to find public figures and their detailed profiles.
                    </p>

                    {/* Quick links or popular searches could go here */}
                    {/* <div className="flex flex-wrap justify-center gap-2 mt-8">
                        <span className="text-sm text-gray-400">Popular searches:</span>
                        {['BTS', 'BLACKPINK', 'NewJeans', 'IU'].map((term) => (
                            <button
                                key={term}
                                onClick={() => {
                                    setSearchQuery(term);
                                    router.push(`/search?q=${encodeURIComponent(term)}`);
                                }}
                                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-600 transition-colors"
                            >
                                {term}
                            </button>
                        ))}
                    </div> */}
                </section>
            </main>
        </div>
    );
}