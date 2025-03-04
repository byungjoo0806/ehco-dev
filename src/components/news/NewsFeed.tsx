'use client';

import React, { useState } from 'react';
import { useNews } from '@/lib/hooks/useNews';
import type { NewsItem } from '@/lib/hooks/useNews';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import RelatedArticlesModal from './RelatedArticlesModal';
import { useCelebrity } from '@/lib/hooks/useCelebrity';
import { useSearchParams, useRouter } from 'next/navigation';

interface NewsFeedProps {
  celebrityId: string;
  selectedCategory: string | null;
  sortOrder: 'newest' | 'oldest';
}

const ITEMS_PER_PAGE = 10;

export default function NewsFeed({ celebrityId, selectedCategory, sortOrder }: NewsFeedProps) {
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const { news, loading, error } = useNews(celebrityId, selectedCategory);
  const { celebrity } = useCelebrity(celebrityId);

  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;

  // Replace all instances of setCurrentPage with this function
  const handlePageChange = (newPage: number) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('page', newPage.toString());
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${window.location.pathname}${query}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-4 bg-gray-100 rounded w-2/3 mb-4" />
            <div className="flex gap-4 bg-white rounded-lg">
              <div className="w-32 h-24 bg-gray-200 rounded-l-lg" />
              <div className="flex-1 py-3 pr-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error loading news: {error}
      </div>
    );
  }

  // Group articles by mainArticleId
  const groupedArticles: { [key: string]: NewsItem[] } = {};
  const standaloneArticles: NewsItem[] = [];

  news.forEach((article) => {
    if (article.isMainArticle) {
      groupedArticles[article.id] = [article];
    } else if (article.mainArticleId) {
      if (!groupedArticles[article.mainArticleId]) {
        groupedArticles[article.mainArticleId] = [];
      }
      groupedArticles[article.mainArticleId].push(article);
    } else {
      standaloneArticles.push(article);
    }
  });

  // Store related articles for each main article
  const relatedArticlesMap: { [key: string]: NewsItem[] } = {};
  Object.entries(groupedArticles).forEach(([mainArticleId, group]) => {
    relatedArticlesMap[mainArticleId] = group.filter(article => !article.isMainArticle);
  });

  // Prepare articles for pagination
  const allArticles = [
    ...Object.entries(groupedArticles).map(([_id, group]) => {
      const mainArticle = group.find(article => article.isMainArticle);
      if (!mainArticle) return null;
      return { ...mainArticle, relatedArticlesCount: group.filter(article => !article.isMainArticle).length };
    }),
    ...standaloneArticles.map(article => ({
      ...article,
      relatedArticlesCount: news.filter(a => a.mainArticleId === article.id).length
    }))
  ].filter((article): article is NewsItem & { relatedArticlesCount: number } => article !== null);

  // Add this sorting logic before the pagination calculation
  const sortedArticles = [...allArticles].sort((a, b) => {
    const dateA = new Date(a.formatted_date);
    const dateB = new Date(b.formatted_date);
    return sortOrder === 'newest' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedArticles.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentArticles = sortedArticles.slice(startIndex, endIndex);

  const renderArticle = (article: NewsItem & { relatedArticlesCount: number }) => {
    const handleArticleClick = (e: React.MouseEvent) => {
      // Check if text is being selected
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return; // Don't open the link if text is being selected
      }

      // Check if the user was dragging
      if (e.detail === 0) {
        return; // Don't open the link if the user was dragging
      }

      window.open(article.url, '_blank', 'noopener,noreferrer');
    };

    return (
      <div
        key={article.id}
        className="bg-white dark:bg-slate-500 rounded-lg hover:shadow-md transition-all duration-200 flex flex-col"
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              "headline": article.title,
              "datePublished": article.formatted_date,
              "dateModified": article.formatted_date,
              "description": article.content,
              "image": article.thumbnail,
              "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": `https://ehco.ai/news/${article.id}`
              },
              "author": {
                "@type": "Organization",
                "name": "EHCO"
              },
              "publisher": {
                "@type": "Organization",
                "name": "EHCO",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://ehco.ai/logo.png"
                }
              },
              "articleSection": article.mainCategory,
              "keywords": [
                celebrity?.name,
                celebrity?.koreanName,
                article.mainCategory,
                "Korean entertainment",
                "K-pop news"
              ]
            })
          }}
        />
        <div
          className="flex flex-col items-center md:flex-row gap-4 p-4 cursor-pointer border border-slate-200 rounded-lg shadow-md"
          onClick={handleArticleClick}
        >
          {article.thumbnail && (
            <img
              src={article.thumbnail}
              alt={article.title}
              className="w-32 h-24 object-cover rounded-l-lg flex-shrink-0"
              draggable={false}
            />
          )}
          <div className="flex-1">
            <h4 className="font-medium mb-1 text-lg hover:text-blue-600 transition-colors">
              {article.title}
            </h4>
            <div className="flex items-center space-x-2">
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
        {article.relatedArticlesCount > 0 && (
          <div
            className="border-t border-gray-100 p-3 flex items-center justify-end cursor-pointer hover:bg-gray-50 rounded-b-lg group"
            onClick={() => setSelectedArticle(article)}
          >
            <span className="text-sm text-gray-600 mr-2 group-hover:text-blue-600">
              View {article.relatedArticlesCount} related articles
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
          </div>
        )}
      </div>
    )
  };

  const renderPagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="mt-8 flex items-center justify-center gap-2">
        {page > 1 && (
          <button
            onClick={() => handlePageChange(page - 1)}
            className="p-2 rounded hover:bg-gray-50"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        <div className="flex items-center gap-1">
          {startPage > 1 && (
            <>
              <button
                onClick={() => handlePageChange(1)}
                className="px-3 py-1 rounded hover:bg-gray-50"
              >
                1
              </button>
              {startPage > 2 && <span className="px-2">...</span>}
            </>
          )}

          {pageNumbers.map(number => (
            <button
              key={number}
              onClick={() => handlePageChange(number)}
              className={`px-3 py-1 rounded ${page === number
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-50'
                }`}
            >
              {number}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-2">...</span>}
              <button
                onClick={() => handlePageChange(totalPages)}
                className="px-3 py-1 rounded hover:bg-gray-50"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        {page < totalPages && (
          <button
            onClick={() => handlePageChange(page + 1)}
            className="p-2 rounded hover:bg-gray-50"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center my-6">
        <h2 className="text-lg font-medium">Timeline</h2>
        {allArticles.length > 0 && (
          <span className="text-sm text-gray-500">
            Showing {startIndex + 1}-{Math.min(endIndex, allArticles.length)} of {allArticles.length} articles
          </span>
        )}
      </div>

      <div className="space-y-8">
        {currentArticles.map(article => renderArticle(article))}

        {currentArticles.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No news articles found in this category.
          </div>
        )}
      </div>

      {totalPages > 1 && renderPagination()}

      <RelatedArticlesModal
        isOpen={selectedArticle !== null}
        onClose={() => setSelectedArticle(null)}
        article={selectedArticle}
        relatedArticleIds={selectedArticle?.relatedArticles ?? []}
      />
    </div>
  );
}