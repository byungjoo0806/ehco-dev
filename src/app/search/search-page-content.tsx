// src/app/search/search-page-content.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import SearchResults from './search-results';
import SearchInterface from './search-interface';

export default function SearchPageContent() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q');

    // If there's a query, show the full search results (your existing component)
    // If no query, show the search interface (new component)
    return query ? <SearchResults /> : <SearchInterface />;
}