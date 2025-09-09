// src/app/search/page.tsx
import { Suspense } from 'react';
import SearchPageContent from './search-page-content';
import { Loader2 } from 'lucide-react';
import { Metadata } from 'next';

export async function generateMetadata(
    { searchParams }: { searchParams: Promise<{ q?: string }> }
): Promise<Metadata> {
    const resolvedParams = await searchParams;
    const query = resolvedParams.q || '';

    if (query) {
        return {
            title: `Search results for "${query}" - EHCO`,
            description: `Discover comprehensive search results for "${query}" on EHCO - your ultimate destination for K-Pop profiles, artist information, news, and exclusive content. Find detailed biographies, latest updates, and trending stories about your favorite Korean artists and entertainers.`,
            robots: {
                index: false,
                follow: true,
            },
        };
    }

    return {
        title: 'Search Korean Artists & Entertainers - EHCO',
        description: 'Search and explore EHCO\'s extensive collection of K-Pop profiles, artist biographies, entertainment news, and exclusive content. Discover your favorite Korean artists, bands, actors, and celebrities with our comprehensive search platform.',
        robots: {
            index: false,
            follow: true,
        },
    };
}

export default function SearchPage() {
    return (
        <Suspense
            fallback={
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
                        <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
                        <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
                    </div>
                </div>
            }
        >
            <SearchPageContent />
        </Suspense>
    );
}