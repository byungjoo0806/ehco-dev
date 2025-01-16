// app/search/search-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchResult } from '@/lib/search';

export default function SearchResults() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';
    const [articles, setArticles] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

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
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">
                Search Results for &quot;{query}&quot;
                <span className="text-gray-500 text-lg ml-2">
                    ({articles.length} results)
                </span>
            </h1>

            {articles.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                    No results found for &quot;{query}&quot;
                </div>
            ) : (
                <div className="grid gap-6">
                    {articles.map((article) => (
                        <div
                            key={article.id}
                            onClick={() => handleArticleClick(article)}
                            className="flex flex-col sm:flex-row bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer overflow-hidden"
                        >
                            {article.thumbnail && (
                                <div className="sm:w-1/4 flex justify-center items-center">
                                    <img
                                        src={article.thumbnail}
                                        alt={article.name}
                                        className="w-full h-48 sm:h-40 object-cover"
                                    />
                                </div>
                            )}
                            <div className="flex-1 p-4">
                                <h2 className="text-xl font-semibold mb-2">{article.name}</h2>
                                <div className="text-sm text-gray-600 mb-2">
                                    {article.source} • {article.date}
                                </div>
                                {article.category && (
                                    <span className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm text-gray-700 mr-2 mb-2">
                                        {article.category}
                                    </span>
                                )}
                                {article.content && (
                                    <p className="text-gray-700 line-clamp-3">{article.content}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}