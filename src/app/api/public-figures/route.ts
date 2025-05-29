import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit, startAfter, orderBy, getCountFromServer } from "firebase/firestore";
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

export async function GET(request: Request) {
    // console.log('API Route called', new Date().toISOString());

    try {
        const url = new URL(request.url);
        const pageParam = url.searchParams.get('page');
        const pageSizeParam = url.searchParams.get('pageSize');

        const page = pageParam ? parseInt(pageParam) : 1;
        const pageSize = pageSizeParam ? parseInt(pageSizeParam) : 18;

        // console.log('Page:', page, 'PageSize:', pageSize);

        // Get total count of documents
        // console.log('Getting total count...');
        const collectionRef = collection(db, 'selected-figures');
        const countSnapshot = await getCountFromServer(collectionRef);
        const totalCount = countSnapshot.data().count;
        const totalPages = Math.ceil(totalCount / pageSize);

        // console.log('Total count:', totalCount, 'Total pages:', totalPages);

        // Create query with pagination
        let figuresQuery;

        if (page === 1) {
            // First page - no startAfter needed
            figuresQuery = query(
                collection(db, 'selected-figures'),
                orderBy('name'),
                limit(pageSize)
            );
        } else {
            // For subsequent pages, we need to skip to the correct position
            // This is a workaround since Firestore doesn't support offset
            let lastDoc = null;
            const itemsToSkip = (page - 1) * pageSize;

            // Get all documents up to this page (this is expensive but necessary for page-based pagination)
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
                // If we couldn't get the lastDoc, fall back to beginning
                figuresQuery = query(
                    collection(db, 'selected-figures'),
                    orderBy('name'),
                    limit(pageSize)
                );
            }
        }

        // console.log('Executing query...');
        const figuresSnapshot = await getDocs(figuresQuery);
        const docs = figuresSnapshot.docs;
        // console.log('Got documents:', docs.length);

        // Debug: log first and last document names
        if (docs.length > 0) {
            // console.log('First document:', docs[0].data().name);
            // console.log('Last document:', docs[docs.length - 1].data().name);
        }

        // Process the documents
        const publicFigures: PublicFigure[] = docs.map(docRef => {
            const data = docRef.data();

            // Create the base public figure data
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

            // Add type-specific fields based on is_group
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

        // console.log('Sending response:', {
        //     figuresCount: publicFigures.length,
        //     totalCount,
        //     totalPages,
        //     currentPage: page,
        //     firstFigureName: publicFigures[0]?.name,
        //     lastFigureName: publicFigures[publicFigures.length - 1]?.name
        // });

        return NextResponse.json(response);
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