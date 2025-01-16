// app/search/search-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchResult } from '@/lib/search';

const ITEMS_PER_PAGE = 10;

export default function SearchResults() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';
    const [articles, setArticles] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchResults = async () => {
            if (!query) {
                setArticles([]);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const response = await fetch(`/api/news/search?q=${encodeURIComponent(query)}&showAll=true`);
                if (!response.ok) throw new Error('Failed to fetch results');
                const data = await response.json();
                setArticles(data);
                setCurrentPage(1); // Reset to first page when new search is performed
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchResults();
    }, [query]);

    const handleArticleClick = (article: SearchResult) => {
        window.open(article.url, '_blank', 'noopener,noreferrer');
    };

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(articles.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentArticles = articles.slice(startIndex, endIndex);

    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-center items-center h-64">
                    <div className="text-lg">Loading results...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-red-500 text-center">{error}</div>
            </div>
        );
    }

    return (
        <div className="w-full py-8 flex flex-col items-center">
            {/* <div className='w-full '> */}
            <h1 className="w-[90%] md:w-[75%] lg:w-[60%] text-2xl font-bold mb-6 px-4">
                Search Results for &quot;{query}&quot;
                <span className="hidden md:inline text-gray-500 text-lg ml-2">
                    ({articles.length} results)
                </span>
                <span className="block md:hidden text-gray-500 text-lg mt-1">
                    ({articles.length} results)
                </span>
            </h1>

            {articles.length === 0 ? (
                <div className="w-[90%] md:w-[75%] lg:w-[60%] text-center text-gray-500 py-12 px-4">
                    No results found for &quot;{query}&quot;
                </div>
            ) : (
                <>
                    <div className="w-[90%] md:w-[75%] lg:w-[60%] grid gap-6 px-4">
                        {currentArticles.map((article) => (
                            <div
                                key={article.id}
                                onClick={() => handleArticleClick(article)}
                                className="flex flex-col items-center md:flex-row gap-4 p-4 cursor-pointer border border-slate-200 rounded-lg shadow-md"
                            >
                                {article.thumbnail && (
                                    <img
                                        src={article.thumbnail}
                                        alt={article.name}
                                        className="w-32 h-24 object-cover rounded-l-lg flex-shrink-0"
                                    />
                                )}
                                <div className="flex-1">
                                    <h4 className="font-medium mb-1 text-lg hover:text-blue-600 transition-colors">
                                        {article.name}
                                    </h4>
                                    <div className="flex items-center space-x-2">
                                        <p className="text-sm text-gray-600">
                                            {article.source} • {article.date}
                                        </p>
                                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                                            {article.category}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                                        {article.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div className="mt-8 flex items-center justify-center gap-2">
                        {currentPage > 1 && (
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                className="p-2 rounded hover:bg-gray-50"
                                aria-label="Previous page"
                            >
                                <ChevronLeft size={16} />
                            </button>
                        )}

                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={`px-3 py-1 rounded ${currentPage === page
                                        ? 'bg-blue-600 text-white'
                                        : 'border border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>

                        {currentPage < totalPages && (
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                className="p-2 rounded hover:bg-gray-50"
                                aria-label="Next page"
                            >
                                <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                </>
            )}
            {/* </div> */}
        </div>
    );
}