// src/scripts/initialSync.ts
import { syncCollectionToAlgolia } from '../lib/algolia';

async function runInitialSync() {
    try {
        console.log('Starting initial sync...');
        await syncCollectionToAlgolia('your_collection_name');
        console.log('Initial sync completed successfully');
    } catch (error) {
        console.error('Initial sync failed:', error);
    }
}

// Run the function
runInitialSync();