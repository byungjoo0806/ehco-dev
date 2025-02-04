'use client';

// Modified Header.tsx
import { Menu, Search, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef, Suspense } from 'react';
import SlidingMenu from './SlidingMenu';
import SearchSlider from './SearchSlider';
import { useRouter } from 'next/navigation';
import algoliasearch, { SearchIndex } from 'algoliasearch';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const searchClient = algoliasearch(
  "B1QF6MLIU5",
  "ef0535bdd12e549ffa7c9541395432a1"
);

type AlgoliaResult = {
  objectID: string;
  type: 'celebrity' | 'news';
  name?: string;
  title?: string;
  koreanName?: string;
  profilePic?: string;
  content?: string;
  formatted_date?: string;
  mainCategory?: string;
  thumbnail?: string;
  source?: string;
  url?: string;
  _highlightResult?: {
    name?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
    content?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
    koreanName?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
    title?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    }
  };
}

type SearchResultHit = {
  objectID: string;
  name?: string;
  title?: string;
  koreanName?: string;
  profilePic?: string;
  content?: string;
  date?: string;
  mainCategory?: string;
  thumbnail?: string;
  source?: string;
  url?: string;
  _highlightResult?: {
    name?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
    content?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
    koreanName?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
    title?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    }
  };
};

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<AlgoliaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

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

  useEffect(() => {
    console.log('pathname changed:', pathname);
    console.log('isNavigating:', isNavigating);
    setIsNavigating(false);
  }, [pathname]);

  const handleSearchedArticleClick = (article: AlgoliaResult) => {
    if (article.url) {
      window.open(article.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSeeMoreResults = () => {
    setIsNavigating(true);
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  }

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    try {
      interface MultipleSearchResponse {
        results: Array<{
          hits: SearchResultHit[];
          nbHits: number;
          page: number;
          nbPages: number;
          hitsPerPage: number;
          exhaustiveNbHits: boolean;
          query: string;
          params: string;
        }>;
      }

      const response = await searchClient.multipleQueries<SearchResultHit>([{
        indexName: "celebrities_name_asc",
        query: query,
        params: {
          hitsPerPage: 5,
          attributesToHighlight: ['name', 'koreanName'],
          highlightPreTag: '<mark class="bg-yellow-200">',
          highlightPostTag: '</mark>',
          queryType: 'prefixAll',
          typoTolerance: true
        }
      }, {
        indexName: "news",
        query: query,
        params: {
          hitsPerPage: 5,
          attributesToHighlight: ['title', 'content'],
          highlightPreTag: '<mark class="bg-yellow-200">',
          highlightPostTag: '</mark>'
        }
      }]) as MultipleSearchResponse;

      const combinedResults = response.results.flatMap((result, index) =>
        result.hits.map(hit => ({
          ...hit,
          type: index === 0 ? 'celebrity' : 'news'
        } as AlgoliaResult))
      );

      console.log(combinedResults);
      setSearchResults(combinedResults);
      setShowResults(true);
    } catch (error) {
      console.error('Algolia search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    performSearch(query);
  };

  // Add this function to safely render HTML content
  const renderHighlightedText = (text: string) => {
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  const renderSearchResult = (result: AlgoliaResult) => {
    if (result.type === 'celebrity') {
      return (
        <Link
          key={result.objectID}
          href={`/${result.objectID}`}
          className="flex flex-row items-center px-3 py-2 hover:bg-gray-100"
          onClick={() => {
            setShowResults(false);
            setSearchQuery('');
          }}
        >
          {result.profilePic && (
            <img
              src={result.profilePic}
              alt={result.name}
              className="w-16 h-16 rounded-full"
            />
          )}
          <div className="flex-1 pl-2">
            <div className="font-medium text-md">
              {result._highlightResult?.name ?
                renderHighlightedText(result._highlightResult.name.value) :
                result.name}
            </div>
            {result.koreanName && (
              <div className="text-sm text-gray-500">
                {result._highlightResult?.koreanName ?
                  renderHighlightedText(result._highlightResult.koreanName.value) :
                  result.koreanName}
              </div>
            )}
          </div>
        </Link>
      );
    }

    return (
      <div
        key={result.objectID}
        onClick={() => {
          handleSearchedArticleClick(result);
          setSearchQuery('');
        }}
        className="w-[90%] flex flex-col sm:flex-row items-center bg-white border border-slate-200 pl-2 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden cursor-pointer my-2"
      >
        {result.thumbnail && (
          <div className="sm:w-1/4 flex justify-center items-center">
            <img
              src={result.thumbnail}
              alt="Image Unavailable"
              className="w-48 h-48 sm:w-[90%] sm:h-40 object-contain"
            />
          </div>
        )}
        <div className="p-4 sm:w-3/4">
          <h3 className="text-md sm:text-base font-semibold mb-2">
            {result._highlightResult?.title ?
              renderHighlightedText(result._highlightResult.title.value) :
              result.title}
          </h3>
          <div className="text-sm sm:text-xs text-gray-600 flex items-center mb-2">
            <span>{result.source}</span>
            <span>•</span>
            <span>{result.formatted_date}</span>
            {result.mainCategory && (
              <span className="bg-gray-200 rounded-full px-3 py-1 text-sm sm:text-xs text-gray-700 mx-2">
                {result.mainCategory}
              </span>
            )}
          </div>
          {result.content && (
            <p className="text-gray-700 text-sm sm:text-xs line-clamp-3">
              {result._highlightResult?.content ?
                renderHighlightedText(result._highlightResult.content.value) :
                result.content}
            </p>
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

                        {searchResults.some(result => result.type === 'news') && (
                          <div className="w-full flex flex-col items-center">
                            <div className="w-full px-3 py-2 bg-gray-50 border-b">
                              <p className='text-xs font-semibold text-gray-600'>Articles</p>
                            </div>
                            {searchResults
                              .filter(result => result.type === 'news')
                              .map(renderSearchResult)}

                            {/* Moved "see more" link to bottom */}
                            <div className="w-full border-t py-2 mt-2">
                              <div className="flex items-center justify-center hover:bg-gray-50 py-2 cursor-pointer"
                                onClick={handleSeeMoreResults}>
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