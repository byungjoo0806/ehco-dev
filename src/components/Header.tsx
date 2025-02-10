'use client';

import { Loader2, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef, Suspense } from 'react';
import SlidingMenu from './SlidingMenu';
import SearchSlider from './SearchSlider';
import algoliasearch from 'algoliasearch';
import { useRouter } from 'next/navigation';

const searchClient = algoliasearch(
  "B1QF6MLIU5",
  "ef0535bdd12e549ffa7c9541395432a1"
);

type Celebrity = {
  objectID: string;
  type: 'celebrity';
  name?: string;
  title?: string;
  koreanName?: string;
  profilePic?: string;
  _highlightResult?: {
    name?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
    koreanName?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
  };
}

const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
      <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
      <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
    </div>
  </div>
);

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<Celebrity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
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

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    try {
      const { hits } = await searchClient.initIndex('celebrities_name_asc').search<Celebrity>(query, {
        hitsPerPage: 5,
        attributesToHighlight: ['name', 'koreanName'],
        highlightPreTag: '<mark class="bg-yellow-200">',
        highlightPostTag: '</mark>',
        queryType: 'prefixAll',
        typoTolerance: true
      });

      setSearchResults(hits.map(hit => ({ ...hit, type: 'celebrity' })));
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

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);
    router.push('/');

    // Since App Router's push() doesn't return a promise,
    // we'll use a small timeout to remove the loading state
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const renderHighlightedText = (text: string) => {
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  const renderSearchResult = (result: Celebrity) => (
    <Link
      key={result.objectID}
      href={`/${result.objectID}`}
      className="w-64 flex flex-row items-center px-3 py-2 hover:bg-gray-100"
      onClick={(e) => {
        e.preventDefault();
        setShowResults(false);
        setSearchQuery('');
        setIsLoading(true);
        router.push(`/${result.objectID}`);

        // Remove loading state after a short delay
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
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

  return (
    <>
      <header className="w-full border-b dark:border-b-black bg-white dark:bg-black">
        <div className="w-[90%] md:w-[80%] mx-auto px-4 h-16 flex justify-center items-center">
          <div className="w-full h-full flex">
            {/* Left section with menu */}
            <div className="flex justify-start items-center w-1/3 text-black dark:text-white">
              <Menu onClick={() => setIsMenuOpen(!isMenuOpen)} className="cursor-pointer" />
            </div>

            {/* Center section with logo */}
            <div className="w-1/3 flex-1 flex justify-center items-center">
              <Link
                href="/"
                onClick={handleLogoClick}
                className="text-xl sm:text-2xl font-bold text-key-color"
              >
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
                    placeholder="Search celebrities"
                    className="pl-8 pr-8 py-1.5 border rounded-lg w-full text-sm"
                  />
                </div>

                {/* Search Results Dropdown */}
                {isSearching ? (
                  <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-64 z-50">
                    <div className="px-3 py-3 text-sm text-gray-500 text-center">
                      Loading...
                    </div>
                  </div>
                ) : (
                  <>
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-64 max-h-96 overflow-y-auto z-50">
                        {searchResults.map(renderSearchResult)}
                      </div>
                    )}

                    {showResults && searchQuery && searchResults.length === 0 && (
                      <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-64 z-50">
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

      {isLoading && <LoadingOverlay />}

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