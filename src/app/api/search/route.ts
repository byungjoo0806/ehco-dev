// src/app/api/search/route.js
import { NextResponse, NextRequest } from 'next/server';
import { algoliasearch } from 'algoliasearch';

const client = algoliasearch(
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
    process.env.ALGOLIA_ADMIN_API_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query');

        if (!query) {
            return NextResponse.json({ hits: [] });
        }

        const results = await client.searchSingleIndex({ indexName: "celebrities", searchParams: query});
        return NextResponse.json(results);
    } catch (error) {
        console.error('Algolia search error:', error);
        return NextResponse.json(
            { error: 'Failed to perform search' },
            { status: 500 }
        );
    }
}