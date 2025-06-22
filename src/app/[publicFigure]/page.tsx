// src/app/[publicFigure]/page.tsx
import { Suspense } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Loader2 } from 'lucide-react';
import ProfileInfo from '@/components/ProfileInfo';
import CareerJourney from '@/components/CareerJourney';
import MainOverview from '@/components/MainOverview';
import type { JsonLdObject } from '@/components/JsonLd';
import JsonLd from '@/components/JsonLd';
import { getArticlesByIds } from '@/lib/article-service';
import { notFound } from 'next/navigation';

// --- IMPORTED TYPES ---
// All shared types are now imported from the central definitions file.
import {
    ApiContentResponse,
    ArticleSummary,
    WikiContentItem
} from '@/types/definitions';
import YouMightAlsoLike from '@/components/YouMightAlsoLike';

// --- PAGE-SPECIFIC TYPES ---
// These types are only used for fetching data on this page, so they can remain here.
interface PublicFigureBase {
    id: string;
    name: string;
    name_kr: string;
    nationality: string;
    occupation: string[];
    profilePic?: string;
    companyUrl?: string;
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


// --- UI COMPONENTS ---

const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600 dark:text-white" size={24} />
            <span className="text-slate-600 dark:text-white font-medium">Loading...</span>
        </div>
    </div>
);


// --- NEXT.JS CONFIG ---

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
}

