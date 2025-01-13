'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useRelatedArticles } from '@/lib/hooks/useRelatedArticles';
import { NewsItem } from '@/lib/hooks/useNews';
import Link from 'next/link';

interface RelatedArticlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: NewsItem | null;
  celebrity: string;
}

interface EnhancedNewsItem extends NewsItem {
  relationship?: string;
}

export default function RelatedArticlesModal({
  isOpen,
  onClose,
  article,
  celebrity
}: RelatedArticlesModalProps) {
  const { relatedArticles, loading, error } = useRelatedArticles(article, celebrity);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Related Articles</DialogTitle>
          <DialogDescription>
            Articles related to &quot;{article?.title}&quot;
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        )}

        {error && (
          <div className="text-center py-4 text-red-500">{error}</div>
        )}

        {!loading && !error && relatedArticles && relatedArticles.length > 0 ? (
          <div className="space-y-4">
            {(relatedArticles as EnhancedNewsItem[]).map((related) => (
              <div key={related.id} className="border-b border-gray-100 last:border-0">
                <Link
                  href={related.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex gap-4 p-4">
                    {related.thumbnail && (
                      // consider <Image /> from "next/image"
                      <img
                        src={related.thumbnail}
                        alt={related.title}
                        className="w-24 h-24 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">{related.title}</h3>
                      <div className="text-sm text-gray-500 mb-2">
                        {related.source} • {related.formatted_date}
                      </div>
                      {related.relationship && (
                        <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
                          {related.relationship}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No related articles found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}