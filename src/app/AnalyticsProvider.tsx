'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initializeAnalytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

export default function AnalyticsProvider() {
    const pathname = usePathname();

    useEffect(() => {
        try {
            const analytics = initializeAnalytics();

            if (analytics) {
                logEvent(analytics, 'page_view', {
                    page_path: pathname
                });
            }
        } catch (error) {
            console.error('Error in AnalyticsProvider:', error);
        }
    }, [pathname]);

    return null;
}