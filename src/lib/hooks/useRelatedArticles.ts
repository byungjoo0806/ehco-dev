import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { NewsItem } from './useNews';

interface EnhancedNewsItem extends NewsItem {
  relationship?: string;
}

export function useRelatedArticles(article: NewsItem | null, celebrity: string) {
  const [relatedArticles, setRelatedArticles] = useState<EnhancedNewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRelatedArticles() {
      if (!article) return;
      
      try {
        setLoading(true);
        setError(null);

        // Fetch potential related articles from Firebase
        const q = query(
          collection(db, 'news'),
          where('celebrity', '==', celebrity),
          orderBy('formatted_date', 'desc'),
          limit(10) // Fetch more than we'll display to give Ollama more context
        );

        const querySnapshot = await getDocs(q);
        const potentialArticles = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as NewsItem))
          .filter(a => a.id !== article.id); // Exclude current article

        // Send to our API for Ollama analysis
        const response = await fetch('/api/analyze-relations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mainArticle: article,
            potentialRelated: potentialArticles
          })
        });

        if (!response.ok) {
          throw new Error('Failed to analyze articles');
        }

        const { relatedArticles: analyzedArticles } = await response.json();
        setRelatedArticles(analyzedArticles);

      } catch (err) {
        console.error('Error fetching related articles:', err);
        setError('Failed to load related articles');
      } finally {
        setLoading(false);
      }
    }

    fetchRelatedArticles();
  }, [article, celebrity]);

  return { relatedArticles, loading, error };
}