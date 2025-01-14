// src/lib/hooks/useNews.ts
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  formatted_date: string;
  content: string;
  mainCategory: string;
  subCategory?: string;
  thumbnail?: string;
  url: string;
  celebrity: string;
  // New fields for article grouping
  topicHeader?: string;
  contextLine?: string;
  relatedArticles?: string[];
  isMainArticle?: boolean;
  mainArticleId?: string;
}

export function useNews(celebrityId: string, category: string | null) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNews() {
      try {
        setLoading(true);
        setError(null);

        // console.log('Fetching news for:', celebrity);
        // console.log('Selected category:', category);

        // Base query for all articles
        let q = query(
          collection(db, 'news'),
          where('celebrity', '==', celebrityId),
          orderBy('formatted_date', 'desc')
        );

        // Add category filter if selected
        if (category) {
          // console.log('Adding category filter:', category);
          q = query(
            collection(db, 'news'),
            where('celebrity', '==', celebrityId),
            where('mainCategory', '==', category),
            orderBy('formatted_date', 'desc')
          );
        }

        const querySnapshot = await getDocs(q);
        // console.log(`Found ${querySnapshot.docs.length} articles`);

        // Count articles by category
        const categoryCounts = querySnapshot.docs.reduce((acc, doc) => {
          const category = doc.data().mainCategory;
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        // console.log('Articles by category:', categoryCounts);

        const newsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // console.log('Article mainCategory:', data.mainCategory);
          return {
            id: doc.id,
            ...data,
            // Ensure we're using formatted_date consistently
            date: data.formatted_date || (data.date instanceof Timestamp ?
              data.date.toDate().toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }).replace(/\./g, '')
              : data.date),
            // Ensure all our new fields are included
            topicHeader: data.topicHeader || '',
            contextLine: data.contextLine || '',
            relatedArticles: data.relatedArticles || [],
            isMainArticle: data.isMainArticle || false,
            mainArticleId: data.mainArticleId || null
          } as NewsItem;
        });

        // Sort to ensure main articles appear first
        const sortedNews = newsData.sort((a, b) => {
          // First sort by isMainArticle (true comes first)
          if (a.isMainArticle && !b.isMainArticle) return -1;
          if (!a.isMainArticle && b.isMainArticle) return 1;

          // Then sort by date
          return new Date(b.formatted_date).getTime() - new Date(a.formatted_date).getTime();
        });

        // console.log('Final sorted news array length:', sortedNews.length);
        // console.log('Sample article:', sortedNews[0]);
        setNews(sortedNews);
      } catch (err) {
        console.error('Error fetching news:', err);
        setError('Failed to fetch news');
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [celebrityId, category]);

  return { news, loading, error };
}