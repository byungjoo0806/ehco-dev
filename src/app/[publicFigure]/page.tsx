// src/app/[publicFigure]/page.tsx
import { Suspense } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Loader2 } from 'lucide-react';
import ProfileInfo from '@/components/ProfileInfo';
import CelebrityWiki from '@/components/CelebrityWiki';
import type { JsonLdObject } from '@/components/JsonLd';
import { getArticlesByIds } from '@/lib/article-service';

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
    try {
        const resolvedParams = await params;
        const publicFigureData = await getPublicFigureData(resolvedParams.publicFigure);

        const title = publicFigureData.is_group
            ? `${publicFigureData.name} (${publicFigureData.name_kr}) - K-pop Group Profile & Information`
            : `${publicFigureData.name} (${publicFigureData.name_kr}) Profile & Information`;

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
        return {
            title: 'Public Figure Profile - EHCO',
            description: 'Public figure information and details',
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
        id: docSnap.id, name: data.name || '', name_kr: data.name_kr || '',
        gender: data.gender || '', nationality: data.nationality || '', occupation: data.occupation || [],
        is_group: Boolean(data.is_group), profilePic: data.profilePic || '',
        instagramUrl: data.instagramUrl || '', spotifyUrl: data.spotifyUrl || '',
        youtubeUrl: data.youtubeUrl || '', company: data.company || '',
        debutDate: data.debutDate || '', lastUpdated: data.lastUpdated || '',
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
    const publicFigureData = await getPublicFigureData(publicFigureId);
    const apiResponse = await getPublicFigureContent(publicFigureId);

    const allArticleIds: string[] = [...(apiResponse.main_overview.articleIds || [])];
    if (apiResponse.timeline_content.schema_version === 'v1_legacy') {
        const legacyArticleIds = apiResponse.timeline_content.data.categoryContent.flatMap((item: WikiContentItem) => item.articleIds || []);
        allArticleIds.push(...legacyArticleIds);
    } else { // v2_curated
        const sourcesSet = new Set<string>();
        Object.values(apiResponse.timeline_content.data).forEach((subCatMap) => {
            Object.values(subCatMap).forEach((eventList) => {
                eventList.forEach((event) => {
                    (event.sources || []).forEach((source) => {
                        if (source.id) {
                            sourcesSet.add(source.id);
                        }
                    });
                });
            });
        });
        allArticleIds.push(...Array.from(sourcesSet));
    }
    const uniqueArticleIds = allArticleIds.filter((id, index, self) => self.indexOf(id) === index);

    const [articles, articleSummaries] = await Promise.all([
        getArticlesByIds(uniqueArticleIds),
        getArticleSummaries(publicFigureId, uniqueArticleIds)
    ]);

    const schemaData = publicFigureData.is_group
        ? {
            "@context": "https://schema.org", "@type": "MusicGroup", name: publicFigureData.name,
            alternateName: publicFigureData.name_kr || null, nationality: publicFigureData.nationality,
            url: `https://ehco.ai/${publicFigureId}`,
            sameAs: [publicFigureData.instagramUrl, publicFigureData.spotifyUrl, publicFigureData.youtubeUrl].filter(Boolean) as string[],
            ...(publicFigureData.company ? { "member": { "@type": "Organization", "name": publicFigureData.company } } : {}),
            ...(publicFigureData.debutDate ? { "foundingDate": publicFigureData.debutDate.split(':')[0].trim() } : {}),
            ...(publicFigureData.is_group && (publicFigureData as GroupProfile).members &&
                (publicFigureData as GroupProfile).members!.length > 0 ? {
                "member": (publicFigureData as GroupProfile).members!.map(member => ({
                    "@type": "Person",
                    "birthDate": member.birthDate ? member.birthDate.split(':')[0].trim() : null,
                }))
            } : {})
        } as JsonLdObject
        : {
            "@context": "https://schema.org", "@type": "Person", name: publicFigureData.name,
            alternateName: publicFigureData.name_kr || null, gender: publicFigureData.gender,
            nationality: publicFigureData.nationality, url: `https://ehco.ai/${publicFigureId}`,
            sameAs: [publicFigureData.instagramUrl, publicFigureData.spotifyUrl, publicFigureData.youtubeUrl].filter(Boolean) as string[],
            ...(!publicFigureData.is_group && (publicFigureData as IndividualPerson).birthDate ? { "birthDate": (publicFigureData as IndividualPerson).birthDate!.split(':')[0].trim() } : {}),
            ...(!publicFigureData.is_group && (publicFigureData as IndividualPerson).group ? { "memberOf": { "@type": "MusicGroup", "name": (publicFigureData as IndividualPerson).group! } } : {}),
            ...(publicFigureData.company ? { "affiliation": { "@type": "Organization", "name": publicFigureData.company } } : {})
        } as JsonLdObject;

    return (
        <div className="w-full">
            <ProfileInfo
                publicFigureData={publicFigureData}
                mainOverview={apiResponse.main_overview}
            />
            <CelebrityWiki
                mainOverview={apiResponse.main_overview}
                apiResponse={apiResponse.timeline_content}
                articles={articles}
                articleSummaries={articleSummaries}
            />
            {/* <JsonLd data={schemaData} /> */}
        </div>
    );
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