# File: python/analyzers/update_firebase_categories.py

from news_analyzer_final import NewsAnalyzer
from firebase_admin import credentials, firestore
import firebase_admin
import time

class NewsUpdater(NewsAnalyzer):
    def __init__(self, celebrity_name: str, korean_name: str):
        super().__init__(celebrity_name, korean_name)
        
        # Initialize Firebase
        try:
            self.db = firestore.client()
        except:
            cred = credentials.Certificate('/Users/ryujunhyoung/Desktop/EHCO/firebase/config/serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()

    def update_firebase_documents(self):
        # Get all news documents for this celebrity
        news_ref = self.db.collection('news')
        docs = news_ref.where('celebrity', '==', self.celebrity_name).stream()
        
        updated = 0
        batch = self.db.batch()
        batch_size = 0
        
        for doc in docs:
            article_data = doc.to_dict()
            
            # Skip if already has mainCategory
            if 'mainCategory' in article_data:
                continue
                
            try:
                # Get category using existing analysis logic
                category_prompt = f"""
                Task: Categorize this article about {self.celebrity_name} into ONE of these exact categories:

                Music: Activities related to music releases, collaborations, performances, tours, and music awards
                Acting: Work in dramas, films, OTT content, and variety shows
                Promotion: Fan meetings, media appearances, social media, brand activities
                Social: Personal life including fashion, family, relationships, and public activities
                Controversy: Issues related to plagiarism or romance

                Article Title: {article_data.get('title', '')}
                Article Content: {article_data.get('content', '')}

                Return ONLY the category name (Music, Acting, Promotion, Social, or Controversy).
                """
                
                main_category = self.llm.invoke(category_prompt).strip()
                
                # Add to batch
                batch.update(doc.reference, {
                    'mainCategory': main_category
                })
                batch_size += 1
                updated += 1
                
                # Commit batch when it reaches size limit
                if batch_size >= 500:
                    batch.commit()
                    batch = self.db.batch()
                    batch_size = 0
                    time.sleep(1)  # Small delay between batches
                
                print(f"Updated {article_data.get('title', '')[:50]}... -> {main_category}")
                
            except Exception as e:
                print(f"Error processing document: {e}")
                continue
        
        # Commit any remaining updates
        if batch_size > 0:
            batch.commit()
        
        print(f"\nUpdated {updated} documents")

def main():
    # Initialize updater with celebrity information
    updater = NewsUpdater("IU", "아이유")
    # Update existing documents
    updater.update_firebase_documents()

if __name__ == "__main__":
    main()