import asyncio
import argparse
import sys
from google.cloud.firestore_v1.base_query import FieldFilter
from setup_firebase_deepseek import NewsManager # Assuming this sets up your clients

# --- CONFIGURATION (Must match compact_event_summaries_descriptions.py) ---
CURATED_TIMELINE_COLLECTION = "curated-timeline"
COMPACTED_EVENT_MARKER_FIELD = "is_compacted_v2" # Marker for the entire event's summary
COMPACTED_DESCRIPTION_MARKER_FIELD = "is_description_compacted_v2" # Marker for individual timeline points' descriptions

class CompactionMarkerBackfiller:
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        try:
            self.news_manager = NewsManager()
            self.db = self.news_manager.db
            self.timeline_ref = self.db.collection('selected-figures').document(figure_id).collection(CURATED_TIMELINE_COLLECTION)
            print(f"✓ CompactionMarkerBackfiller initialized for figure: {self.figure_id}")
        except Exception as e:
            print(f"Error: Failed to connect to Firestore for figure {figure_id}. Details: {e}")
            sys.exit(1) # Exit if connection fails

    async def run_backfill(self):
        """
        Iterates through all timeline events for the specified figure and
        adds the compaction markers to events and their descriptions.
        This operation assumes the content has ALREADY been compacted externally.
        """
        print(f"\n--- Starting Backfill for Compaction Markers for figure: {self.figure_id} ---")
        print(f"This script will add '{COMPACTED_EVENT_MARKER_FIELD}: true' to events")
        print(f"and '{COMPACTED_DESCRIPTION_MARKER_FIELD}: true' to timeline point descriptions.")
        print("USE THIS ONLY IF THE CONTENT HAS ALREADY BEEN COMPACTED!")

        try:
            all_events_data = self._fetch_timeline_events()

            if not all_events_data:
                print(f"! No timeline data found for figure '{self.figure_id}'. Skipping backfill.")
                return

            print(f"\n-> Processing {len(all_events_data)} main category documents...")
            
            batch = self.db.batch()
            documents_updated_count = 0
            events_marked_count = 0
            descriptions_marked_count = 0

            for main_cat_id, main_cat_data in all_events_data.items():
                updated_main_cat_data = main_cat_data.copy() # Work on a copy
                main_cat_doc_modified = False

                for sub_cat_name, events in main_cat_data.items():
                    if not isinstance(events, list):
                        continue

                    # Create a new list for events in this subcategory to hold modified events
                    updated_events_list = []
                    sub_cat_modified = False

                    for event in events:
                        event_modified = False
                        
                        # Add event-level marker if not present
                        if not event.get(COMPACTED_EVENT_MARKER_FIELD, False):
                            event[COMPACTED_EVENT_MARKER_FIELD] = True
                            event_modified = True
                            events_marked_count += 1
                            # print(f"  Marked event summary for: '{event.get('event_title', 'Untitled')}'")

                        # Add description-level markers for each timeline point if not present
                        if 'timeline_points' in event and isinstance(event['timeline_points'], list):
                            for point in event['timeline_points']:
                                if not point.get(COMPACTED_DESCRIPTION_MARKER_FIELD, False):
                                    point[COMPACTED_DESCRIPTION_MARKER_FIELD] = True
                                    event_modified = True
                                    descriptions_marked_count += 1
                                    # print(f"    Marked description for point in '{event.get('event_title', 'Untitled')}'")
                        
                        # Add the (potentially modified) event to the list
                        updated_events_list.append(event)
                        if event_modified:
                            sub_cat_modified = True

                    # If any event in this subcategory was modified, update the subcategory data
                    if sub_cat_modified:
                        updated_main_cat_data[sub_cat_name] = updated_events_list
                        main_cat_doc_modified = True

                # If the main category document was modified, add it to the batch
                if main_cat_doc_modified:
                    doc_ref = self.timeline_ref.document(main_cat_id)
                    batch.set(doc_ref, updated_main_cat_data) # Use set to overwrite
                    documents_updated_count += 1
                    print(f"  Preparing update for document: {main_cat_id}")

            if documents_updated_count > 0:
                print(f"\nCommitting batch for figure '{self.figure_id}'...")
                # await batch.commit() # Commit the batch asynchronously
                batch.commit()
                print(f"✅ Successfully updated {documents_updated_count} documents for figure '{self.figure_id}'.")
                print(f"  - Marked {events_marked_count} event summaries.")
                print(f"  - Marked {descriptions_marked_count} timeline point descriptions.")
            else:
                print(f"\nNo documents required marking for figure '{self.figure_id}'. Already up-to-date.")

        except Exception as e:
            print(f"\n❌ An error occurred during the backfill process for '{self.figure_id}': {e}")
            print("The process may be partially complete.")
        finally:
            await self.news_manager.close()


    def _fetch_timeline_events(self) -> dict:
        """Helper to fetch all existing timeline documents for the figure."""
        # This is a synchronous call, suitable for use within the async run_backfill method
        # or if you change run_backfill to be synchronous itself.
        # For simplicity, keeping it synchronous as Firestore stream() can be synchronous.
        all_events = {}
        try:
            docs = self.timeline_ref.stream()
            for doc in docs:
                all_events[doc.id] = doc.to_dict()
            return all_events
        except Exception as e:
            print(f"Error fetching timeline events for {self.figure_id}: {e}")
            return {}


async def main():
    """
    Parses command-line arguments and runs the backfill process.
    Allows processing a single figure or all figures.
    """
    parser = argparse.ArgumentParser(
        description="""
        A one-time utility to backfill compaction markers ('is_compacted_v2' and 'is_description_compacted_v2')
        onto existing timeline events and their descriptions in Firestore.
        USE THIS ONLY IF THE CONTENT HAS ALREADY BEEN COMPACTED BY A PREVIOUS PROCESS!
        """
    )
    parser.add_argument(
        "--figure_id",
        type=str,
        help="Optional: The ID of a single figure to process (e.g., 'newjeans'). If not provided, all figures will be processed."
    )
    
    args = parser.parse_args()

    if args.figure_id:
        print(f"--- Running marker backfill for specified figure: {args.figure_id} ---")
        backfiller = CompactionMarkerBackfiller(figure_id=args.figure_id)
        await backfiller.run_backfill()
    else:
        print("--- Running marker backfill for ALL Figures in 'selected-figures' collection ---")
        manager = NewsManager() # Use NewsManager to get db connection
        db = manager.db

        figure_ids = []
        try:
            print("Fetching all figure IDs from 'selected-figures' collection...")
            figures_ref = db.collection('selected-figures')
            docs = figures_ref.stream()
            for doc in docs:
                figure_ids.append(doc.id)
            print(f"Found {len(figure_ids)} figures to process.")
        except Exception as e:
            print(f"Error fetching figure IDs: {e}")
            await manager.close()
            sys.exit(1)

        await manager.close() # Close the initial manager connection after fetching IDs

        if not figure_ids:
            print("No figures found to process. Exiting.")
            return

        for figure_id in figure_ids:
            backfiller = CompactionMarkerBackfiller(figure_id=figure_id)
            await backfiller.run_backfill()
            await asyncio.sleep(1) # Small delay between figures

        print("\n--- ALL FIGURE MARKER BACKFILLS COMPLETED ---")


if __name__ == "__main__":
    # To run this script:
    #   For a specific figure: python backfill_compaction_markers.py --figure_id your_figure_id
    #   For all figures:      python backfill_compaction_markers.py
    asyncio.run(main())