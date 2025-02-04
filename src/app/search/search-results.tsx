// app/search/search-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import algoliasearch from 'algoliasearch';
import Link from 'next/link';

const searchClient = algoliasearch(
    "B1QF6MLIU5",
    "ef0535bdd12e549ffa7c9541395432a1"
);

const ITEMS_PER_PAGE = 10;

type CelebrityResult = {
    objectID: string;
    name?: string;
    koreanName?: string;
    profilePic?: string;
    _highlightResult?: {
        name?: {
            value: string;
        };
        koreanName?: {
            value: string;
        };
    };
};

type ArticleResult = {
    objectID: string;
    title?: string;
    content?: string;
    thumbnail?: string;
    source?: string;
    formatted_date?: string;
    mainCategory?: string;
    url?: string;
    _highlightResult?: {
        title?: {
            value: string;
        };
        content?: {
            value: string;
        };
    };
};

export default function SearchResults() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams.get('q') || '';
    const [celebrities, setCelebrities] = useState<CelebrityResult[]>([]);
    const [articles, setArticles] = useState<ArticleResult[]>([]);
    const [totalArticleHits, setTotalArticleHits] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(0);

    useEffect(() => {
        const fetchResults = async () => {
            if (!query) {
                setCelebrities([]);
                setArticles([]);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const [celebrityResponse, articleResponse] = await Promise.all([
                    searchClient.initIndex('celebrities_name_asc').search(query, {
                        hitsPerPage: 5,
                        attributesToHighlight: ['name', 'koreanName'],
                        highlightPreTag: '<mark class="bg-yellow-200">',
                        highlightPostTag: '</mark>',
                    }),
                    searchClient.initIndex('news').search(query, {
                        page: currentPage,
                        hitsPerPage: ITEMS_PER_PAGE,
                        attributesToHighlight: ['title', 'content'],
                        highlightPreTag: '<mark class="bg-yellow-200">',
                        highlightPostTag: '</mark>'
                    })
                ]);

                setCelebrities(celebrityResponse.hits as CelebrityResult[]);
                setArticles(articleResponse.hits as ArticleResult[]);
                setTotalArticleHits(articleResponse.nbHits);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchResults();
    }, [query, currentPage]);

    const handleArticleClick = (article: ArticleResult) => {
        if (article.url) {
            window.open(article.url, '_blank', 'noopener,noreferrer');
        }
    };

    const totalPages = Math.ceil(totalArticleHits / ITEMS_PER_PAGE);

    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const renderHighlightedText = (text?: string) => {
        if (!text) return '';
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
                    <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
                    <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full py-8 flex justify-center">
                <div className="w-[90%] md:w-[75%] lg:w-[60%] text-red-500 text-center">{error}</div>
            </div>
        );
    }

    const totalResults = celebrities.length + totalArticleHits;

    return (
        <div className="w-full py-8 flex flex-col items-center">
            <h1 className="w-[90%] md:w-[75%] lg:w-[60%] text-2xl font-bold mb-6 px-4">
                Search Results for &quot;{query}&quot;
                <span className="hidden md:inline text-gray-500 text-lg ml-2">
                    ({totalResults} results)
                </span>
                <span className="block md:hidden text-gray-500 text-lg mt-1">
                    ({totalResults} results)
                </span>
            </h1>

            {totalResults === 0 ? (
                <div className="w-[90%] md:w-[75%] lg:w-[60%] text-center text-gray-500 py-12 px-4">
                    No results found for &quot;{query}&quot;
                </div>
            ) : (
                <div className="w-[90%] md:w-[75%] lg:w-[60%] space-y-8 px-4">
                    {/* Celebrity Results */}
                    {celebrities.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-4">Celebrities</h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {celebrities.map((celebrity) => (
                                    <Link
                                        key={celebrity.objectID}
                                        href={`/${celebrity.objectID}`}
                                        className="flex items-center p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
                                    >
                                        {celebrity.profilePic && (
                                            <img
                                                src={celebrity.profilePic}
                                                alt={celebrity.name}
                                                className="w-16 h-16 rounded-full object-cover"
                                            />
                                        )}
                                        <div className="ml-4">
                                            <div className="font-medium">
                                                {celebrity._highlightResult?.name
                                                    ? renderHighlightedText(celebrity._highlightResult.name.value)
                                                    : celebrity.name}
                                            </div>
                                            {celebrity.koreanName && (
                                                <div className="text-sm text-gray-500">
                                                    {celebrity._highlightResult?.koreanName
                                                        ? renderHighlightedText(celebrity._highlightResult.koreanName.value)
                                                        : celebrity.koreanName}
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Article Results */}
                    {articles.length > 0 && (
                        <div>
                            <h2 className="text-lg font-semibold mb-4">Articles</h2>
                            <div className="grid gap-6">
                                {articles.map((article) => (
                                    <div
                                        key={article.objectID}
                                        onClick={() => handleArticleClick(article)}
                                        className="flex flex-col md:flex-row gap-4 p-4 cursor-pointer border border-slate-200 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
                                    >
                                        {article.thumbnail && (
                                            <img
                                                src={article.thumbnail}
                                                alt={article.title || 'Article thumbnail'}
                                                className="w-full md:w-32 h-48 md:h-24 object-cover rounded-lg flex-shrink-0"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <h4 className="font-medium mb-1 text-lg hover:text-blue-600 transition-colors">
                                                {article._highlightResult?.title
                                                    ? renderHighlightedText(article._highlightResult.title.value)
                                                    : article.title}
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm text-gray-600">
                                                    {article.source} • {article.formatted_date}
                                                </p>
                                                {article.mainCategory && (
                                                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                                                        {article.mainCategory}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                                                {article._highlightResult?.content
                                                    ? renderHighlightedText(article._highlightResult.content.value)
                                                    : article.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="mt-8 flex items-center justify-center gap-2">
                                    {currentPage > 0 && (
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            className="p-2 rounded hover:bg-gray-50"
                                            aria-label="Previous page"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                    )}

                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                            let pageNumber;
                                            if (totalPages <= 5) {
                                                pageNumber = i;
                                            } else if (currentPage < 2) {
                                                pageNumber = i;
                                            } else if (currentPage > totalPages - 3) {
                                                pageNumber = totalPages - 5 + i;
                                            } else {
                                                pageNumber = currentPage - 2 + i;
                                            }

                                            return (
                                                <button
                                                    key={pageNumber}
                                                    onClick={() => handlePageChange(pageNumber)}
                                                    className={`px-3 py-1 rounded ${currentPage === pageNumber
                                                        ? 'bg-blue-600 text-white'
                                                        : 'border border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {pageNumber + 1}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {currentPage < totalPages - 1 && (
                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            className="p-2 rounded hover:bg-gray-50"
                                            aria-label="Next page"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}