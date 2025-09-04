// app/search/search-results.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import algoliasearch from 'algoliasearch';
import Link from 'next/link';
import Image from 'next/image';
import { createUrlSlug } from '@/lib/slugify';

const searchClient = algoliasearch(
    "B1QF6MLIU5",
    "ef0535bdd12e549ffa7c9541395432a1"
);

const ITEMS_PER_PAGE = 10;

type PublicFigureResult = {
    objectID: string;
    name?: string;
    name_kr?: string;
    profilePic?: string;
    nationality?: string;
    occupation?: string[];
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
    subTitle?: string;
    body?: string;
    imageUrls?: string[];
    source?: string;
    sendDate?: string;
    link?: string;
    _highlightResult?: {
        subTitle?: {
            value: string;
        };
        body?: {
            value: string;
        };
    };
};

export default function SearchResults() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams.get('q') || '';
    const [profiles, setProfiles] = useState<PublicFigureResult[]>([]);
    const [articles, setArticles] = useState<ArticleResult[]>([]);
    const [totalArticleHits, setTotalArticleHits] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    // Check for mobile viewport
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth < 640);
        };

        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);

        return () => {
            window.removeEventListener('resize', checkIsMobile);
        };
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            if (!query) {
                setProfiles([]);
                setArticles([]);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const [profileResponse, articleResponse] = await Promise.all([
                    searchClient.initIndex('selected-figures').search(query, {
                        hitsPerPage: 5,
                        attributesToHighlight: ['name', 'name_kr'],
                        highlightPreTag: '<mark class="bg-yellow-200">',
                        highlightPostTag: '</mark>',
                    }),
                    searchClient.initIndex('articles').search(query, {
                        page: currentPage,
                        hitsPerPage: ITEMS_PER_PAGE,
                        attributesToHighlight: ['subTitle', 'body'],
                        highlightPreTag: '<mark class="bg-yellow-200">',
                        highlightPostTag: '</mark>'
                    })
                ]);

                setProfiles(profileResponse.hits as PublicFigureResult[]);
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
        if (article.link) {
            window.open(article.link, '_blank', 'noopener,noreferrer');
        }
    };

    const totalPages = Math.ceil(totalArticleHits / ITEMS_PER_PAGE);

    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Function to determine which page numbers to show
    const getPageNumbers = () => {
        const pageNumbers: number[] = [];

        if (totalPages <= (isMobile ? 3 : 5)) {
            // If there are only a few pages, show all
            for (let i = 0; i < totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            // Always include current page
            pageNumbers.push(currentPage);

            // Add one or two pages before current page if they exist
            if (currentPage - 1 >= 0) pageNumbers.push(currentPage - 1);
            if (currentPage - 2 >= 0 && !isMobile) pageNumbers.push(currentPage - 2);

            // Add one or two pages after current page if they exist
            if (currentPage + 1 < totalPages) pageNumbers.push(currentPage + 1);
            if (currentPage + 2 < totalPages && !isMobile) pageNumbers.push(currentPage + 2);
        }

        // Sort the page numbers
        return pageNumbers.sort((a, b) => a - b);
    };

    const renderHighlightedText = (text?: string) => {
        if (!text) return '';
        return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
                <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
                    <Loader2 className="animate-spin text-slate-600" size={24} />
                    <span className="text-slate-600 font-medium">Loading...</span>
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

    const totalResults = profiles.length + totalArticleHits;

    return (
        <div className="w-full py-8 flex flex-col items-center bg-white">
            <div className="w-[90%] md:w-[75%] lg:w-[60%] px-4">
                <h1 className="text-2xl font-bold mb-2 text-black">Search Results</h1>
                <p className="text-gray-600 mb-8">Showing results for: &ldquo;{query}&rdquo;</p>

                {totalResults === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                        No results found for &ldquo;{query}&rdquo;
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Profile Results */}
                        {profiles.length > 0 && (
                            <div className='w-full'>
                                <h2 className="text-2xl font-bold mb-6 text-black">Profiles</h2>
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 max-w-3xl">
                                    {profiles.map((profile) => (
                                        <Link
                                            key={profile.objectID}
                                            href={`/${createUrlSlug(profile.objectID)}`}
                                            className="block"
                                        >
                                            <div className="flex flex-col sm:flex-row border border-key-color rounded-lg p-4 sm:p-6 hover:shadow-md hover:bg-slate-50 transition-shadow">
                                                <div className="flex-shrink-0 flex justify-center mb-4 sm:mb-0">
                                                    <div className="text-center">
                                                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden mx-auto">
                                                            <Image
                                                                src={profile.profilePic || "/images/default-profile.png"}
                                                                alt={profile.name || "Profile picture"}
                                                                fill
                                                                sizes="(max-width: 640px) 4rem, (max-width: 768px) 5rem, 6rem"
                                                                className="object-cover"
                                                            />
                                                        </div>
                                                        <p className="text-center mt-2 font-medium text-black">
                                                            {profile.name || "Profile"}
                                                        </p>
                                                        <p className='text-center text-gray-500'>
                                                            {profile.name_kr || "Profile KR"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="sm:ml-6 md:ml-8 flex-grow">
                                                    <div className="mb-3">
                                                        <p className="font-semibold text-gray-600">Nationality</p>
                                                        <p className='text-gray-400'>{profile.nationality || "Korean"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-600">Occupation</p>
                                                        <p className='text-gray-400'>{profile.occupation && profile.occupation.join(', ')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Article Results */}
                        {articles.length > 0 && (
                            <div className="w-full mt-8">
                                <h2 className="text-2xl font-bold mb-6 text-black">Articles</h2>
                                <div className="grid gap-6 w-full">
                                    {articles.map((article) => (
                                        <div
                                            key={article.objectID}
                                            onClick={() => handleArticleClick(article)}
                                            className="w-full overflow-hidden flex flex-col md:flex-row md:items-center gap-4 p-4 cursor-pointer border border-key-color rounded-lg shadow-sm hover:bg-slate-50 hover:shadow-md transition-shadow duration-300"
                                        >
                                            {article.imageUrls && (
                                                <div className="w-full md:w-32 flex-shrink-0">
                                                    <img
                                                        src={article.imageUrls[0]}
                                                        alt={article.subTitle || 'Article thumbnail'}
                                                        className="w-full md:w-32 h-48 md:h-24 object-cover rounded-lg flex-shrink-0"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium mb-1 text-black text-lg transition-colors">
                                                    {article._highlightResult?.subTitle
                                                        ? renderHighlightedText(article._highlightResult.subTitle.value)
                                                        : article.subTitle}
                                                </h4>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm text-gray-600">
                                                        {article.source} • {article.sendDate ? `${article.sendDate.substring(0, 4)}-${article.sendDate.substring(4, 6)}-${article.sendDate.substring(6, 8)}` : ''}
                                                    </p>
                                                </div>
                                                <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                                                    {(() => {
                                                        // Use highlighted body value if available, otherwise fall back to the plain body
                                                        const bodyContent = article._highlightResult?.body?.value || article.body;

                                                        if (!bodyContent) {
                                                            return null; // Return nothing if there is no body content
                                                        }

                                                        // Split the content by ' -- '
                                                        const parts = bodyContent.split(' -- ');

                                                        // Use the part after ' -- ' if it exists, otherwise use the original content. Trim whitespace.
                                                        const mainContent = (parts.length > 1 ? parts[1] : parts[0]).trim();

                                                        // The renderHighlightedText function will correctly render the string,
                                                        // whether it contains the <mark> tags or is just plain text.
                                                        return renderHighlightedText(mainContent);
                                                    })()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="mt-8 flex justify-center items-center gap-1 sm:gap-2 flex-wrap">
                                        <button
                                            onClick={() => handlePageChange(0)}
                                            disabled={currentPage === 0}
                                            className="px-2 sm:px-3 py-1 text-gray-600 disabled:opacity-50"
                                            aria-label="First page"
                                        >
                                            «
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 0}
                                            className="px-2 sm:px-3 py-1 text-gray-600 disabled:opacity-50"
                                            aria-label="Previous page"
                                        >
                                            ‹
                                        </button>

                                        {/* Page Numbers */}
                                        {getPageNumbers().map(page => (
                                            <button
                                                key={page}
                                                onClick={() => handlePageChange(page)}
                                                className={`px-2 sm:px-3 py-1 rounded-full ${currentPage === page
                                                    ? 'bg-key-color text-white'
                                                    : 'text-gray-600 hover:bg-gray-100'
                                                    }`}
                                                aria-label={`Page ${page + 1}`}
                                                aria-current={currentPage === page ? 'page' : undefined}
                                            >
                                                {page + 1}
                                            </button>
                                        ))}

                                        {/* Ellipsis and Last Page for larger page counts */}
                                        {totalPages > (isMobile ? 3 : 5) && currentPage < totalPages - (isMobile ? 1 : 2) && (
                                            <span className="px-2 sm:px-3 py-1 text-gray-600">...</span>
                                        )}
                                        {totalPages > (isMobile ? 3 : 5) && currentPage < totalPages - (isMobile ? 1 : 2) && (
                                            <button
                                                onClick={() => handlePageChange(totalPages - 1)}
                                                className={`px-2 sm:px-3 py-1 rounded-full ${currentPage === totalPages - 1
                                                    ? 'bg-[#E4287C] text-white'
                                                    : 'text-gray-600 hover:bg-gray-100'}`}
                                                aria-label={`Page ${totalPages}`}
                                            >
                                                {totalPages}
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages - 1}
                                            className="px-2 sm:px-3 py-1 text-gray-600 disabled:opacity-50"
                                            aria-label="Next page"
                                        >
                                            ›
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(totalPages - 1)}
                                            disabled={currentPage === totalPages - 1}
                                            className="px-2 sm:px-3 py-1 text-gray-600 disabled:opacity-50"
                                            aria-label="Last page"
                                        >
                                            »
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}