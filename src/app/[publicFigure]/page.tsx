// src/app/[publicFigure]/page.tsx
import { Suspense } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
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
import YouMightAlsoLike from '@/components/YouMightAlsoLike';

// --- IMPORTED TYPES ---
// All shared types are now imported from the central definitions file.
import {
    ApiContentResponse,
    ArticleSummary,
    WikiContentItem
} from '@/types/definitions';

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
    related_figures?: Record<string, number>
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
        <div className="bg-white p-6 rounded-lg flex items-center space-x-3">
            <Loader2 className="animate-spin text-slate-600" size={24} />
            <span className="text-slate-600 font-medium">Loading...</span>
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

        const primaryOccupation = publicFigureData.occupation[0] || '';
        const baseTitle = `${publicFigureData.name} (${publicFigureData.name_kr})`;
        const title = publicFigureData.is_group
            ? `${baseTitle} - K-Pop Group Profile & Timeline`
            : `${baseTitle} - ${primaryOccupation} Profile & Timeline`;

        const figureName = publicFigureData.name;
        const description = publicFigureData.is_group
            ? `Explore the complete profile for ${figureName}. Discover members, debut history, discography, and a real-time timeline of verified news on EHCO.`
            : `Who is ${figureName}? Get their official profile, full biography, career timeline, and the latest fact-checked news and updates on EHCO.`;

        return {
            title,
            description,
            keywords: [
                publicFigureData.name,
                publicFigureData.name_kr,
                `${publicFigureData.name} profile`,
                `${publicFigureData.name} timeline`,
                `${publicFigureData.name} facts`,
                `${publicFigureData.name} news`,
                ...publicFigureData.occupation.map(occ => `${publicFigureData.name} ${occ}`),
                `${publicFigureData.nationality} ${primaryOccupation}`,
                ...(publicFigureData.is_group
                    ? ['kpop group', 'korean idol group', 'kpop group profiles']
                    : ['kpop idol', 'korean celebrity', 'korean actor', 'korean singer'])
            ],
            alternates: { canonical: `https://ehco.ai/${resolvedParams.publicFigure}` },
            openGraph: {
                title: title, // Use the new dynamic title
                description,
                url: `https://ehco.ai/${resolvedParams.publicFigure}`,
                siteName: 'EHCO', // Explicitly state the site name
                type: 'profile',
                images: publicFigureData.profilePic ? [{
                    url: publicFigureData.profilePic,
                    width: 800, // Example width, adjust if you know the size
                    height: 800, // Example height
                    alt: `${publicFigureData.name}'s profile picture`,
                }] : [],
            },
            twitter: {
                card: 'summary_large_image', // More engaging than 'summary'
                title: title,
                description,
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
        related_figures: data.related_figures || {},
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
            { cache: 'force-cache', next: { revalidate: 3600 } }
            // { cache: 'no-store' }
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

async function getFiguresByIds(ids: string[]): Promise<Array<{ id: string; name: string; name_kr: string; profilePic?: string; }>> {
    if (!ids || ids.length === 0) {
        return [];
    }

    // NOTE: Firestore 'in' queries are limited to a maximum of 30 documents.
    // This is perfect for a "You Might Also Like" section.
    const collectionRef = collection(db, 'selected-figures');
    const q = query(collectionRef, where('__name__', 'in', ids));

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return [];
        }

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || '',
                name_kr: data.name_kr || '',
                profilePic: data.profilePic || '',
            };
        });
    } catch (error) {
        console.error("Error fetching figures by IDs:", error);
        return [];
    }
}

// NOTE: The 'processContentData' function and its 'WikiContentResponse' interface
// were removed as they did not appear to be used in the component's rendering logic.

// --- MAIN CONTENT COMPONENT ---

async function PublicFigurePageContent({ publicFigureId }: { publicFigureId: string }) {
    try {
        const publicFigureData = await getPublicFigureData(publicFigureId);
        const apiResponse = await getPublicFigureContent(publicFigureId);

        // console.log(`\n--- DEBUG LOG 1: Full Timeline API Response for [${publicFigureId}] ---`);
        // console.log(JSON.stringify(apiResponse.timeline_content.data, null, 2));

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
                            // Check for `event.sources` (the old way)
                            (event.sources || []).forEach((source) => {
                                if (source.id) sourcesSet.add(source.id);
                            });

                            // Check for `timeline_points` which might contain `sourceIds`
                            (event.timeline_points || []).forEach(point => {
                                (point.sourceIds || []).forEach(id => {
                                    if (id) sourcesSet.add(id);
                                });
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

        // console.log(`\n--- DEBUG LOG 2: Collected Source IDs to Fetch for [${publicFigureId}] ---`);
        // console.log(`Found ${uniqueArticleIds.length} unique source IDs.`);
        // console.log(uniqueArticleIds);

        const relatedFiguresObject = publicFigureData.related_figures || {};

        // 1. Get [key, value] pairs: [['akmu', 25], ['kimsoohyun', 18]]
        const similarFigureIds = Object.entries(relatedFiguresObject)
            // 2. Sort pairs by count (the value) in descending order
            .sort(([, countA], [, countB]) => countB - countA)
            // 3. Extract just the ID (the key) from the sorted pairs
            .map(([figureId]) => figureId)
            // 4. Get the top 2
            .slice(0, 2);

        const [articles, articleSummaries, similarProfiles] = await Promise.all([
            getArticlesByIds(uniqueArticleIds),
            getArticleSummaries(publicFigureId, uniqueArticleIds),
            getFiguresByIds(similarFigureIds) 
        ]);

        // console.log(`\n--- DEBUG LOG 3: Comparison for [${publicFigureId}] ---`);
        // console.log(`Requested: ${uniqueArticleIds.length} articles.`);
        // console.log(`Received:  ${articles.length} articles.`);
        // if (uniqueArticleIds.length !== articles.length) {
        //     console.error("!!! MISMATCH DETECTED: Not all requested articles were found or fetched. !!!");
        //     const requestedIds = new Set(uniqueArticleIds);
        //     const receivedIds = new Set(articles.map(a => a.id));
        //     const missingIds = [...requestedIds].filter(id => !receivedIds.has(id));
        //     console.log("Missing Article IDs:", missingIds);
        // }

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
            <div className="w-full max-w-6xl mx-auto p-4 lg:p-6 bg-white">
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
                            <h2 className="text-xl font-bold mb-4 pl-2 text-black">Career Journey</h2>
                            <CareerJourney
                                apiResponse={apiResponse.timeline_content}
                                articles={articles}
                                figureId={publicFigureData.id}
                                figureName={publicFigureData.name}
                                figureNameKr={publicFigureData.name_kr}
                            />
                        </div>
                    </div>

                    {/* --- RIGHT (SIDEBAR) COLUMN --- */}
                    <div className="hidden lg:block lg:sticky lg:top-20 mt-8 lg:mt-0 space-y-6 self-start">
                        <YouMightAlsoLike similarProfiles={similarProfiles} />
                        {/* <div className="h-96 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                            Vertical Ad Placeholder
                        </div> */}
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