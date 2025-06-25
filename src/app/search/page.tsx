// app/search/page.tsx
import { Suspense } from 'react';
import SearchResults from './search-results';
import { Loader2 } from 'lucide-react';
import { Metadata } from 'next';

export async function generateMetadata(
    { searchParams }: { searchParams: Promise<{ q?: string }> }
): Promise<Metadata> {
    // Extract the search query from the URL.
    const resolvedParams = await searchParams;
    const query = resolvedParams.q || '';

    // If a query exists, create a dynamic title and description.
    if (query) {
        return {
            title: `Search results for "${query}"`,
            description: `Find the latest profiles and articles about "${query}" on EHCO.`,
            // IMPORTANT: It's crucial to keep this rule. You do not want Google to index
            // thousands of different search result pages, as it can harm your site's SEO.
            robots: {
                index: false,
                follow: true, // Allow Google to follow links from this page.
            },
        };
    }

    // If there is no query, return the default metadata for the base /search page.
    return {
        title: 'Search',
        // The base search page should also not be indexed.
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
            <SearchResults />
        </Suspense>
    );
}