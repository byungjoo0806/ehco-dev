import asyncio
from setup_firebase_deepseek import NewsManager
from typing import Dict, Any

# --- CONFIGURATION ---
# Set the ID of the figure whose timeline you want to update.
TARGET_FIGURE_ID = "iu(leejieun)"
CURATED_TIMELINE_COLLECTION = "curated-timeline"

class BackfillEngine:
    """
    A class to connect to Firestore and backfill the 'event_years' field
    for all events in a figure's curated timeline.
    """
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        # Establishes connection to the database
        self.db = NewsManager().db
        self.timeline_ref = self.db.collection('selected-figures').document(self.figure_id).collection(CURATED_TIMELINE_COLLECTION)
        print(f"✓ BackfillEngine initialized for figure: {self.figure_id}")

    def _calculate_and_add_years(self, event: Dict[str, Any]) -> bool:
        """
        Calculates 'event_years' from 'timeline_points' and adds it to the event object.
        Returns True if the event was modified, False otherwise.
        """
        # If the field already exists, we don't need to do anything.
        if 'event_years' in event and isinstance(event['event_years'], list):
            return False

        years = set()
        for point in event.get('timeline_points', []):
            date_str = point.get('date', '')
            # Basic validation for 'YYYY-MM-DD' format
            if date_str and isinstance(date_str, str) and '-' in date_str:
                try:
                    year = int(date_str.split('-')[0])
                    years.add(year)
                except (ValueError, IndexError):
                    # Silently ignore malformed dates during backfill
                    pass
        
        if not years:
            return False # No valid years found, no update needed

        # Add the new field, sorted from newest to oldest
        event['event_years'] = sorted(list(years), reverse=True)
        return True

    async def run_backfill(self):
        """
        Main method to execute the backfill process.
        It fetches all main category documents, processes them, and updates if necessary.
        """
        print(f"\n--- Starting backfill process for: {self.figure_id} ---")
        
        try:
            main_category_docs = self.timeline_ref.stream()
            update_count = 0

            for doc in main_category_docs:
                main_cat_name = doc.id
                main_cat_data = doc.to_dict()
                document_needs_update = False
                print(f"-> Scanning main category: [{main_cat_name}]")

                # Iterate through all subcategories and their events within the document
                for sub_cat, events in main_cat_data.items():
                    if not isinstance(events, list):
                        continue # Skip if data is not in expected format
                    
                    for event in events:
                        # The helper function modifies the event dictionary in-place
                        if self._calculate_and_add_years(event):
                            document_needs_update = True
                
                # If any event in the document was updated, write the whole document back
                if document_needs_update:
                    print(f"  -> Found missing 'event_years'. Updating document in Firestore...")
                    doc.reference.set(main_cat_data)
                    update_count += 1
                    print(f"  -> Successfully updated [{main_cat_name}].")
                else:
                    print(f"  -> No updates needed for [{main_cat_name}].")
            
            if update_count == 0:
                print("\n--- Backfill complete. No documents required updates. ---")
            else:
                print(f"\n--- Backfill complete. Successfully updated {update_count} documents. ---")

        except Exception as e:
            print(f"\nAn error occurred during the backfill process: {e}")
            print("Please check your Firebase connection and permissions.")

async def main():
    engine = BackfillEngine(figure_id=TARGET_FIGURE_ID)
    await engine.run_backfill()

if __name__ == "__main__":
    # This allows the script to be run directly from the command line
    asyncio.run(main())
