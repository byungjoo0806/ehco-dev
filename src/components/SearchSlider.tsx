'use client';

// SearchSlider.tsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, Search, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { debounce } from 'lodash';
import { usePathname, useRouter } from 'next/navigation';
import algoliasearch from 'algoliasearch';

const searchClient = algoliasearch(
    "B1QF6MLIU5",
    "ef0535bdd12e549ffa7c9541395432a1"
);

type AlgoliaResult = {
    objectID: string;
    type: 'celebrity' | 'news';
    name?: string;
    title?: string;
    koreanName?: string;
    profilePic?: string;
    content?: string;
    formatted_date?: string;
    mainCategory?: string;
    thumbnail?: string;
    source?: string;
    url?: string;
    _highlightResult?: {
        name?: {
            value: string;
            matchLevel: string;
            matchedWords: string[];
        };
        content?: {
            value: string;
            matchLevel: string;
            matchedWords: string[];
        };
        koreanName?: {
            value: string;
            matchLevel: string;
            matchedWords: string[];
        };
        title?: {
            value: string;
            matchLevel: string;
            matchedWords: string[];
        }
    };
}

interface SearchSliderProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SearchSlider({ isOpen, onClose }: SearchSliderProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [searchResults, setSearchResults] = useState<AlgoliaResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Reset isNavigating when pathname changes
    useEffect(() => {
        // console.log('pathname changed:', pathname);
        // console.log('isNavigating:', isNavigating);
        setIsNavigating(false);
    }, [pathname]);

    const handleSearchedArticleClick = (article: AlgoliaResult) => {
        if (article.url) {
            window.open(article.url, '_blank', 'noopener,noreferrer');
        }
        onClose();
    };

    const handleCelebrityClick = (celebrityId: string) => {
        setIsNavigating(true);
        onClose();
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        router.push(`/${celebrityId}`);
    };

    const handleSeeMoreClick = () => {
        setIsNavigating(true);
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        onClose();
    };

    const performSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setIsSearching(true);

        try {
            interface MultipleSearchResponse {
                results: Array<{
                    hits: AlgoliaResult[];
                    nbHits: number;
                    page: number;
                    nbPages: number;
                    hitsPerPage: number;
                    exhaustiveNbHits: boolean;
                    query: string;
                    params: string;
                }>;
            }

            const response = await searchClient.multipleQueries<AlgoliaResult>([{
                indexName: "celebrities_name_asc",
                query: query,
                params: {
                    hitsPerPage: 5,
                    attributesToHighlight: ['name', 'koreanName'],
                    highlightPreTag: '<mark class="bg-yellow-200">',
                    highlightPostTag: '</mark>',
                    queryType: 'prefixAll',
                    typoTolerance: true
                }
            }, {
                indexName: "news",
                query: query,
                params: {
                    hitsPerPage: 5,
                    attributesToHighlight: ['title', 'content'],
                    highlightPreTag: '<mark class="bg-yellow-200">',
                    highlightPostTag: '</mark>'
                }
            }]) as MultipleSearchResponse;

            const combinedResults = response.results.flatMap((result, index) =>
                result.hits.map(hit => ({
                    ...hit,
                    type: index === 0 ? 'celebrity' : 'news'
                } as AlgoliaResult))
            );

            setSearchResults(combinedResults);
            setShowResults(true);
        } catch (error) {
            console.error('Algolia search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const debouncedSearch = useCallback(
        debounce((query: string) => performSearch(query), 300),
        []
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        debouncedSearch(query);
    };

    // Add this function to safely render HTML content
    const renderHighlightedText = (text: string) => {
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    const renderSearchResult = (result: AlgoliaResult) => {
        if (result.type === 'celebrity') {
            return (
                <Link
                    key={result.objectID}
                    href={`/${result.objectID}`}
                    className="flex flex-row items-center px-3 py-2 hover:bg-gray-100"
                    onClick={() => handleCelebrityClick(result.objectID)}
                >
                    {result.profilePic && (
                        <img src={result.profilePic} alt={result.name} className="w-16 h-16 rounded-full" />
                    )}
                    <div className="flex-1 pl-2">
                        <div className="font-medium text-md">
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
        }

        return (
            <div
                key={result.objectID}
                onClick={() => {
                    handleSearchedArticleClick(result);
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowResults(false);
                }}
                className="w-[90%] flex flex-col items-center bg-white border border-slate-200 pl-2 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer my-2"
            >
                {result.thumbnail && (
                    <div className="w-full flex justify-center items-center">
                        <img
                            src={result.thumbnail}
                            alt="Image Unavailable"
                            className="w-48 h-48 object-contain"
                        />
                    </div>
                )}
                <div className="p-4 w-full">
                    <h3 className="text-md font-semibold mb-2">
                        {result._highlightResult?.title ?
                            renderHighlightedText(result._highlightResult.title.value) :
                            result.title}
                    </h3>
                    <div className="text-sm text-gray-600 mb-2">
                        {result.source} • {result.formatted_date}
                    </div>
                    {result.mainCategory && (
                        <span className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm text-gray-700 mr-2 mb-2">
                            {result.mainCategory}
                        </span>
                    )}
                    {result.content && (
                        <p className="text-gray-700 text-sm line-clamp-3">
                            {result._highlightResult?.content ?
                                renderHighlightedText(result._highlightResult.content.value) :
                                result.content}
                        </p>
                    )}
                </div>
            </div>
        );
    };

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
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
                        <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
                        <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
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
                            placeholder="Search"
                            className="pl-8 pr-8 py-1.5 border rounded-lg w-full text-sm"
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
                                    {searchResults.some(result => result.type === 'celebrity') && (
                                        <div>
                                            <div className="px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">
                                                Celebrities
                                            </div>
                                            {searchResults
                                                .filter(result => result.type === 'celebrity')
                                                .map(renderSearchResult)}
                                        </div>
                                    )}

                                    {searchResults.some(result => result.type === 'news') && (
                                        <div className="w-full flex flex-col items-center">
                                            <div className="w-full px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">
                                                Articles
                                            </div>
                                            {searchResults
                                                .filter(result => result.type === 'news')
                                                .map(renderSearchResult)}

                                            {/* Added "see more" link */}
                                            <div className="w-full border-t py-2 mt-2">
                                                <div
                                                    className="flex items-center justify-center hover:bg-gray-50 py-2 cursor-pointer"
                                                    onClick={handleSeeMoreClick}
                                                >
                                                    <span className="text-sm text-blue-500 pr-1">See more results</span>
                                                    <ArrowRight size={16} className="text-blue-500" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
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