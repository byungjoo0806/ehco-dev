// src/hooks/useRouteLoading.ts
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface UseRouteLoadingOptions {
  delay?: number; // Delay before showing loading (to avoid flashing for fast navigations)
  timeout?: number; // Maximum time to show loading
  excludePaths?: string[]; // Paths to exclude from loading
}

export function useRouteLoading(options: UseRouteLoadingOptions = {}) {
  const { delay = 100, timeout = 2000, excludePaths = [] } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [previousPath, setPreviousPath] = useState<string>('');
  const pathname = usePathname();

  useEffect(() => {
    // Skip loading for excluded paths
    if (excludePaths.some(path => pathname.includes(path))) {
      return;
    }

    // Only show loading if the path actually changed
    if (previousPath && previousPath !== pathname) {
      // Set loading with delay to avoid flashing
      const delayTimer: NodeJS.Timeout = setTimeout(() => {
        setIsLoading(true);
      }, delay);

      // Set timeout to ensure loading doesn't persist too long
      const timeoutTimer: NodeJS.Timeout = setTimeout(() => {
        setIsLoading(false);
      }, timeout);

      // Clean up loading when navigation completes
      const hideLoading = () => {
        clearTimeout(delayTimer);
        clearTimeout(timeoutTimer);
        setIsLoading(false);
      };

      // Hide loading after a short delay to allow for smooth transition
      const hideTimer = setTimeout(hideLoading, 300);

      return () => {
        clearTimeout(delayTimer);
        clearTimeout(timeoutTimer);
        clearTimeout(hideTimer);
        hideLoading();
      };
    }

    setPreviousPath(pathname);
  }, [pathname, previousPath, delay, timeout, excludePaths]);

  return { isLoading, setIsLoading };
}

// Alternative hook for manual control
export function useManualRouteLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const navigateWithLoading = async (
    path: string,
    options?: {
      scroll?: boolean;
      loadingMessage?: string;
      loadingDelay?: number;
    }
  ) => {
    const { scroll = false, loadingDelay = 400 } = options || {};

    setIsLoading(true);

    try {
      router.push(path, { scroll });

      // Hide loading after navigation
      setTimeout(() => {
        setIsLoading(false);
      }, loadingDelay);
    } catch (error) {
      console.error('Navigation error:', error);
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    setIsLoading,
    navigateWithLoading,
  };
}
