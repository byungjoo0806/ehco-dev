// src/lib/figures.ts

import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface FigureId {
    id: string;
}

/**
 * Fetches the IDs of all documents from the 'selected-figures' collection.
 * This is optimized for sitemap generation as it only retrieves the document ID.
 */
export async function fetchAllFigureIds(): Promise<FigureId[]> {
    try {
        const figuresQuery = query(collection(db, 'selected-figures'), orderBy('name'));
        const querySnapshot = await getDocs(figuresQuery);

        // We only need the ID for the sitemap
        const figureIds = querySnapshot.docs.map(doc => ({ id: doc.id }));

        console.log(`Successfully fetched ${figureIds.length} figure IDs for sitemap.`);
        return figureIds;

    } catch (error) {
        console.error("Error fetching figure IDs from Firestore:", error);
        return []; // Return an empty array on error
    }
}