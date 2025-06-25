// app/all-figures/page.tsx

// NO "use client" here. This is a Server Component.

import { Suspense } from 'react';
import { Metadata } from 'next';
import AllFiguresContent from './all-figures-content'; // We will create this component next
import { Loader2 } from 'lucide-react';

// This metadata export is now valid because 'use client' is gone.
export const metadata: Metadata = {
    title: 'Korean Celebrity Directory',
    description: 'Browse the complete EHCO directory of Korean celebrities. Find profiles, facts, and timelines for every K-Pop idol, actor, and artist we cover. Search or filter by category to explore.',
};

// A simple loading fallback for Suspense
const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600" size={24} />
            <span className="text-slate-600 font-medium">Loading...</span>
        </div>
    </div>
);


// The default export simply renders the client component wrapped in Suspense.
export default function AllFiguresPage() {
    return (
        <Suspense fallback={<LoadingOverlay />}>
            <AllFiguresContent />
        </Suspense>
    );
}
