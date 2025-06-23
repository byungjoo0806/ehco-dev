'use client';

import { Loader2, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef, Suspense } from 'react';
import SlidingMenu from './SlidingMenu';
import SearchSlider from './SearchSlider';
import algoliasearch from 'algoliasearch';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

const searchClient = algoliasearch(
  "B1QF6MLIU5",
  "ef0535bdd12e549ffa7c9541395432a1"
);

type PublicFigure = {
  objectID: string;
  name?: string;
  name_kr?: string;
  profilePic?: string;
  _highlightResult?: {
    name?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
    name_kr?: {
      value: string;
      matchLevel: string;
      matchedWords: string[];
    };
  };
}

const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
    <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
      <Loader2 className="animate-spin text-slate-600" size={24} />
      <span className="text-slate-600 font-medium">Loading...</span>
    </div>
  </div>
);

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<PublicFigure[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Check if current page is home page
  const isHomePage = pathname === '/';
  const isAllFiguresPage = pathname === '/all-figures';

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
      const { hits } = await searchClient.initIndex('selected-figures').search<PublicFigure>(query, {
        hitsPerPage: 5,
        attributesToHighlight: ['name', 'name_kr'],
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      setShowResults(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setShowResults(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);
    router.push('/');

    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const renderHighlightedText = (text: string) => {
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  const renderSearchResult = (result: PublicFigure) => (
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

        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }}
    >
      {result.profilePic && (
        <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
          <Image
            src={result.profilePic}
            alt={result.name || 'Profile picture'}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
      )}
      <div className="flex-1 pl-2">
        <div className="font-medium text-md text-black">
          {result._highlightResult?.name ?
            renderHighlightedText(result._highlightResult.name.value) :
            result.name}
        </div>
        {result.name_kr && (
          <div className="text-sm text-gray-500">
            {result._highlightResult?.name_kr ?
              renderHighlightedText(result._highlightResult.name_kr.value) :
              result.name_kr}
          </div>
        )}
      </div>
    </Link>
  );

  return (
    <>
      <header className="w-full border-b bg-white">
        <div className="w-[90%] md:w-[80%] mx-auto px-4 h-16 flex justify-center items-center">
          <div className="w-full h-full flex">
            {/* Left section with menu */}
            <div className="flex justify-start items-center w-1/3 text-black">
              <Menu onClick={() => setIsMenuOpen(!isMenuOpen)} className="cursor-pointer" />
            </div>

            {/* Center section with logo */}
            <div className="w-1/3 flex-1 flex justify-center items-center">
              <Link href="/" className="inline-block">

                {/* The sizing div now matches the header's height, making it as large as possible. */}
                <div className="relative w-20 h-16"> {/* <-- Final size adjustment */}
                  <Image
                    src="/ehco_logo-02.png"
                    alt="EHCO logo"
                    fill
                    className="object-contain"
                    sizes="80px" // <-- Adjusted sizes to match new width
                  />
                </div>

              </Link>
            </div>

            {/* Right section with search (only show if not on home page) */}
            <div className="w-1/3 flex justify-end items-center">
              {!isHomePage && !isAllFiguresPage && (
                <>
                  {/* Desktop search with dropdown */}
                  <div className="hidden sm:block sm:w-2/3 relative" ref={searchRef}>
                    <div className="relative flex items-center">
                      {searchQuery ? (
                        <X
                          className="absolute right-3 text-gray-400 cursor-pointer"
                          size={16}
                          onClick={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                            setShowResults(false);
                          }}
                        />
                      ) : (
                        <Search
                          className="absolute right-3 text-gray-400 cursor-pointer"
                          size={16}
                          onClick={handleSearchSubmit}
                        />
                      )}
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Search public figures"
                        className="pl-4 pr-8 py-1.5 border border-key-color rounded-full w-full text-sm text-black"
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
                            <div className="border-t border-gray-200 px-3 py-2 text-center">
                              <Link
                                href={`/search?q=${encodeURIComponent(searchQuery)}`}
                                className="text-key-color text-sm font-medium hover:underline"
                                onClick={() => setShowResults(false)}
                              >
                                See all results
                              </Link>
                            </div>
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
                  <div className="sm:hidden text-black">
                    <Search
                      className="cursor-pointer"
                      onClick={() => setIsSearchOpen(true)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {isLoading && <LoadingOverlay />}

      <Suspense fallback={
        <div className="fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 transform -translate-x-full">
          <div className='w-full h-16 px-8 flex justify-start items-center border-b border-b-black'>
            <p className='text-xl font-bold text-black'>Loading...</p>
          </div>
        </div>
      }>
        <SlidingMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      </Suspense>
      <SearchSlider isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}