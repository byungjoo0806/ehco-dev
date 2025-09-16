// src/app/api/articles/batch/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getArticlesByIds } from '@/lib/article-service';

interface BatchArticleRequest {
    articleIds: string[];
    figureId?: string;
}

const RATE_LIMIT_MAP = new Map<string, { count: number; resetTime: number }>();
const MAX_REQUESTS_PER_MINUTE = 10;
const MAX_ARTICLES_PER_REQUEST = 50;

function checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limit = RATE_LIMIT_MAP.get(clientId);

    if (!limit || now > limit.resetTime) {
        RATE_LIMIT_MAP.set(clientId, { count: 1, resetTime: now + 60000 });
        return true;
    }

    if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
        return false;
    }

    limit.count++;
    return true;
}

// Add this temporarily to your /api/articles/batch/route.ts for debugging

export async function POST(request: NextRequest) {
    try {
        // Get client identifier for rate limiting
        const clientId = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';

        // Check rate limit
        if (!checkRateLimit(clientId)) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        const body: BatchArticleRequest = await request.json();
        const { articleIds, figureId } = body;

        // console.log(`🔍 DEBUG: Batch API called with:`, {
        //     articleIds: articleIds.slice(0, 5),
        //     figureId,
        //     totalIds: articleIds.length
        // });

        // Validate request
        if (!Array.isArray(articleIds)) {
            // console.log(`❌ DEBUG: articleIds is not an array:`, typeof articleIds);
            return NextResponse.json(
                { error: 'articleIds must be an array' },
                { status: 400 }
            );
        }

        if (articleIds.length === 0) {
            // console.log(`⚠️ DEBUG: Empty articleIds array`);
            return NextResponse.json([]);
        }

        if (articleIds.length > MAX_ARTICLES_PER_REQUEST) {
            // console.log(`❌ DEBUG: Too many articles requested: ${articleIds.length}`);
            return NextResponse.json(
                { error: `Cannot request more than ${MAX_ARTICLES_PER_REQUEST} articles at once` },
                { status: 400 }
            );
        }

        // Validate article IDs (basic sanitization)
        const validatedIds = articleIds.filter(id =>
            typeof id === 'string' &&
            id.length > 0 &&
            id.length < 100 &&
            /^[a-zA-Z0-9_-]+$/.test(id)
        );

        // console.log(`🔍 DEBUG: Validation results:`, {
        //     original: articleIds.length,
        //     validated: validatedIds.length,
        //     filtered: articleIds.length - validatedIds.length
        // });

        if (validatedIds.length !== articleIds.length) {
            console.warn(`⚠️ DEBUG: Some article IDs were filtered out for safety`);
            // console.log(`❌ DEBUG: Invalid IDs:`, articleIds.filter(id => !validatedIds.includes(id)));
        }

        // Load articles
        // console.log(`📞 DEBUG: Calling getArticlesByIds with:`, validatedIds);
        const articles = await getArticlesByIds(validatedIds);
        // console.log(`📥 DEBUG: getArticlesByIds returned:`, {
        //     count: articles.length,
        //     firstArticle: articles[0],
        //     articleIds: articles.map(a => a.id)
        // });

        // Check if any requested articles are missing
        const foundIds = new Set(articles.map(a => a.id));
        const missingIds = validatedIds.filter(id => !foundIds.has(id));
        if (missingIds.length > 0) {
            // console.log(`❌ DEBUG: Missing articles from Firestore:`, missingIds);
        }

        // Log for monitoring (useful for identifying problematic figures)
        if (figureId && articles.length > 20) {
            // console.log(`Loaded ${articles.length} articles for figure: ${figureId}`);
        }

        // console.log(`✅ DEBUG: Returning ${articles.length} articles`);
        return NextResponse.json(articles);

    } catch (error) {
        console.error('❌ DEBUG: Error in batch article loading:', error);
        return NextResponse.json(
            { error: 'Failed to load articles' },
            { status: 500 }
        );
    }
}