// SearchSlider.tsx
import React, { useRef, useState, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import Link from 'next/link';
import { debounce } from 'lodash';
import { SearchResult } from '@/lib/search';
import { useAllCelebrities } from '@/lib/hooks/useAllCelebrities';

interface SearchSliderProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SearchSlider({ isOpen, onClose }: SearchSliderProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const { celebrities } = useAllCelebrities();

    const handleSearchedArticleclick = (article: SearchResult) => {
        window.open(article.url, '_blank', 'noopener,noreferrer');
        onClose();
    };

    const performSearch = async (query: string) => {
        setIsSearching(true);

        try {
            const celebrityResults: SearchResult[] = celebrities
                .filter(celebrity => {
                    if (!celebrity) return false;
                    const searchTermLower = query.toLowerCase();
                    const matchesEnglishName = celebrity.name ?
                        celebrity.name.toLowerCase().includes(searchTermLower) : false;
                    const matchesKoreanName = celebrity.koreanName ?
                        celebrity.koreanName.includes(query) : false;
                    return matchesEnglishName || matchesKoreanName;
                })
                .map(({ id, name, koreanName, profilePic }) => ({
                    type: 'celebrity' as const,
                    id,
                    name,
                    koreanName,
                    profilePic
                }));

            const articleResponse = await fetch(`/api/news/search?q=${encodeURIComponent(query)}&limit=5`);
            if (!articleResponse.ok) {
                throw new Error('Failed to fetch articles');
            }
            const articles = await articleResponse.json();
            const articleResults: SearchResult[] = articles.map((article: SearchResult) => ({
                type: 'article' as const,
                id: article.id,
                name: article.name,
                content: article.content,
                date: article.date,
                category: article.category,
                celebrity: article.celebrity,
                thumbnail: article.thumbnail,
                source: article.source,
                url: article.url
            }));

            const combinedResults = [...celebrityResults, ...articleResults];
            combinedResults.sort((a, b) => {
                const aExactMatch = a.name.toLowerCase() === query.toLowerCase();
                const bExactMatch = b.name.toLowerCase() === query.toLowerCase();
                if (aExactMatch && !bExactMatch) return -1;
                if (!aExactMatch && bExactMatch) return 1;
                return 0;
            });

            setSearchResults(combinedResults);
            setShowResults(true);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const debouncedSearch = useCallback(
        debounce((query: string) => {
            if (query.trim()) {
                performSearch(query);
            } else {
                setSearchResults([]);
                setShowResults(false);
            }
        }, 300),
        [celebrities]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        debouncedSearch(query);
    };

    const renderSearchResult = (result: SearchResult) => {
        if (result.type === 'celebrity') {
            return (
                <Link
                    key={result.id}
                    href={`/${result.id}`}
                    className="flex flex-row items-center px-3 py-2 hover:bg-gray-100"
                    onClick={() => {
                        onClose();
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowResults(false);
                    }}
                >
                    {result.profilePic && (
                        <img src={result.profilePic} alt={result.name} className="w-16 h-16 rounded-full" />
                    )}
                    <div className="flex-1 pl-2">
                        <div className="font-medium text-md">{result.name}</div>
                        {result.koreanName && (
                            <div className="text-sm text-gray-500">{result.koreanName}</div>
                        )}
                    </div>
                </Link>
            );
        }

        return (
            <div
                key={result.id}
                onClick={() => {
                    handleSearchedArticleclick(result);
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
                            alt={result.name}
                            className="w-48 h-48 object-contain"
                        />
                    </div>
                )}
                <div className="p-4 w-full">
                    <h3 className="text-md font-semibold mb-2">{result.name}</h3>
                    <div className="text-sm text-gray-600 mb-2">
                        {result.source} • {result.date}
                    </div>
                    {result.category && (
                        <span className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm text-gray-700 mr-2 mb-2">
                            {result.category}
                        </span>
                    )}
                    {result.content && (
                        <p className="text-gray-700 text-sm line-clamp-3">{result.content}</p>
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

                                    {searchResults.some(result => result.type === 'article') && (
                                        <div className="w-full flex flex-col items-center">
                                            <div className="w-full px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">
                                                Articles
                                            </div>
                                            {searchResults
                                                .filter(result => result.type === 'article')
                                                .map(renderSearchResult)}
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