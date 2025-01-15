'use client';

import { Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import SlidingMenu from './SlidingMenu';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAllCelebrities } from '@/lib/hooks/useAllCelebrities';
import { SearchResult } from '@/lib/search';
import { debounce } from 'lodash';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { celebrities } = useAllCelebrities();

  // Handle clicks outside of search results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // searched article click
  const handleSearchedArticleclick = (article: SearchResult) => {
    // console.log(article);
    window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  // Search function that combines both celebrity and article results
  const performSearch = async (query: string) => {
    setIsSearching(true);

    try {
      // Celebrity search (client-side)
      const celebrityResults: SearchResult[] = celebrities
        .filter(celebrity => {
          if (!celebrity) return false;
          const searchTermLower = query.toLowerCase();

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
      // console.log(celebrityResults);

      // Article search (server-side)
      const articleResponse = await fetch(`/api/news/search?q=${encodeURIComponent(query)}&limit=5`);
      if (!articleResponse.ok) {
        throw new Error('Failed to fetch articles');
      }
      const articles = await articleResponse.json();
      // console.log(articles);
      const articleResults: SearchResult[] = articles.map((article: SearchResult) => ({
        type: 'article' as const,
        id: article.id,
        name: article.name,
        content: article.content,
        date: article.date,
        category: article.category,
        celebrity: article.celebrity,
        thumbnail: article.thumbnail,
        source: article.source,
        url: article.url
      }));

      // Combine and sort results
      const combinedResults = [...celebrityResults, ...articleResults];
      // console.log(combinedResults);

      // Sort by exact matches first
      combinedResults.sort((a, b) => {
        const aExactMatch = a.name.toLowerCase() === query.toLowerCase();
        const bExactMatch = b.name.toLowerCase() === query.toLowerCase();

        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        return 0;
      });

      setSearchResults(combinedResults);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  // console.log(searchResults);

  // Debounced search to prevent too many API calls
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300),
    [celebrities] // Dependency on celebrities since we use it in search
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const renderSearchResult = (result: SearchResult) => {
    if (result.type === 'celebrity') {
      return (
        <Link
          key={result.id}
          href={`/${result.id}`}
          className="flex flex-row items-center px-3 py-2 hover:bg-gray-100"
          onClick={() => {
            setShowResults(false);
            setSearchQuery('');
          }}
        >
          {result.profilePic && (
            <img src={result.profilePic} alt={result.name} className='w-16 h-16 rounded-full' />
          )}
          <div className='flex-1 pl-2'>
            <div className="font-medium text-md">{result.name}</div>
            {result.koreanName && (
              <div className="text-sm text-gray-500">{result.koreanName}</div>
            )}
          </div>
        </Link>
      );
    }

    return (
      <div
        key={result.id}
        onClick={() => {
          // Handle click event (e.g., navigate to article)
          handleSearchedArticleclick(result);
          // setShowResults(false);
          setSearchQuery('');
        }}
        className="w-[90%] flex flex-col sm:flex-row items-center bg-white border border-slate-200 pl-2 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer my-2"
      >
        {result.thumbnail && (
          <div className='sm:w-1/4 flex justify-center items-center'>
            <img
              src={result.thumbnail}
              alt={result.name}
              className="w-48 h-48 sm:w-[90%] sm:h-40 object-contain"
            />
          </div>
        )}
        <div className="p-4 sm:w-3/4">
          <h3 className="text-md sm:text-base font-semibold mb-2">{result.name}</h3>
          <div className="text-sm sm:text-xs text-gray-600 mb-2">
            {result.source} • {result.date}
          </div>
          {result.category && (
            <span className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm sm:text-xs text-gray-700 mr-2 mb-2">
              {result.category}
            </span>
          )}
          {result.content && (
            <p className="text-gray-700 text-sm sm:text-xs line-clamp-3">{result.content}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 h-16 flex justify-center items-center">
          <div className='w-[90%] md:w-[75%] lg:w-[60%] h-full flex'>
            {/* Left section with menu */}
            <div className="flex justify-start items-center w-1/3">
              <Menu onClick={() => setIsOpen(!isOpen)} className="cursor-pointer" />
            </div>

            {/* Center section with logo */}
            <div className="w-1/3 flex-1 flex justify-center items-center">
              <Link href="/" className="text-xl sm:text-2xl font-bold text-key-color">
                EHCO
              </Link>
            </div>

            {/* Right section with search */}
            <div className="w-1/3 flex justify-end" ref={searchRef}>
              <div className="sm:w-2/3 relative flex flex-row items-center">
                <Search className="absolute left-2 text-gray-400" size={16} />
                {searchQuery && (
                  <X
                    className="absolute right-2 text-gray-400 cursor-pointer"
                    size={16}
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setShowResults(false);
                    }}
                  />
                )}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleInputChange}
                  placeholder="Search"
                  className="pl-8 pr-8 py-1.5 border rounded-lg w-full text-sm"
                />

                {/* Loading State */}
                {isSearching ? (
                  <div className="absolute top-[80%] right-0 mt-1 bg-white border rounded-lg shadow-lg w-48 sm:w-64 z-50">
                    <div className="px-3 py-3 text-sm text-gray-500 text-center">
                      Loading...
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search Results */}
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute top-[80%] right-0 mt-1 bg-white border rounded-lg shadow-lg w-80 sm:w-[400%] max-h-96 overflow-y-auto z-50">
                        {/* Celebrity Results Section */}
                        {searchResults.some(result => result.type === 'celebrity') && (
                          <div>
                            <div className="px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">
                              Celebrities
                            </div>
                            {searchResults
                              .filter(result => result.type === 'celebrity')
                              .map(renderSearchResult)}
                          </div>
                        )}

                        {/* Article Results Section */}
                        {searchResults.some(result => result.type === 'article') && (
                          <div className='w-full flex flex-col items-center'>
                            <div className="w-full px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">
                              Articles
                            </div>
                            {searchResults
                              .filter(result => result.type === 'article')
                              .map(renderSearchResult)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* No Results State */}
                    {showResults && searchQuery && searchResults.length === 0 && (
                      <div className="absolute top-[80%] right-0 mt-1 bg-white border rounded-lg shadow-lg w-48 sm:w-64 z-50">
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">
                          No results found
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <SlidingMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}