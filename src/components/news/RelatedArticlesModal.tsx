'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useRelatedArticles } from '@/lib/hooks/useRelatedArticles';
import { NewsItem } from '@/lib/hooks/useNews';
import Link from 'next/link';
import { useNewsItems } from '@/lib/hooks/useNewsItem';

interface RelatedArticlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: NewsItem | null;
  relatedArticleIds: string[];
}

interface EnhancedNewsItem extends NewsItem {
  relationship?: string;
}

export default function RelatedArticlesModal({
  isOpen,
  onClose,
  article,
  relatedArticleIds
}: RelatedArticlesModalProps) {
  const { newsItems, isLoading, hasError, validNewsItems } = useNewsItems(relatedArticleIds);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Related Articles</DialogTitle>
          <DialogDescription>
            Articles related to &quot;{article?.title}&quot;
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {hasError && (
          <div className="text-red-500 text-center py-4">
            Error loading related articles
          </div>
        )}

        {!isLoading && !hasError && (
          <div className="space-y-4">
            {validNewsItems.map(({ newsItem }) => (
              <div
                key={newsItem?.id}
                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => window.open(newsItem?.url, '_blank', 'noopener,noreferrer')}
              >
                <h4 className="font-medium mb-2">{newsItem?.title}</h4>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>{newsItem?.source}</span>
                  <span>•</span>
                  <span>{newsItem?.formatted_date}</span>
                </div>
                <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                  {newsItem?.content}
                </p>
              </div>
            ))}

            {validNewsItems.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No related articles found
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}