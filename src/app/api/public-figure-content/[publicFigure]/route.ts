import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, DocumentReference } from "firebase/firestore";
import { NextResponse } from "next/server";

// --- INTERFACES ---

// For new v2 curated data
interface CuratedEvent {
    event_title: string;
    event_summary: string;
    event_years: number[];
    primary_date: string;
    timeline_points: {
        date: string;
        description: string;
    }[];
    status: string;
    sources: string[];
}

interface SubCategoryMap {
    [subCategory: string]: CuratedEvent[];
}

// This interface is what we want our API to ultimately return for v2.
interface CuratedTimelineData {
    [mainCategory: string]: {
        description: string;
        subCategories: {
            [subCategory: string]: CuratedEvent[];
        };
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
    // ... (This function is correct, no changes needed)
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

// MODIFIED: This function is now simplified. Its ONLY job is to get the event data.
// It no longer needs to worry about descriptions.
async function fetchNewTimelineData(publicFigureRef: DocumentReference): Promise<Record<string, SubCategoryMap> | null> {
    const timelineCollectionRef = collection(publicFigureRef, 'curated-timeline');
    const timelineSnapshot = await getDocs(timelineCollectionRef);

    if (timelineSnapshot.empty) {
        return null;
    }

    const eventData: Record<string, SubCategoryMap> = {};
    for (const doc of timelineSnapshot.docs) {
        // Just get the raw data, which contains the sub-category fields.
        eventData[doc.id] = doc.data();
    }
    return eventData;
}

// NO CHANGE: This function is perfect because it already reads the 'wiki-content'
// documents where our descriptions are stored. We will reuse it.
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
            // This captures the main category documents and their content.
            categoryContent.push({ id, category: formattedId, content: data.content || "", articleIds: data.articleIds || [] });
        } else if (data.category && MAIN_CATEGORIES.includes(data.category)) {
            // This captures the sub-category documents for the v1 schema.
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

        // Fetch both sets of data in parallel
        const [timelineEventData, wikiData] = await Promise.all([
            fetchNewTimelineData(publicFigureRef),
            fetchLegacyWikiData(publicFigureRef)
        ]);

        // If we have timeline data, we are using the v2 schema.
        if (timelineEventData) {

            // Create a simple map to easily look up descriptions by category name.
            const descriptionMap = new Map<string, string>();
            wikiData.categoryContent.forEach(item => {
                // We only care about main categories here (items without a subcategory).
                if (!item.subcategory) {
                    descriptionMap.set(item.category, item.content);
                }
            });

            // Now, we'll build the final data structure the frontend expects.
            const finalCuratedData: CuratedTimelineData = {};

            for (const mainCategory in timelineEventData) {
                finalCuratedData[mainCategory] = {
                    // Get the description from our map.
                    description: descriptionMap.get(mainCategory) || "",
                    // The event data becomes the subCategories.
                    subCategories: timelineEventData[mainCategory]
                };
            }

            return NextResponse.json({
                main_overview: mainOverviewData,
                timeline_content: {
                    schema_version: 'v2_curated',
                    data: finalCuratedData // Send the newly merged data!
                }
            });
        }

        // Fallback to legacy schema if no timeline data exists.
        return NextResponse.json({
            main_overview: mainOverviewData,
            timeline_content: {
                schema_version: 'v1_legacy',
                data: wikiData
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