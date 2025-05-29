// src/app/[publicFigure]/page.tsx
import { Suspense } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Loader2 } from 'lucide-react';
import ProfileInfo from '@/components/ProfileInfo';
import CelebrityWiki from '@/components/CelebrityWiki';
import JsonLd from '@/components/JsonLd';
import type { JsonLdObject } from '@/components/JsonLd';

interface PublicFigurePageProps {
    params: Promise<{
        publicFigure: string;
    }>;
}

// Add this interface near your other interfaces
interface ArticleData {
    id: string;
    subTitle: string;
    body: string;
    source: string;
    link: string;
    imageUrls: string[];
    imageCaptions: string[];
    sendDate: string;
}

interface ArticleSummaryData {
    id: string;
    event_contents?: Record<string, string>;
    subCategory?: string;
    category?: string;
    content?: string;
    title?: string;
}

// Updated interfaces to match our new API structure
interface WikiContentItem {
    id: string;
    category: string;
    subcategory?: string;
    content: string;
    articleIds: string[];
}

// Update the WikiContentResponse interface to include articles
interface WikiContentResponse {
    mainOverview: {
        id: string;
        content: string;
        articleIds: string[];
    };
    categoryContent: WikiContentItem[];
    articles?: ArticleData[]; // Add this line
}

// Extended interface for public figure data based on the screenshots
interface PublicFigureBase {
    id: string;
    name: string;
    name_kr: string;
    nationality: string;
    occupation: string[];
    profilePic?: string;
    instagramUrl?: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
    lastUpdated?: string;
    gender: string;
    company?: string;
    debutDate?: string;
}

interface IndividualPerson extends PublicFigureBase {
    is_group: false;
    birthDate?: string;
    chineseZodiac?: string;
    group?: string;
    school?: string[];
    zodiacSign?: string;
}

interface GroupProfile extends PublicFigureBase {
    is_group: true;
    members?: IndividualPerson[];
}

type PublicFigure = IndividualPerson | GroupProfile;

// Unified loading overlay component
const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
            <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
        </div>
    </div>
);

// Separate viewport export
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
}

export async function generateMetadata({ params }: { params: Promise<{ publicFigure: string }> }): Promise<Metadata> {
    try {
        const resolvedParams = await params;
        const publicFigureData = await getPublicFigureData(resolvedParams.publicFigure);

        // Handle different title format based on if it's a group or individual
        const title = publicFigureData.is_group
            ? `${publicFigureData.name} (${publicFigureData.name_kr}) - K-pop Group Profile & Information`
            : `${publicFigureData.name} (${publicFigureData.name_kr}) Profile & Information`;

        // Customize description based on group or individual
        let description;
        if (publicFigureData.is_group) {
            description = `Learn about ${publicFigureData.name}, ${publicFigureData.nationality} ${publicFigureData.occupation.join(', ')}. Official profiles, discography, history, and more.`;
        } else {
            const personalDetails = [];
            if ((publicFigureData as IndividualPerson).group) personalDetails.push(`Member of ${(publicFigureData as IndividualPerson).group}`);
            if ((publicFigureData as IndividualPerson).birthDate) personalDetails.push(`Born on ${(publicFigureData as IndividualPerson).birthDate}`);

            description = `Learn about ${publicFigureData.name}, ${publicFigureData.nationality} ${publicFigureData.occupation.join(', ')}${personalDetails.length > 0 ? '. ' + personalDetails.join(', ') : '.'}`;
        }

        return {
            title,
            description,
            keywords: [
                `${publicFigureData.name}`,
                `${publicFigureData.name_kr}`,
                `${publicFigureData.name} info`,
                `${publicFigureData.name} biography`,
                ...publicFigureData.occupation.map(occ => `${publicFigureData.name} ${occ}`),
                `${publicFigureData.nationality} ${publicFigureData.occupation[0] || ''}`,
                ...(publicFigureData.is_group ? ['kpop group', 'korean idol group'] : ['kpop idol', 'korean celebrity'])
            ],
            alternates: {
                canonical: `https://ehco.ai/${resolvedParams.publicFigure}`,
            },
            openGraph: {
                title: `${title} - EHCO`,
                description,
                url: `https://ehco.ai/${resolvedParams.publicFigure}`,
                type: 'profile',
                images: publicFigureData.profilePic ? [{ url: publicFigureData.profilePic }] : [],
            },
            twitter: {
                card: 'summary',
                title: `${title} - EHCO`,
                description,
                images: publicFigureData.profilePic ? [publicFigureData.profilePic] : [],
            }
        }
    } catch (error) {
        // Return basic metadata if public figure data fetch fails
        return {
            title: 'Public Figure Profile - EHCO',
            description: 'Public figure information and details',
        }
    }
}

// Add this function near your other data-fetching functions
async function getArticlesData(articleIds: string[]): Promise<ArticleData[]> {
    if (articleIds.length === 0) return [];

    const headersList = await headers();
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = headersList.get('host') || 'localhost:3000';

    try {
        const response = await fetch(
            `${protocol}://${host}/api/articles?ids=${articleIds.join(',')}`,
            {
                cache: 'force-cache',
                next: {
                    revalidate: 3600 // 1 hour
                }
            }
        );

        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Error fetching articles:', error);
        return [];
    }
}

