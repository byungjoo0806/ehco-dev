import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit, startAfter, getCountFromServer, doc, getDoc, documentId } from "firebase/firestore";
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

// A specific type for the data shape fetched for the homepage
interface HomepageFigureFromDB {
    name: string;
    profilePic?: string;
}

// Hardcoded list of top 30 figures to display on homepage
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
            // --- OPTIMIZED LOGIC FOR TOP FIGURES ---
            const figuresRef = collection(db, 'selected-figures');

            const q = query(figuresRef, where(documentId(), 'in', TOP_FIGURES_IDS));

            const querySnapshot = await getDocs(q);

            const allFiguresData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as HomepageFigureFromDB)
            }));

            const sortedFigures = TOP_FIGURES_IDS.map(id =>
                allFiguresData.find(figure => figure.id === id)
            )
                .filter((figure): figure is { id: string } & HomepageFigureFromDB => figure !== undefined);

            const homepageFigures = sortedFigures.map(figure => ({
                id: figure.id,
                name: figure.name,
                profilePic: figure.profilePic || '/images/default-profile.png'
            }));

            return NextResponse.json(homepageFigures);

        } else {
            // --- ORIGINAL LOGIC FOR PAGINATED REQUESTS ---
            const pageParam = url.searchParams.get('page');
            const pageSizeParam = url.searchParams.get('pageSize');

            const page = pageParam ? parseInt(pageParam) : 1;
            const pageSize = pageSizeParam ? parseInt(pageSizeParam) : 18;

            const collectionRef = collection(db, 'selected-figures');
            const countSnapshot = await getCountFromServer(collectionRef);
            const totalCount = countSnapshot.data().count;
            const totalPages = Math.ceil(totalCount / pageSize);

            let figuresQuery;
            if (page > 1) {
                const itemsToSkip = (page - 1) * pageSize;
                const limitQuery = query(collectionRef, orderBy('name'), limit(itemsToSkip));
                const snapshot = await getDocs(limitQuery);
                const lastVisible = snapshot.docs[snapshot.docs.length - 1];
                figuresQuery = query(collectionRef, orderBy('name'), startAfter(lastVisible), limit(pageSize));
            } else {
                figuresQuery = query(collectionRef, orderBy('name'), limit(pageSize));
            }

            const figuresSnapshot = await getDocs(figuresQuery);
            const publicFigures: PublicFigure[] = figuresSnapshot.docs.map(docRef => {
                const data = docRef.data();
                const baseData = { id: docRef.id, ...data };
                return baseData as PublicFigure; // A simple cast assuming data is correct
            });

            return NextResponse.json({
                publicFigures,
                totalCount,
                totalPages,
                currentPage: page,
                pageSize
            });
        }
    } catch (error) {
        console.error('Error in API route:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Failed to fetch public figures', details: errorMessage },
            { status: 500 }
        );
    }
}