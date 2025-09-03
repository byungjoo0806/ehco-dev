// src/context/LoadingContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import LoadingOverlay from '@/components/LoadingOverlay';

interface LoadingContextType {
  isLoading: boolean;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  setLoadingMessage: (message: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Loading...');
  const pathname = usePathname();

  // Auto-hide loading when route changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100); // Small delay to ensure page has started loading

    return () => clearTimeout(timer);
  }, [pathname]);

  const showLoading = (loadingMessage?: string) => {
    if (loadingMessage) {
      setMessage(loadingMessage);
    }
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  const setLoadingMessage = (newMessage: string) => {
    setMessage(newMessage);
  };

  const value = {
    isLoading,
    showLoading,
    hideLoading,
    setLoadingMessage,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <LoadingOverlay isVisible={isLoading} message={message} />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