async function getArticleSummaries(publicFigureId: string, articleIds: string[]): Promise<ArticleSummaryData[]> {
    if (articleIds.length === 0) return [];

    const headersList = await headers();
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = headersList.get('host') || 'localhost:3000';

    try {
        const response = await fetch(
            `${protocol}://${host}/api/article-summaries?publicFigure=${publicFigureId}&articleIds=${articleIds.join(',')}`,
            {
                cache: 'force-cache',
                next: {
                    revalidate: 3600 // 1 hour
                }
            }
        );

        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Error fetching article summaries:', error);
        return [];
    }
}

async function getPublicFigureData(publicFigureId: string): Promise<PublicFigure> {
    const docRef = doc(db, 'selected-figures', publicFigureId.toLowerCase());
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        throw new Error('Public figure not found');
    }

    const data = docSnap.data();

    // Add the ID to the data
    const publicFigureData: Partial<PublicFigure> = {
        id: docSnap.id,
        name: data.name || '',
        name_kr: data.name_kr || '',
        gender: data.gender || '',
        nationality: data.nationality || '',
        occupation: data.occupation || [],
        is_group: Boolean(data.is_group),
        profilePic: data.profilePic || '',
        instagramUrl: data.instagramUrl || '',
        spotifyUrl: data.spotifyUrl || '',
        youtubeUrl: data.youtubeUrl || '',
        company: data.company || '',
        debutDate: data.debutDate || '',
        lastUpdated: data.lastUpdated || '',
    };

    // Add type-specific fields
    if (publicFigureData.is_group) {
        (publicFigureData as GroupProfile).members = data.members || [];
    } else {
        (publicFigureData as IndividualPerson).birthDate = data.birthDate || '';
        (publicFigureData as IndividualPerson).chineseZodiac = data.chineseZodiac || '';
        (publicFigureData as IndividualPerson).group = data.group || '';
        (publicFigureData as IndividualPerson).school = data.school || [];
        (publicFigureData as IndividualPerson).zodiacSign = data.zodiacSign || '';
    }

    // Validate required fields
    if (!publicFigureData.name ||
        !publicFigureData.gender ||
        !publicFigureData.nationality) {
        throw new Error('Invalid public figure data');
    }

    return publicFigureData as PublicFigure;
}

