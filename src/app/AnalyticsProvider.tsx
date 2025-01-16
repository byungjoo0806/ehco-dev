// app/AnalyticsProvider.tsx (Client Component)
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initializeAnalytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

export default function AnalyticsProvider() {
    const pathname = usePathname();

    useEffect(() => {
        const analytics = initializeAnalytics();

        if (analytics) {
            logEvent(analytics, 'page_view', {
                page_path: pathname
            });
        }
    }, [pathname]);

    return null;
}