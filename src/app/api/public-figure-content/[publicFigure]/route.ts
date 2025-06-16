import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, DocumentReference } from "firebase/firestore";
import { NextResponse } from "next/server";

// --- INTERFACES ---

// For new v2 curated data
interface CuratedEvent {
    event_title: string;
    event_summary: string;
    primary_date: string;
    timeline_points: {
        date: string;
        description: string;
    }[];
    status: string;
    sources: string[];
}

interface CuratedTimelineData {
    [mainCategory: string]: {
        [subCategory: string]: CuratedEvent[];
    };
}

// For old v1 legacy data
interface WikiContentItem {
    id: string;
    category: string;
    subcategory?: string;
    content: string;
    articleIds: string[];
}

interface LegacyWikiData {
    categoryContent: WikiContentItem[];
}


// --- HELPER FUNCTIONS ---

async function fetchMainOverview(publicFigureRef: DocumentReference) {
    const overviewRef = doc(publicFigureRef, 'wiki-content', 'main-overview');
    const overviewDoc = await getDoc(overviewRef);
    if (overviewDoc.exists()) {
        const data = overviewDoc.data();
        return {
            id: 'main-overview',
            content: data.content || "",
            articleIds: data.articleIds || []
        };
    }
    return { id: 'main-overview', content: "", articleIds: [] };
}

async function fetchNewTimelineData(publicFigureRef: DocumentReference): Promise<CuratedTimelineData | null> {
    const timelineCollectionRef = collection(publicFigureRef, 'curated-timeline');
    const timelineSnapshot = await getDocs(timelineCollectionRef);

    if (timelineSnapshot.empty) {
        return null;
    }

    const curatedData = {} as CuratedTimelineData;

    for (const doc of timelineSnapshot.docs) {
        curatedData[doc.id] = doc.data();
    }

    return curatedData;
}

async function fetchLegacyWikiData(publicFigureRef: DocumentReference): Promise<LegacyWikiData> {
    const wikiContentRef = collection(publicFigureRef, 'wiki-content');
    const wikiContentSnapshot = await getDocs(wikiContentRef);

    const categoryContent: WikiContentItem[] = [];
    const MAIN_CATEGORIES = ['Creative Works', 'Live & Broadcast', 'Public Relations', 'Personal Milestones', 'Incidents & Controversies'];
    const formatDisplayName = (id: string): string => id.split('-').map(word => word === '&' ? '&' : word.charAt(0).toUpperCase() + word.slice(1)).join(' ').replace(/\s&\s/g, ' & ');

    for (const doc of wikiContentSnapshot.docs) {
        if (doc.id === 'main-overview') continue;

        const data = doc.data();
        const id = doc.id;
        const formattedId = formatDisplayName(id);
        if (MAIN_CATEGORIES.includes(formattedId)) {
            categoryContent.push({ id, category: formattedId, content: data.content || "", articleIds: data.articleIds || [] });
        } else if (data.category && MAIN_CATEGORIES.includes(data.category)) {
            categoryContent.push({ id, category: data.category, subcategory: formattedId, content: data.content || "", articleIds: data.articleIds || [] });
        }
    }
    return { categoryContent };
}


// --- MAIN GET HANDLER ---
export async function GET(
    request: Request,
    { params }: { params: Promise<{ publicFigure: string }> }
) {
    try {
        const { publicFigure } = await params;
        const publicFigureId = publicFigure.toLowerCase();
        const publicFigureRef = doc(db, 'selected-figures', publicFigureId);
        const publicFigureDoc = await getDoc(publicFigureRef);

        if (!publicFigureDoc.exists()) {
            return NextResponse.json({ error: 'Public figure not found' }, { status: 404 });
        }

        const mainOverviewData = await fetchMainOverview(publicFigureRef);
        const newTimelineData = await fetchNewTimelineData(publicFigureRef);

        if (newTimelineData) {
            return NextResponse.json({
                main_overview: mainOverviewData,
                timeline_content: {
                    schema_version: 'v2_curated',
                    data: newTimelineData
                }
            });
        }

        const legacyWikiData = await fetchLegacyWikiData(publicFigureRef);

        return NextResponse.json({
            main_overview: mainOverviewData,
            timeline_content: {
                schema_version: 'v1_legacy',
                data: legacyWikiData
            }
        });

    } catch (error) {
        console.error('Error fetching public figure content:', error);
        return NextResponse.json(
            { error: 'Failed to fetch public figure content' },
            { status: 500 }
        );
    }
}