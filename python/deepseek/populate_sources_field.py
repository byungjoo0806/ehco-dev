import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os

class SourcesPopulator:
    def __init__(self):
        self.db = self.setup_firebase()
    
    def setup_firebase(self):
        """Initialize Firebase with environment variables and proper error handling"""
        load_dotenv()
        
        try:
            config_path = os.getenv('FIREBASE_CONFIG_PATH')
            database_url = os.getenv('FIREBASE_DEFAULT_DATABASE_URL')
            
            if not config_path:
                raise ValueError("FIREBASE_CONFIG_PATH not found in environment variables")
            if not database_url:
                raise ValueError("FIREBASE_DATABASE_URL not found in environment variables")
            if not os.path.exists(config_path):
                raise FileNotFoundError(f"Service account key not found at: {config_path}")
            
            try:
                cred = credentials.Certificate(config_path)
                firebase_admin.initialize_app(cred, {
                    'databaseURL': database_url
                })
                print("Firebase initialized successfully with specific database")
            except ValueError as e:
                if "The default Firebase app already exists" in str(e):
                    print("Using existing Firebase app")
                else:
                    raise e
            
            try:
                db = firestore.client()
                print("Firestore client connected successfully")
                return db
            except Exception as e:
                print(f"Failed to get Firestore client: {e}")
                raise
                
        except Exception as e:
            print(f"Failed to initialize Firebase: {e}")
            raise

    def populate_suga_sources(self):
        """
        Populate the 'sources' field in the 'suga' document with all document IDs 
        from its 'article-summaries' subcollection
        """
        try:
            print("Starting to populate sources for 'suga' document...")
            
            # 1. Get reference to the 'suga' document
            suga_doc_ref = self.db.collection('selected-figures').document('suga')
            
            # 2. Check if the document exists
            suga_doc = suga_doc_ref.get()
            if not suga_doc.exists:
                print("Error: 'suga' document not found in 'selected-figures' collection")
                return False
            
            print("✓ Found 'suga' document")
            
            # 3. Get all document IDs from the 'article-summaries' subcollection
            article_summaries_ref = suga_doc_ref.collection('article-summaries')
            summary_docs = article_summaries_ref.stream()
            
            # Extract all document IDs
            article_ids = []
            for doc in summary_docs:
                article_ids.append(doc.id)
            
            print(f"✓ Found {len(article_ids)} documents in 'article-summaries' subcollection")
            
            if len(article_ids) == 0:
                print("Warning: No documents found in 'article-summaries' subcollection")
                return False
            
            # 4. Update the 'sources' field in the 'suga' document
            suga_doc_ref.update({
                'sources': article_ids
            })
            
            print(f"✅ Successfully updated 'sources' field with {len(article_ids)} article IDs:")
            for i, article_id in enumerate(article_ids[:5]):  # Show first 5 IDs
                print(f"  - {article_id}")
            if len(article_ids) > 5:
                print(f"  ... and {len(article_ids) - 5} more")
            
            # 5. Verify the update
            updated_doc = suga_doc_ref.get()
            updated_sources = updated_doc.to_dict().get('sources', [])
            print(f"✓ Verification: 'sources' field now contains {len(updated_sources)} items")
            
            return True
            
        except Exception as e:
            print(f"❌ Error occurred while populating sources: {e}")
            raise

def main():
    """Main function to run the script"""
    try:
        populator = SourcesPopulator()
        success = populator.populate_suga_sources()
        
        if success:
            print("\n🎉 Script completed successfully!")
        else:
            print("\n⚠️ Script completed with warnings - check the output above")
            
    except Exception as e:
        print(f"\n💥 Script failed with error: {e}")

if __name__ == "__main__":
    main()