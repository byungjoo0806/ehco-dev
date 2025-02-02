'use client';

import { useEffect, useState, Suspense } from "react";
import { Loader2 } from "lucide-react";
import Banner from '@/components/Banner';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface Celebrity {
    id: string;
    name: string;
    profilePic: string;
    nationality: string;
    koreanName: string;
    birthDate: string;
    company: string;
}

interface Article {
    id: string;
    title: string;
    formatted_date: string;
    source: string;
    celebrity: string;
    thumbnail?: string;
    content: string;
    url: string;
    mainCategory: string;
}

// Create a separate component for the main content that uses useSearchParams
function ExploreContent({
    celebrities,
    articles,
    onCelebrityClick
}: {
    celebrities: Celebrity[];
    articles: Article[];
    onCelebrityClick: (id: string) => void;
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        onCelebrityClick(''); // Reset navigation state
    }, [pathname, searchParams, onCelebrityClick]);

    const handleArticleClick = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Celebrities Section */}
            <div className="xl:col-span-4">
                <h2 className="text-2xl font-semibold mb-4">Featured Celebrities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-1 gap-4">
                    {celebrities.map((celebrity) => (
                        <Link
                            key={celebrity.id}
                            href={{
                                pathname: `/${celebrity.id}`,
                                query: {
                                    category: 'All',
                                    sort: 'newest',
                                    page: '1'
                                }
                            }}
                            onClick={() => onCelebrityClick(celebrity.id)}
                        >
                            <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-110">
                                <div className="flex items-center space-x-4">
                                    {celebrity.profilePic && (
                                        <img
                                            src={celebrity.profilePic}
                                            alt={celebrity.name}
                                            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-lg truncate">
                                            {celebrity.name}
                                        </h3>
                                        <p className="text-gray-600 text-sm truncate">
                                            {celebrity.koreanName}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Articles Section */}
            <div className="xl:col-span-8">
                <h2 className="text-2xl font-semibold mb-4">Latest Articles</h2>
                <div className="space-y-8">
                    {articles.map((article) => (
                        <div
                            key={article.id}
                            className="bg-white dark:bg-slate-500 rounded-lg hover:shadow-md transition-all duration-200"
                        >
                            <div
                                className="flex flex-col items-center sm:flex-row gap-4 p-4 cursor-pointer border border-slate-200 rounded-lg shadow-md"
                                onClick={() => handleArticleClick(article.url)}
                            >
                                {article.thumbnail && (
                                    <img
                                        src={article.thumbnail}
                                        alt={article.title}
                                        className="w-full sm:w-32 h-24 object-cover rounded-lg flex-shrink-0"
                                        draggable={false}
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium mb-1 text-lg hover:text-blue-600 transition-colors">
                                        {article.title}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm text-gray-600">
                                            {article.source} • {article.formatted_date}
                                        </p>
                                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                                            {article.mainCategory}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                                        {article.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function ExplorePage() {
    const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [celebritiesRes, articlesRes] = await Promise.all([
                    fetch('/api/celebrities'),
                    fetch('/api/news')
                ]);

                if (!celebritiesRes.ok || !articlesRes.ok) {
                    throw new Error('Failed to fetch data');
                }

                const celebritiesData = await celebritiesRes.json();
                const articlesData = await articlesRes.json();

                setCelebrities(celebritiesData.celebrities);
                setArticles(articlesData.articles);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load data. Please try again later.');
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleCelebrityClick = (celebrityId: string) => {
        if (celebrityId) { // Only set navigating if we have an ID (actual navigation)
            setIsNavigating(true);
        } else {
            setIsNavigating(false);
        }
    };

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-red-500 text-center">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Navigation Loading Overlay */}
            {isNavigating && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
                        <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
                        <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {loading ? (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
                        <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
                        <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
                    </div>
                </div>
            ) : (
                <div className="w-[90%] md:w-[75%] lg:w-[60%] mx-auto px-4 py-8">
                    <Banner articles={articles} />
                    <Suspense fallback={
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="animate-spin text-slate-600" size={24} />
                        </div>
                    }>
                        <ExploreContent
                            celebrities={celebrities}
                            articles={articles}
                            onCelebrityClick={handleCelebrityClick}
                        />
                    </Suspense>
                </div>
            )}
        </>
    );
}