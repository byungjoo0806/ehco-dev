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
  profilePic: string;
}

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const { celebrities, loading } = useAllCelebrities();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

      const matchesEnglishName = celebrity.name ?
        celebrity.name.toLowerCase().includes(searchTermLower) :
        false;

      const matchesKoreanName = celebrity.koreanName ?
        celebrity.koreanName.includes(searchTerm) :
        false;

      return matchesEnglishName || matchesKoreanName;
    }).map(({ id, name, koreanName, profilePic }) => ({
      id,
      name,
      koreanName,
      profilePic
    }));

    setSearchResults(filteredResults);
    setShowResults(true);
  };

  return (
    <>
      <header className="border-b">
        <div className="container mx-auto px-2 sm:px-4 h-16 flex items-center">
          {/* Left section with menu */}
          <div className="flex-none w-1/3">
            <Menu onClick={() => setIsOpen(!isOpen)} className="cursor-pointer" />
          </div>

          {/* Center section with logo */}
          <div className="w-1/3 flex-1 flex justify-center">
            <Link href="/" className="text-xl sm:text-2xl font-bold text-key-color">
              EHCO
            </Link>
          </div>

          {/* Right section with search */}
          <div className="w-1/3 flex-none sm:w-36 md:w-48" ref={searchRef}>
            <div className="relative flex flex-row items-center">
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
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search"
                className="pl-8 pr-8 py-1.5 border rounded-lg w-full text-sm"
              />

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-48 sm:w-64 max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result) => (
                    <Link
                      key={result.id}
                      href={`/${result.id}`}
                      className="flex flex-row items-center px-3 py-2 hover:bg-gray-100"
                      onClick={() => {
                        setShowResults(false);
                        setSearchQuery('');
                      }}
                    >
                      <img src={result.profilePic} alt={result.name} className='w-8 h-8 rounded-full' />
                      <div className='flex-1 pl-2'>
                        <div className="font-medium text-sm">{result.name}</div>
                        <div className="text-xs text-gray-500">{result.koreanName}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* No Results State */}
              {showResults && searchQuery && searchResults.length === 0 && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-48 sm:w-64 z-50">
                  <div className="px-3 py-3 text-sm text-gray-500 text-center">
                    No results found
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && searchQuery && (
                <div className="absolute top-full right-0 mt-1 bg-white border rounded-lg shadow-lg w-48 sm:w-64 z-50">
                  <div className="px-3 py-3 text-sm text-gray-500 text-center">
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