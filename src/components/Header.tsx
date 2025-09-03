'use client';

import { Loader2, Menu, Search, User } from 'lucide-react';
import Link from 'next/link';
import { useState, Suspense } from 'react';
import SlidingMenu from './SlidingMenu';
import SearchSlider from './SearchSlider';
import UserMenu from './UserMenu';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

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
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Check if current page is home page
  const isHomePage = pathname === '/';
  const isAllFiguresPage = pathname === '/all-figures';

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);
    router.push('/');

    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

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
                <div className="relative w-20 h-16">
                  <Image
                    src="/ehco_logo-02.png"
                    alt="EHCO logo"
                    fill
                    className="object-contain"
                    sizes="80px"
                  />
                </div>
              </Link>
            </div>

            {/* Right section with search and user menu */}
            <div className="w-1/3 flex justify-end items-center">
              <div className="flex items-center">
                {/* Search icon - show on all pages except home and all-figures */}
                {!isHomePage && !isAllFiguresPage && (
                  <>
                    <div className="text-black mr-2">
                      <Search
                        className="cursor-pointer hover:text-gray-600 transition-colors"
                        size={20}
                        onClick={() => setIsSearchOpen(true)}
                      />
                    </div>
                  </>
                )}
                {/* UserMenu is self-contained and handles its own responsiveness */}
                <UserMenu />
              </div>
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

      {/* Search slider for all screen sizes */}
      <SearchSlider isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}