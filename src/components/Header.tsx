'use client';

// Modified Header.tsx
import { Menu, Search, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useAllCelebrities } from '@/lib/hooks/useAllCelebrities';
import { SearchResult } from '@/lib/search';
import { debounce } from 'lodash';
import SlidingMenu from './SlidingMenu';
import SearchSlider from './SearchSlider';
import { useRouter } from 'next/navigation';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { celebrities } = useAllCelebrities();

  const router = useRouter();

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

  const handleSearchedArticleclick = (article: SearchResult) => {
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  const performSearch = async (query: string) => {
    setIsSearching(true);

    try {
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

      const articleResponse = await fetch(`/api/news/search?q=${encodeURIComponent(query)}&limit=5`);
      if (!articleResponse.ok) {
        throw new Error('Failed to fetch articles');
      }
      const articles = await articleResponse.json();
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

      const combinedResults = [...celebrityResults, ...articleResults];
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

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300),
    [celebrities]
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
            <img src={result.profilePic} alt={result.name} className="w-16 h-16 rounded-full" />
          )}
          <div className="flex-1 pl-2">
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
          handleSearchedArticleclick(result);
          setSearchQuery('');
        }}
        className="w-[90%] flex flex-col sm:flex-row items-center bg-white border border-slate-200 pl-2 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer my-2"
      >
        {result.thumbnail && (
          <div className="sm:w-1/4 flex justify-center items-center">
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
      <header className="w-full border-b dark:border-b-black bg-white dark:bg-black">
        <div className="w-[90%] md:w-[75%] lg:w-[60%] mx-auto px-4 h-16 flex justify-center items-center">
          <div className="w-full h-full flex">
            {/* Left section with menu */}
            <div className="flex justify-start items-center w-1/3 text-black dark:text-white">
              <Menu onClick={() => setIsMenuOpen(!isMenuOpen)} className="cursor-pointer" />
            </div>

            {/* Center section with logo */}
            <div className="w-1/3 flex-1 flex justify-center items-center">
              <Link href="/" className="text-xl sm:text-2xl font-bold text-key-color">
                EHCO
              </Link>
            </div>

            {/* Right section with search */}
            <div className="w-1/3 flex justify-end items-center">
              {/* Desktop search with dropdown */}
              <div className="hidden sm:block sm:w-2/3 relative" ref={searchRef}>
                <div className="relative flex items-center">
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
                </div>

                {/* Desktop Search Results Dropdown */}
                {isSearching ? (
                  <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-48 sm:w-[400%] z-50">
                    <div className="px-3 py-3 text-sm text-gray-500 text-center">
                      Loading...
                    </div>
                  </div>
                ) : (
                  <>
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-80 sm:w-[400%] max-h-96 overflow-y-auto z-50">
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

                        {searchResults.some(result => result.type === 'article') && (
                          <div className="w-full flex flex-col items-center">
                            <div className="w-full px-3 py-2 bg-gray-50 border-b">
                              <p className='text-xs font-semibold text-gray-600'>Articles</p>
                            </div>
                            {searchResults
                              .filter(result => result.type === 'article')
                              .map(renderSearchResult)}

                            {/* Moved "see more" link to bottom */}
                            <div className="w-full border-t py-2 mt-2">
                              <div className="flex items-center justify-center hover:bg-gray-50 py-2 cursor-pointer"
                                onClick={() => {
                                  router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
                                  setSearchQuery('');
                                  setSearchResults([]);
                                  setShowResults(false);
                                }}>
                                <span className="text-sm text-blue-500 pr-1">See more results</span>
                                <ArrowRight size={16} className="text-blue-500" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {showResults && searchQuery && searchResults.length === 0 && (
                      <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-48 sm:w-64 z-50">
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">
                          No results found
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Mobile search icon */}
              <div className="sm:hidden">
                <Search
                  className="cursor-pointer"
                  onClick={() => setIsSearchOpen(true)}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={
        <div className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-500 shadow-lg z-50 transform -translate-x-full">
          <div className='w-full h-16 px-8 flex justify-start items-center border-b border-b-black dark:border-b-white'>
            <p className='text-xl font-bold text-black dark:text-white'>Loading...</p>
          </div>
        </div>
      }>
        <SlidingMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      </Suspense>
      <SearchSlider isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}