export async function generateMetadata({ params }: { params: Promise<{ publicFigure: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    try {
        const publicFigureData = await getPublicFigureData(resolvedParams.publicFigure);

        const title = publicFigureData.is_group
            ? `${publicFigureData.name} (${publicFigureData.name_kr}) - K-pop Group Profile & Information`
            : `${publicFigureData.name} (${publicFigureData.name_kr}) Profile & Information`;

        let description;
        const figureName = publicFigureData.name;

        if (publicFigureData.is_group) {
            // Better description for groups: More active, highlights unique features.
            description = `The complete profile for ${figureName}. Explore their members, debut history, discography, and a real-time timeline of verified news and events on EHCO.`;
        } else {
            // Better description for individuals: Engages with a question, highlights biography and facts.
            description = `Who is ${figureName}? Discover their full biography, official profile, timeline of major life events, and all the latest fact-checked news.`;
        }

        return {
            title,
            description,
            keywords: [
                `${publicFigureData.name}`, `${publicFigureData.name_kr}`, `${publicFigureData.name} info`,
                `${publicFigureData.name} biography`, ...publicFigureData.occupation.map(occ => `${publicFigureData.name} ${occ}`),
                `${publicFigureData.nationality} ${publicFigureData.occupation[0] || ''}`,
                ...(publicFigureData.is_group ? ['kpop group', 'korean idol group'] : ['kpop idol', 'korean celebrity'])
            ],
            alternates: { canonical: `https://ehco.ai/${resolvedParams.publicFigure}` },
            openGraph: {
                title: `${title} - EHCO`, description, url: `https://ehco.ai/${resolvedParams.publicFigure}`,
                type: 'profile', images: publicFigureData.profilePic ? [{ url: publicFigureData.profilePic }] : [],
            },
            twitter: {
                card: 'summary', title: `${title} - EHCO`, description,
                images: publicFigureData.profilePic ? [publicFigureData.profilePic] : [],
            }
        }
    } catch (error) {
        // If the figure is not found, return generic "Not Found" metadata
        return {
            title: 'Profile Not Found - EHCO',
            description: 'The profile you are looking for could not be found.',
        }
    }
}


// --- DATA FETCHING FUNCTIONS ---

async function getArticleSummaries(publicFigureId: string, articleIds: string[]): Promise<ArticleSummary[]> {
    if (articleIds.length === 0) return [];

    const headersList = await headers();
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = headersList.get('host') || 'localhost:3000';

    try {
        const response = await fetch(
            `${protocol}://${host}/api/article-summaries?publicFigure=${publicFigureId}&articleIds=${articleIds.join(',')}`,
            { cache: 'force-cache', next: { revalidate: 3600 } }
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
    const publicFigureData: Partial<PublicFigure> = {
        id: docSnap.id,
        name: data.name || '',
        name_kr: data.name_kr || '',
        gender: data.gender || '',
        nationality: data.nationality || '',
        occupation: data.occupation || [],
        is_group: Boolean(data.is_group),
        profilePic: data.profilePic || '',
        companyUrl: data.companyUrl || '',
        instagramUrl: data.instagramUrl || '',
        spotifyUrl: data.spotifyUrl || '',
        youtubeUrl: data.youtubeUrl || '',
        company: data.company || '',
        debutDate: data.debutDate || '',
        lastUpdated: data.lastUpdated || '',
    };

    if (publicFigureData.is_group) {
        (publicFigureData as GroupProfile).members = data.members || [];
    } else {
        (publicFigureData as IndividualPerson).birthDate = data.birthDate || '';
        (publicFigureData as IndividualPerson).chineseZodiac = data.chineseZodiac || '';
        (publicFigureData as IndividualPerson).group = data.group || '';
        (publicFigureData as IndividualPerson).school = data.school || [];
        (publicFigureData as IndividualPerson).zodiacSign = data.zodiacSign || '';
    }

    if (!publicFigureData.name || !publicFigureData.gender || !publicFigureData.nationality) {
        throw new Error('Invalid public figure data');
    }

    return publicFigureData as PublicFigure;
}

async function getPublicFigureContent(publicFigureId: string): Promise<ApiContentResponse> {
    const headersList = await headers();
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = headersList.get('host') || 'localhost:3000';

    try {
        const contentResponse = await fetch(
            `${protocol}://${host}/api/public-figure-content/${publicFigureId}`,
            // { cache: 'force-cache', next: { revalidate: 3600 } }
            { cache: 'no-store' }
        );
        if (!contentResponse.ok) throw new Error('Failed to fetch content');
        return await contentResponse.json();
    } catch (error) {
        console.error('Error fetching public figure content:', error);
        return {
            main_overview: { id: 'main-overview', content: '', articleIds: [] },
            timeline_content: {
                schema_version: 'v1_legacy',
                data: { categoryContent: [] }
            }
        };
    }
}

// NOTE: The 'processContentData' function and its 'WikiContentResponse' interface
// were removed as they did not appear to be used in the component's rendering logic.

// --- MAIN CONTENT COMPONENT ---

async function PublicFigurePageContent({ publicFigureId }: { publicFigureId: string }) {
    try {
        const publicFigureData = await getPublicFigureData(publicFigureId);
        const apiResponse = await getPublicFigureContent(publicFigureId);

        const allArticleIds: string[] = [...(apiResponse.main_overview.articleIds || [])];
        if (apiResponse.timeline_content.schema_version === 'v1_legacy') {
            const legacyArticleIds = apiResponse.timeline_content.data.categoryContent.flatMap((item: WikiContentItem) => item.articleIds || []);
            allArticleIds.push(...legacyArticleIds);
        } else { // v2_curated
            // ================================================================== //
            // --- MODIFIED BLOCK ---                                             //
            // ================================================================== //
            const sourcesSet = new Set<string>();

            // The outer loop now iterates over the main category object
            Object.values(apiResponse.timeline_content.data).forEach((mainCatData) => {
                // We now specifically access the .subCategories property
                if (mainCatData && mainCatData.subCategories) {
                    Object.values(mainCatData.subCategories).forEach((eventList) => {
                        eventList.forEach((event) => {
                            (event.sources || []).forEach((source) => {
                                if (source.id) {
                                    sourcesSet.add(source.id);
                                }
                            });
                        });
                    });
                }
            });
            allArticleIds.push(...Array.from(sourcesSet));
            // ================================================================== //
            // --- END MODIFIED BLOCK ---                                         //
            // ================================================================== //
        }
        const uniqueArticleIds = allArticleIds.filter((id, index, self) => self.indexOf(id) === index);

        const [articles, articleSummaries] = await Promise.all([
            getArticlesByIds(uniqueArticleIds),
            getArticleSummaries(publicFigureId, uniqueArticleIds)
        ]);

        // ... rest of the function (schemaData, JSX return) remains unchanged ...
        const schemaData = publicFigureData.is_group
            ? {
                "@context": "https://schema.org",
                "@type": "MusicGroup",
                name: publicFigureData.name,
                alternateName: publicFigureData.name_kr || null,
                nationality: publicFigureData.nationality,
                url: `https://ehco.ai/${publicFigureId}`,
                sameAs: [publicFigureData.instagramUrl, publicFigureData.spotifyUrl, publicFigureData.youtubeUrl].filter(Boolean) as string[],
                ...(publicFigureData.company ? { "memberOf": { "@type": "Organization", "name": publicFigureData.company } } : {}),
                ...(publicFigureData.debutDate ? { "foundingDate": publicFigureData.debutDate.split(':')[0].trim() } : {}),
                ...((publicFigureData as GroupProfile).members && (publicFigureData as GroupProfile).members!.length > 0 && {
                    "member": (publicFigureData as GroupProfile).members!.map(member => ({
                        "@type": "Person",
                        "birthDate": member.birthDate ? member.birthDate.split(':')[0].trim() : null,
                    }))
                }),
                // ...(timelineEvents.length > 0 && { "event": timelineEvents }),
            } as JsonLdObject
            : {
                "@context": "https://schema.org",
                "@type": "Person",
                name: publicFigureData.name,
                alternateName: publicFigureData.name_kr || null,
                gender: publicFigureData.gender,
                nationality: publicFigureData.nationality,
                "jobTitle": publicFigureData.occupation.join(', '),
                url: `https://ehco.ai/${publicFigureId}`,
                sameAs: [publicFigureData.instagramUrl, publicFigureData.spotifyUrl, publicFigureData.youtubeUrl].filter(Boolean) as string[],
                ...(!publicFigureData.is_group && (publicFigureData as IndividualPerson).birthDate ? { "birthDate": (publicFigureData as IndividualPerson).birthDate!.split(':')[0].trim() } : {}),
                ...(!publicFigureData.is_group && (publicFigureData as IndividualPerson).group ? { "memberOf": { "@type": "MusicGroup", "name": (publicFigureData as IndividualPerson).group! } } : {}),
                ...(publicFigureData.company ? { "affiliation": { "@type": "Organization", "name": publicFigureData.company } } : {})
            } as JsonLdObject;

        return (
            <div className="w-full max-w-6xl mx-auto p-4 lg:p-6">
                <JsonLd data={schemaData} />

                <div className="grid grid-cols-1 lg:grid-cols-4 lg:gap-x-8">

                    {/* --- LEFT (MAIN) COLUMN --- */}
                    <div className="lg:col-span-3">
                        <ProfileInfo
                            publicFigureData={publicFigureData}
                        />
                        <MainOverview
                            mainOverview={apiResponse.main_overview}
                        />
                        <div className="mt-8 border-t border-gray-200 pt-8">
                            <h2 className="text-xl font-bold mb-4">Career Journey</h2>
                            <CareerJourney
                                apiResponse={apiResponse.timeline_content}
                                articles={articles}
                                articleSummaries={articleSummaries}
                            />
                        </div>
                    </div>

                    {/* --- RIGHT (SIDEBAR) COLUMN --- */}
                    <div className="hidden lg:block lg:sticky lg:top-20 mt-8 lg:mt-0 space-y-6 self-start">
                        <YouMightAlsoLike />
                        <div className="h-96 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                            Vertical Ad Placeholder
                        </div>
                    </div>

                </div>
            </div>
        );
    } catch (error) {
        // Check if the error is the one we expect from getPublicFigureData
        if (error instanceof Error && error.message === 'Public figure not found') {
            // This is the key change: trigger the 404 page
            notFound();
        }
        // For any other unexpected errors, you might want to re-throw or handle differently
        throw error;
    }
}

// --- MAIN PAGE COMPONENT ---

export default async function PublicFigurePage({ params }: { params: Promise<{ publicFigure: string }> }) {
    const publicFigureId = (await params).publicFigure.toLowerCase();
    return (
        <Suspense fallback={<LoadingOverlay />}>
            <PublicFigurePageContent publicFigureId={publicFigureId} />
        </Suspense>
    );
}