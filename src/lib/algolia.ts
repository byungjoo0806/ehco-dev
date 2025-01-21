// src/lib/algolia.ts
import { algoliasearch } from 'algoliasearch';
import { db } from '@/lib/firebase'; // Adjust based on your firebase config location
import { collection, getDocs, DocumentData } from 'firebase/firestore';

// Define types
interface AlgoliaDocument extends DocumentData {
    objectID: string;
    _timestamp?: number;
}

interface SearchOptions {
    hitsPerPage?: number;
    page?: number;
    filters?: string;
}

// Initialize Algolia client
const client = algoliasearch(
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
    process.env.ALGOLIA_ADMIN_API_KEY!
);

client.searchSingleIndex({indexName: "celebrities", searchParams: "a"})

// // Initialize the index - no longer need to use initIndex
// const index = 'your_index_name';

// Function to convert Firestore document to Algolia object
const transformDoc = (doc: DocumentData): AlgoliaDocument => {
    const data = doc.data();
    return {
        objectID: doc.id,
        ...data,
        _timestamp: data._timestamp?.toMillis()
    };
};

// Function to sync all documents from a collection to Algolia
export const syncCollectionToAlgolia = async (collectionName: string) => {
    try {
        console.log(`Starting sync of collection ${collectionName} to Algolia...`);

        const querySnapshot = await getDocs(collection(db, collectionName));
        const records = querySnapshot.docs.map(transformDoc);

        if (records.length === 0) {
            console.log('No documents found to index');
            return;
        }

        const result = await client.saveObjects({ indexName: collectionName, objects: records});
        console.log(`Successfully indexed ${records.length} documents to Algolia`);
        return result;
    } catch (error) {
        console.error('Error syncing to Algolia:', error);
        throw error;
    }
};

// Function to add/update a single document in Algolia
export const syncDocumentToAlgolia = async (
    collectionName: string,
    docId: string,
    data: DocumentData
) => {
    try {
        const algoliaObject: AlgoliaDocument = {
            objectID: docId,
            ...data,
            _timestamp: data._timestamp?.toMillis()
        };

        await client.saveObject({ indexName: collectionName, body: algoliaObject});
        console.log(`Document ${docId} synced to Algolia`);
    } catch (error) {
        console.error('Error syncing document to Algolia:', error);
        throw error;
    }
};

// Function to delete a document from Algolia
export const deleteDocumentFromAlgolia = async (collectionName: string, docId: string) => {
    try {
        await client.deleteObject({ indexName: collectionName, objectID: docId});
        console.log(`Document ${docId} deleted from Algolia`);
    } catch (error) {
        console.error('Error deleting document from Algolia:', error);
        throw error;
    }
};

// // Function to search Algolia index
// export const searchAlgolia = async (query: string, options: SearchOptions = {}) => {
//     try {
//         const searchResults = await client.search();
//         return searchResults;
//     } catch (error) {
//         console.error('Error searching Algolia:', error);
//         throw error;
//     }
// };