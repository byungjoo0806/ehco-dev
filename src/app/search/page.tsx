// app/search/page.tsx
import { Suspense } from 'react';
import SearchResults from './search-results';

export default function SearchPage() {
    return (
        <Suspense
            fallback={
                <div className="container mx-auto px-4 py-8">
                    <div className="flex justify-center items-center h-64">
                        <div className="text-lg">Loading results...</div>
                    </div>
                </div>
            }
        >
            <SearchResults />
        </Suspense>
    );
}