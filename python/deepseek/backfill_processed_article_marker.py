import sys
from setup_firebase_deepseek import NewsManager # Assuming this is your setup file

# --- CONFIGURATION ---
# Make sure this matches the figure you want to update
TARGET_FIGURE_ID = "newjeans" 

class BackfillProcessor:
    """
    A utility class to perform a one-time update on the 'article-summaries'
    collection. It adds the 'is_processed_for_timeline' field to all
    documents and sets its value to False.
    """
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        try:
            self.news_manager = NewsManager()
            self.db = self.news_manager.db
            print(f"✓ Firestore connection successful for figure: {self.figure_id}")
        except Exception as e:
            print(f"Error: Failed to connect to Firestore. Please check your setup. Details: {e}")
            sys.exit(1) # Exit the script if connection fails

    def run_backfill(self):
        """
        Iterates through all documents in the article-summaries collection
        and updates them with the new field.
        """
        print("\n--- Starting Backfill Process ---")
        print("This script will add 'is_processed_for_timeline: false' to all articles.")
        
        try:
            articles_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries')
            docs = articles_ref.stream()
            
            # Using a batch for efficiency is better for many documents
            batch = self.db.batch()
            count = 0
            commit_count = 0

            for doc in docs:
                # Add the update operation to the batch
                batch.update(doc.reference, {"is_processed_for_timeline": False})
                count += 1
                
                # Firestore batches have a limit of 500 operations.
                # Commit every 400 operations to be safe.
                if count % 400 == 0:
                    print(f"Committing batch of 400 documents...")
                    batch.commit()
                    commit_count += 400
                    # Start a new batch
                    batch = self.db.batch()

            # Commit any remaining documents in the last batch
            if count > commit_count:
                print(f"Committing final batch of {count - commit_count} documents...")
                batch.commit()

            print("\n--- Backfill Complete ---")
            print(f"Successfully updated a total of {count} documents.")

        except Exception as e:
            print(f"\nAn error occurred during the backfill process: {e}")
            print("The process may be partially complete.")

def main():
    processor = BackfillProcessor(figure_id=TARGET_FIGURE_ID)
    processor.run_backfill()

if __name__ == "__main__":
    # To run this script, save it as `backfill_processed_flag.py`
    # and execute it from your terminal.
    main()