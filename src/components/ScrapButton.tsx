// src/components/ScrapButton.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkCheck, LogIn, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { addToScrappedEvents, removeFromScrappedEvents, isScrapped } from '@/lib/scrapping-service';
import { createPortal } from 'react-dom';

interface EventGroupData {
  event_title?: string;
  event_summary?: string;
}

interface ScrapButtonProps {
  figureId: string;
  figureName: string;
  figureNameKr: string;
  mainCategory: string;
  subcategory: string;
  eventGroupIndex: number;
  eventGroup: EventGroupData;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Login Prompt Modal Component
const LoginPromptModal: React.FC<{ onClose: () => void; onLogin: () => void; onSignup: () => void }> = ({
  onClose,
  onLogin,
  onSignup
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-lg p-6 max-w-sm w-full relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close modal"
      >
        <X size={24} />
      </button>
      <div className="text-center">
        <Bookmark className="mx-auto mb-4 text-blue-500" size={48} />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Scrap Event</h3>
        <p className="text-gray-600 mb-6">Sign in or create an account to save interesting event groups for later viewing.</p>

        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            Sign In
          </button>

          <button
            onClick={onSignup}
            className="w-full bg-gray-100 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Create Account
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default function ScrapButton({
  figureId,
  figureName,
  figureNameKr,
  mainCategory,
  subcategory,
  eventGroupIndex,
  eventGroup,
  size = 'md',
  className = ''
}: ScrapButtonProps) {
  const { user } = useAuth();
  const [isScrappedState, setIsScrappedState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (showLoginPrompt) {
      // Save current scroll position
      const currentScroll = window.scrollY;
      setScrollPosition(currentScroll);

      // Prevent body scroll while maintaining position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${currentScroll}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
    } else {
      // Restore body styles first
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';

      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
      });
    }

    return () => {
      // Cleanup
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
    };
  }, [showLoginPrompt]);

  // Also add this cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (scrollPosition > 0) {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollPosition);
        });
      }
    };
  }, []);

  // Size variants
  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  // Check if this event group is scrapped when component mounts or user changes
  useEffect(() => {
    const checkScrappedStatus = async () => {
      if (user) {
        try {
          const scrapped = await isScrapped(user.uid, figureId, mainCategory, subcategory, eventGroupIndex);
          setIsScrappedState(scrapped);
        } catch (error) {
          console.error('Error checking scrapped status:', error);
        }
      } else {
        setIsScrappedState(false);
      }
    };

    checkScrappedStatus();
  }, [user, figureId, mainCategory, subcategory, eventGroupIndex]);

  const handleScrapClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    setIsLoading(true);
    try {
      if (isScrappedState) {
        // Remove from scrapped events
        const scrappedEventId = `${figureId}_${mainCategory}_${subcategory}_${eventGroupIndex}`.replace(/\s+/g, '_').toLowerCase();
        await removeFromScrappedEvents(user.uid, scrappedEventId);
        setIsScrappedState(false);
      } else {
        // Add to scrapped events
        await addToScrappedEvents(user.uid, {
          figureId,
          figureName,
          figureNameKr,
          mainCategory,
          subcategory,
          eventGroupIndex,
          eventGroup
        });
        setIsScrappedState(true);
      }
    } catch (error) {
      console.error('Error updating scrapped events:', error);
      // You might want to show a toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    sessionStorage.setItem('redirectPath', window.location.pathname);
    setShowLoginPrompt(false);
    window.location.href = '/login';
  };

  const handleSignupRedirect = () => {
    sessionStorage.setItem('redirectPath', window.location.pathname);
    setShowLoginPrompt(false);
    window.location.href = '/signup';
  };

  return (
    <>
      <button
        onClick={handleScrapClick}
        disabled={isLoading}
        className={`
          ${sizeClasses[size]}
          rounded-full hover:bg-gray-100 transition-colors 
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title={isScrappedState ? 'Remove from scrapped events' : 'Scrap this event group'}
      >
        {isScrappedState ? (
          <BookmarkCheck
            size={iconSizes[size]}
            className="text-blue-500 fill-blue-500"
          />
        ) : (
          <Bookmark
            size={iconSizes[size]}
            className="text-gray-400 hover:text-blue-500 transition-colors"
          />
        )}
      </button>

      {/* Login Prompt Modal */}
      {showLoginPrompt && createPortal(
        <LoginPromptModal
          onClose={() => setShowLoginPrompt(false)}
          onLogin={handleLoginRedirect}
          onSignup={handleSignupRedirect}
        />,
        document.body
      )}
    </>
  );
}