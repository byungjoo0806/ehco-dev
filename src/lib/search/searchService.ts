// lib/search/searchService.ts
import { Celebrity, Article, SearchResult } from './types';

export class SearchService {
  private celebrities: Celebrity[] = [];

  constructor(celebrities: Celebrity[] = []) {
    this.celebrities = celebrities;
  }

  public updateCelebrities(celebrities: Celebrity[]) {
    this.celebrities = celebrities;
  }

  private searchCelebrities(query: string): SearchResult[] {
    const searchTermLower = query.toLowerCase();

    return this.celebrities
      .filter(celebrity => {
        if (!celebrity) return false;

        const matchesEnglishName = celebrity.name ?
          celebrity.name.toLowerCase().includes(searchTermLower) : false;

        const matchesKoreanName = celebrity.koreanName ?
          celebrity.koreanName.includes(query) : false;

        return matchesEnglishName || matchesKoreanName;
      })
      .map(({ id, name, koreanName, profilePic }) => ({
        type: 'celebrity' as const,
        id,
        name,
        koreanName,
        profilePic
      }));
  }

  private async searchArticles(query: string): Promise<SearchResult[]> {
    try {
      // Fetch articles from API with search parameters
      const response = await fetch(`/api/articles/search?q=${encodeURIComponent(query)}&limit=5`);

      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }

      const articles: Article[] = await response.json();

      return articles.map(({ id, title, koreanTitle, excerpt }) => ({
        type: 'article' as const,
        id,
        name: title,
        koreanName: koreanTitle,
        excerpt
      }));
    } catch (error) {
      console.error('Error searching articles:', error);
      return [];
    }
  }

  public async search(query: string, options: {
    includeCelebrities?: boolean;
    includeArticles?: boolean;
  } = {}): Promise<SearchResult[]> {
    const {
      includeCelebrities = true,
      includeArticles = true,
    } = options;

    if (query.trim() === '') {
      return [];
    }

    const results: SearchResult[] = [];

    if (includeCelebrities) {
      results.push(...this.searchCelebrities(query));
    }

    if (includeArticles) {
      const articleResults = await this.searchArticles(query);
      results.push(...articleResults);
    }

    // Sort results by relevance (exact matches first)
    results.sort((a, b) => {
      const aExactMatch = a.name.toLowerCase() === query.toLowerCase();
      const bExactMatch = b.name.toLowerCase() === query.toLowerCase();

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      return 0;
    });

    return results;
  }
}