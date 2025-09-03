'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
// import { initializeAnalytics } from '@/lib/firebase';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

export default function AnalyticsProvider() {
    // const pathname = usePathname();

    // useEffect(() => {
    //     try {
    //         const analytics = initializeAnalytics();

    //         if (analytics) {
    //             logEvent(analytics, 'page_view', {
    //                 page_path: pathname
    //             });
    //         }
    //     } catch (error) {
    //         console.error('Error in AnalyticsProvider:', error);
    //     }
    // }, [pathname]);

    // Inside your component
    useEffect(() => {
        if (analytics && process.env.NODE_ENV === 'production') {
            logEvent(analytics, 'page_view', {
                page_title: document.title,
                page_location: window.location.href,
                page_path: window.location.pathname
            });
        }
    }, []);

    return null;
}