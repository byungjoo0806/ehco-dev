import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, doc, getDoc } from "firebase/firestore";
import { NextResponse } from "next/server";

// Base interface for all public figures
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
    gender: string;
    company?: string;
    debutDate?: string;
    lastUpdated?: string;
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

// Hardcoded list of top 30 figures to display on homepage (using document IDs)
const TOP_FIGURES_IDS = [
    "bts", "blackpink", "bigbang", "exo", "bongjoonho", "jungkook",
    "rm", "girls'generation", "twice", "suga", "jimin", "jin",
    "songjoongki", "jhope", "seventeen", "parkchanwook", "newjeans", "nct",
    "leebyunghun", "songhyekyo", "redvelvet", "leejungjae", "2ne1", "hajungwoo",
    "straykids", "junjihyun", "madongseok", "hyunbin", "hongsangsoo", "kimsoohyun"
];

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const isTopRequest = url.pathname.includes('/top');

        if (isTopRequest) {
            // Handle top figures request for homepage
            console.log('Fetching top figures...');
            
            // Since we have document IDs, we can fetch them directly
            const allFigures: PublicFigure[] = [];

            // Fetch documents by their IDs
            for (const figureId of TOP_FIGURES_IDS) {
                try {
                    const docRef = doc(db, 'selected-figures', figureId);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        const data = docSnap.data();

                        // Create the base public figure data
                        const publicFigureBase: PublicFigureBase = {
                            id: docSnap.id,
                            name: data.name || '',
                            name_kr: data.name_kr || '',
                            gender: data.gender || '',
                            nationality: data.nationality || '',
                            occupation: data.occupation || [],
                            profilePic: data.profilePic || '',
                            instagramUrl: data.instagramUrl || '',
                            spotifyUrl: data.spotifyUrl || '',
                            youtubeUrl: data.youtubeUrl || '',
                            company: data.company || '',
                            debutDate: data.debutDate || '',
                            lastUpdated: data.lastUpdated || '',
                        };

                        // Add type-specific fields based on is_group
                        if (data.is_group) {
                            allFigures.push({
                                ...publicFigureBase,
                                is_group: true,
                                members: data.members || []
                            } as GroupProfile);
                        } else {
                            allFigures.push({
                                ...publicFigureBase,
                                is_group: false,
                                birthDate: data.birthDate || '',
                                chineseZodiac: data.chineseZodiac || '',
                                group: data.group || '',
                                school: data.school || [],
                                zodiacSign: data.zodiacSign || ''
                            } as IndividualPerson);
                        }
                    } else {
                        console.warn(`Document not found: ${figureId}`);
                    }
                } catch (error) {
                    console.error(`Error fetching document ${figureId}:`, error);
                }
            }

            // Transform to match the expected format for homepage (without articleCount)
            const homepageFigures = allFigures.map(figure => ({
                id: figure.id,
                name: figure.name,
                profilePic: figure.profilePic
            }));

            console.log(`Returning ${homepageFigures.length} top figures`);
            return NextResponse.json(homepageFigures);
        } else {
            // Handle regular paginated request (existing logic)
            const pageParam = url.searchParams.get('page');
            const pageSizeParam = url.searchParams.get('pageSize');

            const page = pageParam ? parseInt(pageParam) : 1;
            const pageSize = pageSizeParam ? parseInt(pageSizeParam) : 18;

            // Get total count of documents
            const collectionRef = collection(db, 'selected-figures');
            const countSnapshot = await getCountFromServer(collectionRef);
            const totalCount = countSnapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            // Create query with pagination
            let figuresQuery;

            if (page === 1) {
                figuresQuery = query(
                    collection(db, 'selected-figures'),
                    orderBy('name'),
                    limit(pageSize)
                );
            } else {
                let lastDoc = null;
                const itemsToSkip = (page - 1) * pageSize;

                const tempQuery = query(
                    collection(db, 'selected-figures'),
                    orderBy('name'),
                    limit(itemsToSkip)
                );

                const tempSnapshot = await getDocs(tempQuery);
                if (tempSnapshot.docs.length > 0) {
                    lastDoc = tempSnapshot.docs[tempSnapshot.docs.length - 1];
                }

                if (lastDoc) {
                    figuresQuery = query(
                        collection(db, 'selected-figures'),
                        orderBy('name'),
                        startAfter(lastDoc),
                        limit(pageSize)
                    );
                } else {
                    figuresQuery = query(
                        collection(db, 'selected-figures'),
                        orderBy('name'),
                        limit(pageSize)
                    );
                }
            }

            const figuresSnapshot = await getDocs(figuresQuery);
            const docs = figuresSnapshot.docs;

            const publicFigures: PublicFigure[] = docs.map(docRef => {
                const data = docRef.data();

                const publicFigureBase: PublicFigureBase = {
                    id: docRef.id,
                    name: data.name || '',
                    name_kr: data.name_kr || '',
                    gender: data.gender || '',
                    nationality: data.nationality || '',
                    occupation: data.occupation || [],
                    profilePic: data.profilePic || '',
                    instagramUrl: data.instagramUrl || '',
                    spotifyUrl: data.spotifyUrl || '',
                    youtubeUrl: data.youtubeUrl || '',
                    company: data.company || '',
                    debutDate: data.debutDate || '',
                    lastUpdated: data.lastUpdated || '',
                };

                if (data.is_group) {
                    return {
                        ...publicFigureBase,
                        is_group: true,
                        members: data.members || []
                    } as GroupProfile;
                } else {
                    return {
                        ...publicFigureBase,
                        is_group: false,
                        birthDate: data.birthDate || '',
                        chineseZodiac: data.chineseZodiac || '',
                        group: data.group || '',
                        school: data.school || [],
                        zodiacSign: data.zodiacSign || ''
                    } as IndividualPerson;
                }
            });

            const response = {
                publicFigures,
                totalCount,
                totalPages,
                currentPage: page,
                pageSize
            };

            return NextResponse.json(response);
        }
    } catch (error) {
        console.error('Error in API route:', error);

        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            return NextResponse.json(
                { error: 'Failed to fetch public figures', details: error.message },
                { status: 500 }
            );
        } else {
            console.error('Unknown error type');
            return NextResponse.json(
                { error: 'Failed to fetch public figures', details: 'Unknown error' },
                { status: 500 }
            );
        }
    }
}