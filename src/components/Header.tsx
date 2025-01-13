'use client';

import { Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import SlidingMenu from './SlidingMenu';
import { useState, useEffect, useRef } from 'react';
import { useAllCelebrities } from '@/lib/hooks/useAllCelebrities';

interface SearchResult {
  id: string;
  name: string;
  koreanName: string;
}

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const { celebrities, loading } = useAllCelebrities();

  useEffect(() => {
    console.log('Loaded celebrities:', celebrities);
  }, [celebrities]);

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

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (query.trim() === '') {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const filteredResults = celebrities.filter(celebrity => {
      if (!celebrity) return false;

      const searchTerm = query;
      const searchTermLower = searchTerm.toLowerCase();

      // For English name, use case-insensitive comparison with null check
      const matchesEnglishName = celebrity.name ?
        celebrity.name.toLowerCase().includes(searchTermLower) :
        false;

      // For Korean name, use direct comparison with null check
      const matchesKoreanName = celebrity.koreanName ?
        celebrity.koreanName.includes(searchTerm) :
        false;

      return matchesEnglishName || matchesKoreanName;
    }).map(({ id, name, koreanName }) => ({
      id,
      name,
      koreanName
    }));

    setSearchResults(filteredResults);
    setShowResults(true);
  };

  return (
    <>
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-center">
          <div className="w-1/3 flex justify-start items-center pl-10">
            <Menu onClick={() => setIsOpen(!isOpen)} className="cursor-pointer" />
          </div>

          <div className="w-1/3 flex justify-center items-center">
            <Link href="/" className="text-2xl font-bold text-key-color">
              EHCO
            </Link>
          </div>

          <div className="w-1/3 flex justify-end" ref={searchRef}>
            <div className="w-[70%] relative flex flex-row items-center">
              <Search className="absolute left-3 text-gray-400" size={20} />
              {searchQuery && (
                <X
                  className="absolute right-3 text-gray-400 cursor-pointer"
                  size={20}
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
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search Echo"
                className="pl-10 pr-10 py-2 border rounded-lg w-full"
              />

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result) => (
                    <Link
                      key={result.id}
                      href={`/${result.id}`}
                      className="block px-4 py-2 hover:bg-gray-100"
                      onClick={() => {
                        setShowResults(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="font-medium">{result.name}</div>
                      <div className="text-sm text-gray-500">{result.koreanName}</div>
                    </Link>
                  ))}
                </div>
              )}

              {/* No Results State */}
              {showResults && searchQuery && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                  <div className="px-4 py-3 text-gray-500 text-center">
                    No results found
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50">
                  <div className="px-4 py-3 text-gray-500 text-center">
                    Loading...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <SlidingMenu isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}