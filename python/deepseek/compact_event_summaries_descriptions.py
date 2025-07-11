import asyncio
import argparse
from setup_firebase_deepseek import NewsManager

# --- CONFIGURATION ---
CURATED_TIMELINE_COLLECTION = "curated-timeline"
COMPACTED_EVENT_MARKER_FIELD = "is_compacted_v2" # Marker for the entire event's summary
COMPACTED_DESCRIPTION_MARKER_FIELD = "is_description_compacted_v2" # Marker for individual timeline points' descriptions

class DataUpdater:
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        self.news_manager = NewsManager()
        self.db = self.news_manager.db
        self.ai_client = self.news_manager.client
        self.ai_model = self.news_manager.model
        self.timeline_ref = self.db.collection('selected-figures').document(figure_id).collection(CURATED_TIMELINE_COLLECTION)
        print(f"✓ DataUpdater initialized for figure: {self.figure_id}")

    def _fetch_timeline_events(self) -> dict:
        """Fetches all existing timeline documents for the figure."""
        print("-> Fetching existing timeline data from Firestore...")
        all_events = {}
        docs = self.timeline_ref.stream()
        for doc in docs:
            all_events[doc.id] = doc.to_dict()
        print(f"✓ Found {len(all_events)} main category documents.")
        return all_events

    async def _summarize_description(self, text_to_summarize: str) -> str:
        """Uses the AI to summarize a single piece of text into one sentence."""
        if len(text_to_summarize.split()) < 15:
            return text_to_summarize

        system_prompt = "You are an expert editor. Your sole job is to take the provided text and summarize it into a single, clear, and concise sentence."
        user_prompt = f"Please summarize the following text into one concise sentence:\n\n---\n{text_to_summarize}\n---"

        try:
            response = await self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"    ! AI description summarization failed: {e}. Returning original text.")
            return text_to_summarize

    async def _summarize_event_summary(self, text_to_summarize: str) -> str:
        """Uses the AI to rewrite an event summary to be more compact (2-3 sentences)."""
        if len(text_to_summarize.split()) < 20: # Don't shorten already-short summaries
            return text_to_summarize

        system_prompt = "You are an expert editor. Your job is to rewrite the provided event summary to be more compact and engaging. Aim for 2-3 concise sentences."
        user_prompt = f"Please rewrite the following event summary to be more compact and clear (2-3 sentences max):\n\n---\n{text_to_summarize}\n---"

        try:
            response = await self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"    ! AI event summary rewrite failed: {e}. Returning original text.")
            return text_to_summarize

    async def run_update(self):
        """Main function to fetch, process, and update the descriptions and summaries."""
        all_events_data = self._fetch_timeline_events()

        if not all_events_data:
            print(f"! No timeline data found for figure '{self.figure_id}'. Exiting.")
            return

        print("\n-> Starting description and summary update process...")
        total_events_in_db = sum(len(sub_cat_data.get(sub_cat_name, [])) for main_cat_id, sub_cat_data in all_events_data.items() for sub_cat_name in sub_cat_data)
        
        events_processed_count = 0 # Count of events where *any* AI call was made
        events_skipped_full_event = 0 # Count of events completely skipped due to all parts being marked

        docs_to_update = {} # Dictionary to hold main category documents that need updating in Firestore

        for main_cat_id, main_cat_data in all_events_data.items():
            updated_main_cat_data = main_cat_data.copy()
            main_cat_doc_needs_update = False # Flag if any event in this main category was updated

            for sub_cat_name, events in main_cat_data.items():
                if not isinstance(events, list): # Ensure we are processing a list of events
                    continue

                updated_events_list = [] # A new list to build the updated events for this subcategory
                sub_cat_needs_update = False # Flag if any event in this subcategory was updated

                for event in events:
                    event_needs_ai_processing = False
                    current_event_tasks = []
                    descriptions_to_update_indices = [] # Stores indices of timeline points needing processing

                    # 1. Check if event_summary needs compaction
                    if not event.get(COMPACTED_EVENT_MARKER_FIELD, False):
                        current_event_tasks.append(self._summarize_event_summary(event.get("event_summary", "")))
                        event_needs_ai_processing = True
                    else:
                        current_event_tasks.append(None) # Placeholder for the event summary result if not processed

                    # 2. Check individual timeline point descriptions for compaction
                    if 'timeline_points' in event:
                        for idx, point in enumerate(event['timeline_points']):
                            if not point.get(COMPACTED_DESCRIPTION_MARKER_FIELD, False):
                                current_event_tasks.append(self._summarize_description(point.get("description", "")))
                                descriptions_to_update_indices.append(idx)
                                event_needs_ai_processing = True
                            else:
                                current_event_tasks.append(None) # Placeholder if description is already done

                    # --- Refined skipping logic: If no part of the event needs AI processing, skip it entirely ---
                    if not event_needs_ai_processing:
                        events_skipped_full_event += 1
                        updated_events_list.append(event) # Add the existing event (already compacted) to the new list
                        continue # Move to the next event in the loop
                    # --- End Refined skipping logic ---

                    # If we reach here, 'event_needs_ai_processing' is True, meaning at least one AI task will be run.
                    events_processed_count += 1
                    print(f"  Processing event '{event.get('event_title', 'Untitled')}' (partially or fully)...")

                    # Filter out None tasks before gathering (these were for already compacted parts)
                    tasks_to_run = [task for task in current_event_tasks if task is not None]
                    
                    results = await asyncio.gather(*tasks_to_run)
                    
                    result_idx_counter = 0 # Counter to keep track of results from asyncio.gather

                    # Update event summary if it was processed
                    if not event.get(COMPACTED_EVENT_MARKER_FIELD, False):
                        event['event_summary'] = results[result_idx_counter]
                        event[COMPACTED_EVENT_MARKER_FIELD] = True # Mark as compacted
                        sub_cat_needs_update = True
                        result_idx_counter += 1
                        print(f"    -> Event Summary compacted for '{event.get('event_title', 'Untitled')}'")
                    
                    # Update individual descriptions if they were processed
                    for original_idx in descriptions_to_update_indices:
                        event['timeline_points'][original_idx]['description'] = results[result_idx_counter]
                        event['timeline_points'][original_idx][COMPACTED_DESCRIPTION_MARKER_FIELD] = True # Mark as compacted
                        sub_cat_needs_update = True
                        result_idx_counter += 1
                        print(f"    -> Description {original_idx+1} compacted for '{event.get('event_title', 'Untitled')}'")
                    
                    # Add the (potentially modified) event to the new list for the subcategory
                    updated_events_list.append(event) 

                # If any event in this subcategory was updated (or marked), assign the new list back
                if sub_cat_needs_update:
                    updated_main_cat_data[sub_cat_name] = updated_events_list
                    main_cat_doc_needs_update = True

            # If any event in this main category document was updated, add it to the docs_to_update batch
            if main_cat_doc_needs_update:
                docs_to_update[main_cat_id] = updated_main_cat_data


        print(f"\n--- Compaction Process Summary for Figure: {self.figure_id} ---")
        print(f"Total events found in DB: {total_events_in_db}")
        print(f"Events completely skipped (already fully compacted): {events_skipped_full_event}")
        print(f"Events where AI calls were made (partial or full processing): {events_processed_count}")
        print(f"Documents to update in Firestore: {len(docs_to_update)}")

        if not docs_to_update:
            print("No documents needed updates based on compaction markers. Exiting without writing to Firestore.")
            return

        print("-> Uploading updated data to Firestore using a batch write...")
        batch = self.db.batch()
        for main_cat_id, main_cat_data_to_write in docs_to_update.items():
            doc_ref = self.timeline_ref.document(main_cat_id)
            batch.set(doc_ref, main_cat_data_to_write) # Use set to overwrite the entire document
        
        batch.commit()
        
        print(f"✓ Successfully committed updates to Firestore for figure '{self.figure_id}'.")


async def main():
    """
    Parses command-line arguments and runs the data updater.
    """
    parser = argparse.ArgumentParser(
        description="""
        Fetches timeline data for a specific figure, uses an AI to compact
        both the main event summaries and the descriptions of individual
        timeline points, and then updates the data in Firestore.
        """
    )
    parser.add_argument(
        "figure_id",
        type=str,
        help="The ID of the figure whose timeline data you want to update (e.g., 'newjeans')."
    )

    args = parser.parse_args()

    # Initialize the updater with the figure_id from the command-line arguments
    updater = DataUpdater(figure_id=args.figure_id)
    await updater.run_update()

if __name__ == "__main__":
    # To run this script, execute it from your terminal with the
    # figure ID as an argument.
    #
    # Example:
    # python compact_event_summaries_descriptions.py newjeans
    #
    # or for another figure:
    # python compact_event_summaries_descriptions.py another_figure_id
    asyncio.run(main())