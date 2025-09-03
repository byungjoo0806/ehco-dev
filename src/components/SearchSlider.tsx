'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { debounce } from 'lodash';
import { usePathname, useRouter } from 'next/navigation';
import algoliasearch from 'algoliasearch';
import Image from 'next/image';

const searchClient = algoliasearch(
    "B1QF6MLIU5",
    "ef0535bdd12e549ffa7c9541395432a1"
);

type PublicFigure = {
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

interface SearchSliderProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SearchSlider({ isOpen, onClose }: SearchSliderProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [searchResults, setSearchResults] = useState<PublicFigure[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Reset isNavigating when pathname changes
    useEffect(() => {
        setIsNavigating(false);
    }, [pathname]);

    // Handle escape key press
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when slider is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const handlePublicFigureClick = useCallback(() => {
        setIsNavigating(true);
        onClose();
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
    }, [onClose]);

    const handleSearchSubmit = useCallback(() => {
        if (searchQuery.trim()) {
            setIsNavigating(true);
            onClose();
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    }, [searchQuery, router, onClose]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            e.preventDefault();
            handleSearchSubmit();
        }
    };

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowResults(false);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        try {
            const { hits } = await searchClient.initIndex('selected-figures').search<PublicFigure>(query, {
                hitsPerPage: 8, // Increased for better desktop experience
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
    }, []);

    const debouncedSearch = useMemo(() => {
        return debounce((query: string) => performSearch(query), 300);
    }, [performSearch]);

    // Cleanup the debounced function on unmount
    useEffect(() => {
        return () => {
            debouncedSearch.cancel();
        };
    }, [debouncedSearch]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        debouncedSearch(query);
    };

    const handleClose = () => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        onClose();
    };

    const renderHighlightedText = (text: string) => {
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    const renderSearchResult = (result: PublicFigure) => (
        <Link
            key={result.objectID}
            href={`/${result.objectID}`}
            className="flex flex-row items-center px-4 py-3 hover:bg-gray-50 transition-colors duration-150"
            onClick={handlePublicFigureClick}
        >
            {result.profilePic && (
                <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                        src={result.profilePic}
                        alt={result.name || 'Profile Picture'}
                        fill
                        sizes="(max-width: 768px) 48px, 64px"
                        className="object-cover"
                    />
                </div>
            )}
            <div className="flex-1 pl-3 md:pl-4">
                <div className="font-medium text-sm md:text-base text-slate-800">
                    {result._highlightResult?.name ?
                        renderHighlightedText(result._highlightResult.name.value) :
                        result.name}
                </div>
                {result.name_kr && (
                    <div className="text-xs md:text-sm text-gray-500 mt-0.5">
                        {result._highlightResult?.name_kr ?
                            renderHighlightedText(result._highlightResult.name_kr.value) :
                            result.name_kr}
                    </div>
                )}
            </div>
        </Link>
    );

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={handleClose}
                />
            )}

            {/* Navigation Loading Overlay */}
            {isNavigating && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
                        <Loader2 className="animate-spin text-slate-600" size={24} />
                        <span className="text-slate-600 font-medium">Loading...</span>
                    </div>
                </div>
            )}

            {/* Search Slider */}
            <div
                className={`fixed top-0 right-0 h-full w-full md:w-96 lg:w-[28rem] bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="h-16 px-4 md:px-6 flex items-center border-b bg-white">
                    <div className="flex-1 flex items-center relative">
                        <Search className="absolute left-3 text-gray-400 z-10" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Search public figures"
                            className="pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg w-full text-sm md:text-base text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                        />
                        {searchQuery && (
                            <X
                                className="absolute right-3 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                                size={18}
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults([]);
                                    setShowResults(false);
                                }}
                            />
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Close search"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Results */}
                <div className="overflow-y-auto h-[calc(100%-4rem)] bg-white">
                    {isSearching ? (
                        <div className="p-8 text-center">
                            <Loader2 className="animate-spin text-gray-400 mx-auto mb-3" size={24} />
                            <p className="text-gray-500">Searching...</p>
                        </div>
                    ) : (
                        <>
                            {showResults && searchResults.length > 0 && (
                                <div className="divide-y divide-gray-100">
                                    {searchResults.map(renderSearchResult)}

                                    {/* See all results link */}
                                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                                        <button
                                            onClick={handleSearchSubmit}
                                            className="w-full text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-150"
                                        >
                                            See all results for &quot;{searchQuery}&quot;
                                        </button>
                                    </div>
                                </div>
                            )}

                            {showResults && searchQuery && searchResults.length === 0 && (
                                <div className="p-8 text-center">
                                    <div className="text-gray-400 mb-2">
                                        <Search size={48} className="mx-auto opacity-50" />
                                    </div>
                                    <p className="text-gray-500 text-lg mb-2">No results found</p>
                                    <p className="text-gray-400 text-sm">
                                        Try searching with different keywords
                                    </p>
                                </div>
                            )}

                            {!searchQuery && (
                                <div className="p-8 text-center">
                                    <div className="text-gray-400 mb-4">
                                        <Search size={48} className="mx-auto opacity-50" />
                                    </div>
                                    <p className="text-gray-500 text-lg mb-2">Search Public Figures</p>
                                    <p className="text-gray-400 text-sm">
                                        Enter a name to start searching
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}