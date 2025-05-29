import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { NextResponse } from "next/server";

// Define the interfaces based on the actual data structure
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
}

interface IndividualPerson extends PublicFigureBase {
    is_group: false;
    gender: string;
    birthDate: string;
    chineseZodiac: string;
    company: string;
    debutDate: string;
    group: string;
    school: string[];
    zodiacSign: string;
}

interface GroupProfile extends PublicFigureBase {
    is_group: true;
    gender: string; // Usually "Group"
    members: IndividualPerson[];
    company: string;
    debutDate: string;
}

type PublicFigure = IndividualPerson | GroupProfile;

// Interface for wiki content items
interface WikiContentItem {
    id: string;
    category: string;
    subcategory?: string;
    content: string;
    articleIds: string[];
}

// Interface for the content response
interface WikiContentResponse {
    mainOverview: {
        id: string;
        content: string;
        articleIds: string[];
    };
    categoryContent: WikiContentItem[];
}

interface CategoryMapping {
    [key: string]: string;
}

const CATEGORY_MAPPING: CategoryMapping = {
    // Main categories
    'main-overview': 'Overview',
    'creative-works': 'Creative Works',
    'live-&-broadcast': 'Live & Broadcast',
    'public-relations': 'Public Relations',
    'personal-milestones': 'Personal Milestones',
    'incidents-&-controversies': 'Incidents & Controversies',

    // Subcategories
    'music': 'Creative Works',
    'film-&-tv': 'Creative Works',
    'publications-&-art': 'Creative Works',
    'awards-&-honors': 'Creative Works',
    'concerts-&-tours': 'Live & Broadcast',
    'fan-events': 'Live & Broadcast',
    'broadcast-appearances': 'Live & Broadcast',
    'media-interviews': 'Public Relations',
    'endorsements-&-ambassadors': 'Public Relations',
    'social-&-digital': 'Public Relations',
    'relationships-&-family': 'Personal Milestones',
    'health-&-service': 'Personal Milestones',
    'education-&-growth': 'Personal Milestones',
    'legal-&-scandal': 'Incidents & Controversies',
    'accidents-&-emergencies': 'Incidents & Controversies',
    'public-backlash': 'Incidents & Controversies',
};

const MAIN_CATEGORIES = [
    'Creative Works',
    'Live & Broadcast',
    'Public Relations',
    'Personal Milestones',
    'Incidents & Controversies'
];

export async function GET(
    request: Request,
    { params }: { params: Promise<{ publicFigure: string }> }
) {
    try {
        // Await the params object before accessing its properties
        const resolvedParams = await params;
        const publicFigureId = resolvedParams.publicFigure.toLowerCase();

        // First, verify the public figure exists
        const publicFigureRef = doc(db, 'selected-figures', publicFigureId);
        const publicFigureDoc = await getDoc(publicFigureRef);

        if (!publicFigureDoc.exists()) {
            return NextResponse.json(
                { error: 'Public figure not found' },
                { status: 404 }
            );
        }

        // Get the wiki content subcollection
        const wikiContentRef = collection(publicFigureRef, 'wiki-content');
        const wikiContentSnapshot = await getDocs(wikiContentRef);
        // console.log("Wiki content documents : ", wikiContentSnapshot);

        // Process the wiki content
        const mainOverview = { id: 'main-overview', content: "", articleIds: [] as string[] };
        const categoryContent: WikiContentItem[] = [];

        // Process each document in the wiki-content collection
        for (const doc of wikiContentSnapshot.docs) {
            const data = doc.data();
            const id = doc.id;

            if (id === 'main-overview') {
                // Handle main overview
                mainOverview.content = data.content || "";
                mainOverview.articleIds = data.articleIds || [];
            }
            else {
                const formattedId = formatDisplayName(id);

                // Explicit check for main categories
                if (MAIN_CATEGORIES.includes(formattedId)) {
                    categoryContent.push({
                        id,
                        category: formattedId,
                        content: data.content || "",
                        articleIds: data.articleIds || []
                    });
                }
                // Explicit check for subcategories
                else if (data.category && MAIN_CATEGORIES.includes(data.category)) {
                    categoryContent.push({
                        id,
                        category: data.category,
                        subcategory: formattedId,
                        content: data.content || "",
                        articleIds: data.articleIds || []
                    });
                }
                // Fallback - require explicit category field
                else {
                    console.warn(`Unclassified document: ${id}`, data);
                    categoryContent.push({
                        id,
                        category: 'Uncategorized',
                        subcategory: formattedId,
                        content: data.content || "",
                        articleIds: data.articleIds || []
                    });
                }
            }
        }

        // Build the final response structure
        const contentData: WikiContentResponse = {
            mainOverview,
            categoryContent
        };

        // console.log('Category Classification Report:', {
        //     mainCategories: categoryContent.filter(i => !i.subcategory).map(i => i.id),
        //     subcategories: categoryContent.filter(i => i.subcategory).map(i => ({
        //         id: i.id,
        //         parent: i.category,
        //         child: i.subcategory
        //     })),
        //     potentialIssues: categoryContent.filter(i =>
        //         i.subcategory && MAIN_CATEGORIES.includes(i.subcategory)
        //     )
        // });

        return NextResponse.json(contentData);
    } catch (error) {
        console.error('Error fetching public figure content:', error);
        return NextResponse.json(
            { error: 'Failed to fetch public figure content' },
            { status: 500 }
        );
    }
}

// Helper function to format document IDs for display (converting "live-&-broadcast" to "Live & Broadcast")
function formatDisplayName(id: string): string {
    return id
        .split('-')
        .map(word => word === '&' ? '&' : word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/\s&\s/g, ' & ');
}

// Helper function (modify based on your ID patterns)
function determineParentCategory(id: string): string {
    if (id.includes('music') || id.includes('film') || id.includes('art') || id.includes('awards')) return 'Creative Works';
    if (id.includes('events') || id.includes('appearances') || id.includes('concerts')) return 'Live & Broadcast';
    if (id.includes('interview') || id.includes('endorsements') || id.includes('social')) return 'Public Relations';
    if (id.includes('family') || id.includes('health') || id.includes('education')) return 'Personal Milestones';
    if (id.includes('scandal') || id.includes('accidents') || id.includes('backlash')) return 'Incidents & Controversies';
    return 'Uncategorized';
}