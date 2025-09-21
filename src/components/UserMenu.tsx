// src/components/UserMenu.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image'; // Import the Image component
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLoading } from '@/context/LoadingContext';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { showLoading, hideLoading } = useLoading();
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isHomePage = pathname === '/';
  const isAllFiguresPage = pathname === '/all-figures';
  const showDivider = !isHomePage && !isAllFiguresPage;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigation = (path: string, loadingMessage: string) => {
    showLoading(loadingMessage);
    router.push(path);
  };

  const handleLogout = async () => {
    showLoading('Signing you out...');
    try {
      await signOut();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to logout:', error);
    } finally {
      hideLoading();
    }
  };

  const handleProfileNavigation = () => {
    setIsOpen(false);
    handleNavigation('/profile', 'Loading your profile...');
  };

  if (!user && isAuthPage) {
    return null;
  }

  if (!user) {
    return (
      <div className='flex items-center'>
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
  const profilePic = user.photoURL || '/images/default-profile.png'; // Define profile picture source

  return (
    <div className='flex items-center'>
      {showDivider && <div className="h-6 w-px bg-gray-300 mr-2"></div>}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-key-color transition-colors"
        >
          {/* --- MODIFIED: Replaced icon with profile picture --- */}
          <div className="relative w-6 h-6">
            <Image
              src={profilePic}
              alt="Profile Picture"
              fill
              className="rounded-full object-cover"
              sizes="24px"
            />
          </div>
          <span className="hidden sm:block">{displayName}</span>
          <ChevronDown size={14} className={`hidden sm:block transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="py-1">
              {/* --- MODIFIED: Enhanced dropdown header with picture --- */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <div className="relative w-10 h-10">
                  <Image
                    src={profilePic}
                    alt="Profile Picture"
                    fill
                    className="rounded-full object-cover"
                    sizes="40px"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={handleProfileNavigation}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <User size={16} />
                  Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}