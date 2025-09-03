// src/components/UserMenu.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext'; // Import the loading hook

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { showLoading, hideLoading } = useLoading(); // Use the loading context
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter(); // Add router for programmatic navigation

  // Check if current page is login or signup page
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  const isHomePage = pathname === '/';
  const isAllFiguresPage = pathname === '/all-figures';
  const showDivider = !isHomePage && !isAllFiguresPage;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle navigation with loading
  const handleNavigation = (path: string, loadingMessage: string) => {
    showLoading(loadingMessage);
    router.push(path);
  };

  const handleLogout = async () => {
    showLoading('Signing you out...'); // Show loading for logout
    try {
      await signOut();
      setIsOpen(false);
      router.push('/'); // Navigate to home after logout
    } catch (error) {
      console.error('Failed to logout:', error);
      // Loading will automatically hide due to the global context
    } finally {
      // This will run regardless of success or failure
      hideLoading();
    }
  };

  const handleProfileNavigation = () => {
    setIsOpen(false);
    handleNavigation('/profile', 'Loading your profile...');
  };

  // If user is not logged in and is on auth pages, don't show anything
  if (!user && isAuthPage) {
    return null;
  }

  if (!user) {
    return (
      <div className='flex items-center'>
        {/* --- DESKTOP VIEW: Shown on 'sm' screens and up --- */}
        <div className="hidden sm:flex items-center gap-2">
          {showDivider && <span className="text-gray-300">|</span>}
          <button
            onClick={() => {
              sessionStorage.setItem('redirectPath', pathname);
              handleNavigation('/login', 'Redirecting to login...');
            }}
            className="text-sm font-medium text-gray-700 hover:text-key-color transition-colors"
          >
            Login
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => {
              sessionStorage.setItem('redirectPath', pathname);
              handleNavigation('/signup', 'Redirecting to signup...');
            }}
            className="text-sm font-medium bg-key-color text-white px-3 py-1.5 rounded-full hover:bg-pink-700 transition-colors"
          >
            Sign Up
          </button>
        </div>

        {/* --- MOBILE VIEW: Hidden on 'sm' screens and up --- */}
        <button
          onClick={() => {
            sessionStorage.setItem('redirectPath', pathname);
            handleNavigation('/login', 'Redirecting to login...');
          }}
          className="sm:hidden text-black"
        >
          <User
            className="cursor-pointer hover:text-gray-600 transition-colors"
            size={20}
          />
        </button>
      </div>
    );
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'User';

  return (
    <div className='flex items-center'>
      {showDivider && <div className="h-6 w-px bg-gray-300 mr-2"></div>}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-key-color transition-colors"
        >
          <User size={16} />
          <span className="hidden sm:block">{displayName}</span>
          <ChevronDown size={14} className={`hidden sm:block transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="py-2">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>

              <button
                onClick={handleProfileNavigation}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <User size={16} />
                  Profile
                </div>
              </button>

              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LogOut size={16} />
                  Sign Out
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
