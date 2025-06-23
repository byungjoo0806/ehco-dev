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

type Celebrity = {
    objectID: string;
    name?: string;
    koreanName?: string;
    profilePic?: string;
    _highlightResult?: {
        name?: {
            value: string;
            matchLevel: string;
            matchedWords: string[];
        };
        koreanName?: {
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
    const [searchResults, setSearchResults] = useState<Celebrity[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Reset isNavigating when pathname changes
    useEffect(() => {
        setIsNavigating(false);
    }, [pathname]);

    const handleCelebrityClick = useCallback(() => {
        setIsNavigating(true);
        onClose();
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        // The router.push is handled by the Link component's onClick
    }, [onClose]);

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowResults(false);
            setIsSearching(false); // Ensure searching state is reset
            return;
        }

        setIsSearching(true);

        try {
            const { hits } = await searchClient.initIndex('selected-figures').search<Celebrity>(query, {
                hitsPerPage: 5,
                attributesToHighlight: ['name', 'koreanName'],
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

    const renderHighlightedText = (text: string) => {
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    const renderSearchResult = (result: Celebrity) => (
        <Link
            key={result.objectID}
            href={`/${result.objectID}`}
            className="flex flex-row items-center px-3 py-2 hover:bg-gray-100"
            onClick={handleCelebrityClick}
        >
            {result.profilePic && (
                <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                        src={result.profilePic}
                        alt={result.name || 'Profile Picture'}
                        fill
                        sizes="64px"
                        className="object-cover"
                    />
                </div>
            )}
            <div className="flex-1 pl-2">
                <div className="font-medium text-md text-slate-800">
                    {result._highlightResult?.name ?
                        renderHighlightedText(result._highlightResult.name.value) :
                        result.name}
                </div>
                {result.koreanName && (
                    <div className="text-sm text-gray-500">
                        {result._highlightResult?.koreanName ?
                            renderHighlightedText(result._highlightResult.koreanName.value) :
                            result.koreanName}
                    </div>
                )}
            </div>
        </Link>
    );

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={onClose}
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

            <div
                className={`fixed top-0 right-0 h-full w-full bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="h-16 px-4 flex items-center border-b">
                    <div className="flex-1 flex items-center">
                        <Search className="absolute left-6 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={handleInputChange}
                            placeholder="Search celebrities"
                            className="pl-8 pr-8 py-1.5 border rounded-lg w-full text-sm text-black"
                            autoFocus
                        />
                        {searchQuery && (
                            <X
                                className="absolute right-16 text-gray-400 cursor-pointer"
                                size={16}
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults([]);
                                    setShowResults(false);
                                }}
                            />
                        )}
                    </div>
                    <X
                        className="ml-4 cursor-pointer"
                        onClick={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                            setShowResults(false);
                            onClose();
                        }}
                    />
                </div>

                <div className="overflow-y-auto h-[calc(100%-4rem)]">
                    {isSearching ? (
                        <div className="p-4 text-center text-gray-500">Loading...</div>
                    ) : (
                        <>
                            {showResults && searchResults.length > 0 && (
                                <div className="p-4">
                                    {searchResults.map(renderSearchResult)}
                                </div>
                            )}

                            {showResults && searchQuery && searchResults.length === 0 && (
                                <div className="p-4 text-center text-gray-500">
                                    No results found
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}