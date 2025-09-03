import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { NextResponse } from "next/server";

interface PublicFigure {
    id: string;
    name: string;
    name_kr?: string;
    profilePic?: string;
    nationality?: string;
    occupation?: string[];
    gender?: string;
    company?: string;
    debutDate?: string;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { figureIds } = body;

        if (!figureIds || !Array.isArray(figureIds)) {
            return NextResponse.json(
                { error: 'figureIds array is required' },
                { status: 400 }
            );
        }

        if (figureIds.length === 0) {
            return NextResponse.json([]);
        }

        // Firestore 'in' queries are limited to 10 items, so we need to batch them
        const batchSize = 10;
        const batches = [];
        
        for (let i = 0; i < figureIds.length; i += batchSize) {
            const batch = figureIds.slice(i, i + batchSize);
            batches.push(batch);
        }

        const allResults: PublicFigure[] = [];

        // Execute all batches
        for (const batch of batches) {
            const q = query(
                collection(db, 'selected-figures'),
                where('__name__', 'in', batch) // __name__ refers to document ID
            );
            
            const querySnapshot = await getDocs(q);
            
            querySnapshot.docs.forEach(doc => {
                const data = doc.data();
                allResults.push({
                    id: doc.id,
                    name: data.name || '',
                    name_kr: data.name_kr || '',
                    profilePic: data.profilePic || '',
                    nationality: data.nationality || '',
                    occupation: data.occupation || [],
                    gender: data.gender || '',
                    company: data.company || '',
                    debutDate: data.debutDate || '',
                });
            });
        }

        return NextResponse.json(allResults);
    } catch (error) {
        console.error('Error fetching figures by IDs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch figures' },
            { status: 500 }
        );
    }
}

// Fallback GET method for name-based search
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const name = url.searchParams.get('name');

        if (!name) {
            return NextResponse.json(
                { error: 'name parameter is required' },
                { status: 400 }
            );
        }

        // Search by name (case-insensitive contains)
        const q = query(collection(db, 'selected-figures'));
        const querySnapshot = await getDocs(q);
        
        const results: PublicFigure[] = [];
        
        querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            const figureName = (data.name || '').toLowerCase();
            const figureNameKr = (data.name_kr || '').toLowerCase();
            const searchTerm = name.toLowerCase();
            
            // Check if name matches (contains)
            if (figureName.includes(searchTerm) || 
                figureNameKr.includes(searchTerm) ||
                searchTerm.includes(figureName)) {
                results.push({
                    id: doc.id,
                    name: data.name || '',
                    name_kr: data.name_kr || '',
                    profilePic: data.profilePic || '',
                    nationality: data.nationality || '',
                    occupation: data.occupation || [],
                    gender: data.gender || '',
                    company: data.company || '',
                    debutDate: data.debutDate || '',
                });
            }
        });

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error searching figures by name:', error);
        return NextResponse.json(
            { error: 'Failed to search figures' },
            { status: 500 }
        );
    }
}
