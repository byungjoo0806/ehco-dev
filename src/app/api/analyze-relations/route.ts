// app/api/analyze-relations/route.ts
import { NextResponse } from 'next/server';
import type { NewsItem } from '@/lib/hooks/useNews';

interface ArticleWithMetrics extends NewsItem {
    daysDifference: number;
    similarityScore: number;
    relationship: string;
}

export async function POST(request: Request) {
    try {
        const { mainArticle, potentialRelated } = await request.json();

        // Filter articles based on date proximity and content similarity
        const relatedArticles = potentialRelated
            .map((article: NewsItem) => {
                // Calculate date difference
                const mainDate = new Date(mainArticle.formatted_date);
                const articleDate = new Date(article.formatted_date);
                const daysDifference = Math.abs(
                    (mainDate.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24)
                );

                // Calculate basic content similarity
                const mainWords = mainArticle.content.toLowerCase().split(' ');
                const articleWords = article.content.toLowerCase().split(' ');
                const commonWords = mainWords.filter((word: string) =>
                    articleWords.includes(word) && word.length > 3
                );
                const similarityScore = commonWords.length / Math.max(mainWords.length, articleWords.length);

                return {
                    ...article,
                    daysDifference,
                    similarityScore,
                    relationship: determineRelationship(daysDifference, similarityScore)
                };
            })
            // Filter out articles with low similarity
            .filter((article: ArticleWithMetrics) => article.similarityScore > 0.1)
            // Sort by similarity score
            .sort((a: ArticleWithMetrics, b: ArticleWithMetrics) => b.similarityScore - a.similarityScore)
            // Take top 5 most similar articles
            .slice(0, 5);

        return NextResponse.json({ relatedArticles });
    } catch (error) {
        console.error('Error analyzing articles:', error);
        return NextResponse.json(
            { error: 'Failed to analyze articles' },
            { status: 500 }
        );
    }
}

function determineRelationship(daysDifference: number, similarityScore: number): string {
    if (similarityScore > 0.5) {
        return 'Very Similar Story';
    } else if (similarityScore > 0.3) {
        if (daysDifference <= 2) {
            return 'Related Development';
        } else {
            return 'Similar Topic';
        }
    } else {
        if (daysDifference <= 1) {
            return 'Same-day Coverage';
        } else {
            return 'Related Topic';
        }
    }
}