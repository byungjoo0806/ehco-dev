# File: python/scripts/clear_firebase_collection.py

import firebase_admin
from firebase_admin import credentials, firestore
import time

def clear_news_collection():
    # Initialize Firebase
    try:
        db = firestore.client()
    except:
        cred = credentials.Certificate('/Users/ryujunhyoung/EHCO/firebase/config/serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
        db = firestore.client()

    # Get all documents from news collection
    docs = db.collection('news').stream()
    
    # Delete in batches
    batch = db.batch()
    count = 0
    total_deleted = 0
    
    print("Starting deletion...")
    
    for doc in docs:
        batch.delete(doc.reference)
        count += 1
        total_deleted += 1
        
        # Commit every 500 deletions
        if count >= 500:
            print(f"Deleting batch of {count} documents...")
            batch.commit()
            batch = db.batch()
            count = 0
            time.sleep(1)  # Prevent rate limiting
    
    # Commit any remaining deletions
    if count > 0:
        print(f"Deleting final batch of {count} documents...")
        batch.commit()
    
    print(f"\nSuccessfully deleted {total_deleted} documents from news collection")

if __name__ == "__main__":
    clear_news_collection()