// Updated function to handle the new API response structure
async function getPublicFigureContent(publicFigureId: string): Promise<{
    wikiContent: WikiContentResponse;
}> {
    const headersList = await headers();
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = headersList.get('host') || 'localhost:3000';

    // Fetch public figure content
    try {
        const contentResponse = await fetch(
            `${protocol}://${host}/api/public-figure-content/${publicFigureId}`,
            {
                cache: 'force-cache',
                next: {
                    revalidate: 3600 // 1 hour
                },
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!contentResponse.ok) {
            // If the API doesn't exist yet, return empty content
            return {
                wikiContent: {
                    mainOverview: {
                        id: 'main-overview',
                        content: '',
                        articleIds: []
                    },
                    categoryContent: []
                }
            };
        }

        const wikiContent = await contentResponse.json();

        return { wikiContent };
    } catch (error) {
        console.error('Error fetching public figure content:', error);
        // Return empty content if API fails
        return {
            wikiContent: {
                mainOverview: {
                    id: 'main-overview',
                    content: '',
                    articleIds: []
                },
                categoryContent: []
            }
        };
    }
}

// Update the processContentData function
function processContentData(data: WikiContentResponse) {
    const { categoryContent } = data;

    const KNOWN_CATEGORIES = [
        'Creative Works',
        'Live & Broadcast',
        'Public Relations',
        'Personal Milestones',
        'Incidents & Controversies'
    ];

    // Extract available sections from content data
    const categories = new Set<string>();
    const subcategories = new Set<string>();

    // Add categories and subcategories from categoryContent
    categoryContent.forEach(item => {
        if (KNOWN_CATEGORIES.includes(item.category)) {
            // This is a main category
            categories.add(item.category);
            if (item.subcategory) {
                subcategories.add(item.subcategory);
            }
        } else {
            // Assume it's a subcategory of its own category field
            subcategories.add(item.category);
        }
    });

    // Debug log for categories and subcategories
    // console.log('Processed Content Data:', {
    //     categories: Array.from(categorySet),
    //     subcategories: Array.from(subcategorySet),
    //     categoryContent: categoryContent.map(item => ({
    //         id: item.id,
    //         category: item.category,
    //         subcategory: item.subcategory,
    //         hasContent: item.content.length > 0
    //     }))
    // });

    return {
        sections: [...categories, ...subcategories],
        categories: Array.from(categories),
        subcategories: Array.from(subcategories)
    };
}

// Main content component
async function PublicFigurePageContent({ publicFigureId }: { publicFigureId: string }) {
    // Fetch public figure data
    const publicFigureData = await getPublicFigureData(publicFigureId);

    // Try to fetch content if the API exists
    const { wikiContent } = await getPublicFigureContent(publicFigureId);

    // Get all unique article IDs from the content
    const allArticleIds = [
        ...(wikiContent.mainOverview.articleIds || []),
        ...(wikiContent.categoryContent.flatMap(item => item.articleIds || []))
    ].filter((id, index, self) => self.indexOf(id) === index); // Unique IDs

    // Fetch article data
    const [articles, articleSummaries] = await Promise.all([
        getArticlesData(allArticleIds),
        getArticleSummaries(publicFigureId, allArticleIds)
    ]);

    // Process content to extract sections
    const { sections, categories, subcategories } = processContentData(wikiContent);

    // Add articles to wikiContent
    const wikiContentWithArticles = {
        ...wikiContent,
        articles
    };

    // Debug log to help with troubleshooting
    // console.log('DEBUG - PublicFigurePage content:', {
    //     publicFigureId,
    //     sectionsCount: sections.length,
    //     categories,
    //     subcategories,
    //     categoryContentCount: wikiContent.categoryContent?.length,
    //     mainOverview: {
    //         present: Boolean(wikiContent.mainOverview?.content),
    //         id: wikiContent.mainOverview?.id,
    //         articleCount: wikiContent.mainOverview?.articleIds?.length || 0
    //     },
    //     categoryContentSample: wikiContent.categoryContent?.slice(0, 3).map(item => ({
    //         id: item.id,
    //         category: item.category,
    //         subcategory: item.subcategory || 'none',
    //         articleCount: item.articleIds?.length || 0
    //     })),
    //     articleStats: {
    //         totalUnique: allArticleIds.length,
    //         fetched: articles.length
    //     }
    // });

    // Schema data for SEO
    const schemaData = publicFigureData.is_group
        ? {
            "@context": "https://schema.org",
            "@type": "MusicGroup",
            "name": publicFigureData.name,
            "alternateName": publicFigureData.name_kr || null,
            "nationality": publicFigureData.nationality,
            "url": `https://ehco.ai/${publicFigureId}`,
            "sameAs": [
                publicFigureData.instagramUrl,
                publicFigureData.spotifyUrl,
                publicFigureData.youtubeUrl
            ].filter(Boolean) as string[],
            ...(publicFigureData.company ? { "member": { "@type": "Organization", "name": publicFigureData.company } } : {}),
            ...(publicFigureData.debutDate ? { "foundingDate": publicFigureData.debutDate.split(':')[0].trim() } : {}),
            // Add members if available
            ...(publicFigureData.is_group && (publicFigureData as GroupProfile).members &&
                (publicFigureData as GroupProfile).members!.length > 0 ? {
                "member": (publicFigureData as GroupProfile).members!.map(member => ({
                    "@type": "Person",
                    "birthDate": member.birthDate ? member.birthDate.split(':')[0].trim() : null,
                    // Add other member properties as needed
                }))
            } : {})
        } as JsonLdObject
        : {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": publicFigureData.name,
            "alternateName": publicFigureData.name_kr || null,
            "gender": publicFigureData.gender,
            "nationality": publicFigureData.nationality,
            "url": `https://ehco.ai/${publicFigureId}`,
            "sameAs": [
                publicFigureData.instagramUrl,
                publicFigureData.spotifyUrl,
                publicFigureData.youtubeUrl
            ].filter(Boolean) as string[],
            // Safe way to check for birthDate property
            ...(!publicFigureData.is_group && (publicFigureData as IndividualPerson).birthDate ? {
                "birthDate": (publicFigureData as IndividualPerson).birthDate!.split(':')[0].trim()
            } : {}),
            // Safe way to check for group property
            ...(!publicFigureData.is_group && (publicFigureData as IndividualPerson).group ? {
                "memberOf": { "@type": "MusicGroup", "name": (publicFigureData as IndividualPerson).group! }
            } : {}),
            ...(publicFigureData.company ? {
                "affiliation": { "@type": "Organization", "name": publicFigureData.company }
            } : {})
        } as JsonLdObject;

        // console.log(articleSummaries);
    return (
        <div className="w-full">
            <ProfileInfo
                publicFigureData={publicFigureData}
                mainOverview={wikiContentWithArticles.mainOverview}
            />
            <CelebrityWiki
                availableSections={sections}
                categories={categories} // Add this
                subcategories={subcategories} // Add this
                categoryContent={wikiContentWithArticles.categoryContent}
                mainOverview={wikiContentWithArticles.mainOverview}
                articles={wikiContentWithArticles.articles}
                articleSummaries={articleSummaries}
            />
            <JsonLd data={schemaData} />
        </div>
    );
}

// Main page component
export default async function PublicFigurePage({ params }: PublicFigurePageProps) {
    const publicFigureId = (await params).publicFigure.toLowerCase();

    return (
        <Suspense fallback={<LoadingOverlay />}>
            <PublicFigurePageContent publicFigureId={publicFigureId} />
        </Suspense>
    );
}