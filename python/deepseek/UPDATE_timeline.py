import asyncio
import json
import argparse # Added
from collections import defaultdict
from setup_firebase_deepseek import NewsManager
from typing import Union, Optional, Dict, Any, List

# --- CONFIGURATION ---
# TARGET_FIGURE_ID is now handled by the argument parser
CURATED_TIMELINE_COLLECTION = "curated-timeline"

class CurationEngine:
    RECENT_EVENTS_CONTEXT_LIMIT = 50
    
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        self.news_manager = NewsManager()
        self.db = self.news_manager.db
        self.ai_client = self.news_manager.client
        self.ai_model = self.news_manager.model
        print(f"✓ CurationEngine initialized for figure: {self.figure_id}")

    # =================================================================================
    # STANDARDIZED HELPER FUNCTIONS (TO MATCH initial_migration_v2.py)
    # =================================================================================

    # --- MODIFIED ---
    async def _recategorize_event(self, event_data: dict, all_categories: dict) -> Union[tuple[str, str], None]:
        """Takes a single event object and determines its correct main and subcategory."""
        system_prompt = "You are an expert content classifier. Your job is to analyze an event and classify it into a main category and a subcategory from the provided hierarchical list. You must follow the structure exactly. The subcategory you choose must be one of the valid options listed under the main category you select. Your response must be a single, valid JSON object."
        category_options = json.dumps(all_categories, indent=2)
        user_prompt = f"""
        Please analyze the following timeline event and classify it.

        Event Data:
        - Title: "{event_data.get('event_title', '')}"
        - Summary: "{event_data.get('event_summary', '')}"

        ---
        Category Options (with Main > Subcategory structure):
        {category_options}
        ---

        **CRITICAL INSTRUCTIONS:**
        1. First, select the single most appropriate `main_category` from the top-level keys in the options above.
        2. Second, from the list of subcategories *ONLY under your chosen main_category*, select the single most appropriate `subcategory`.
        3. The `subcategory` value in your response MUST be a direct child of the `main_category` value.

        Your response must be a single JSON object with two keys: "main_category" and "subcategory".
        """
        try:
            response = await self.ai_client.chat.completions.create(model=self.ai_model, messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}], response_format={"type": "json_object"})
            result = json.loads(response.choices[0].message.content)
            main_cat, sub_cat = result.get("main_category"), result.get("subcategory")
            if main_cat and sub_cat and main_cat in all_categories and sub_cat in all_categories[main_cat]:
                return main_cat, sub_cat
            else:
                print(f"    Warning: AI returned an invalid category pairing: {main_cat} / {sub_cat}. Will skip.")
                return None, None
        except Exception as e:
            print(f"    Error during event re-categorization: {e}")
            return None, None

    # --- NEW (from migration script) ---
    def _create_mini_event(self, source_id: str, date: str, summary: str) -> Dict[str, Any]:
        """Takes a single data point and formats it into a standardized "mini-event" object."""
        return {
            "event_title": summary,
            "event_summary": f"On {date}, an event occurred: {summary}",
            "timeline_points": [{"date": date, "description": summary, "sourceIds": [source_id]}]
        }
        
    def _get_sort_date(self, event: dict) -> str:
        """Safely retrieves the first date from an event's timeline points for sorting."""
        try:
            # Assumes the first point's date is representative
            return event.get('timeline_points', [{}])[0].get('date', '1900-01-01')
        except (IndexError, TypeError):
            # Return a very old date if the structure is unexpected
            return '1900-01-01'

    # --- MODIFIED ---
    async def _call_curation_api(self, subcategory_name: str, existing_events: list, new_event_data_point: dict) -> Union[dict, None]:
        """Takes a new data point and decides if it should be merged or used to create a new one."""
        system_prompt = """
        You are an Expert Timeline Curator. Your primary goal is to maintain a clean and readable timeline with concise, **one-phrase event titles**.

        You will receive a new piece of information and a list of existing events. Your task is to integrate the new information.
        - If the new information belongs to a *specific, closely related* existing event, update that event.
        - If it represents a distinct new topic, create a new event.

        **CRITICAL TITLE RULE 1:** The `event_title` you create must be a short, descriptive phrase summarizing a specific event.
        **CRITICAL TITLE RULE 2:** **AVOID creating overly broad, generic titles** like "Career Highlights" or "Group Activities."

        You will ALWAYS return a complete `event_json` object with a concise title and a well-written summary.
        """
        user_prompt = f"""
        You are curating the timeline for the subcategory: "{subcategory_name}".

        Here are the existing curated events:
        {json.dumps(existing_events, indent=2)}

        ---
        Here is the new information to integrate. Note that its "event_title" is just a long description; your job is to fix this by creating a concise, SPECIFIC title.

        New Information Point:
        {json.dumps(new_event_data_point, indent=2)}
        ---

        Now, decide how to integrate this new information. Your response MUST use one of the two following JSON formats:

        **Option 1: CREATE_NEW**
        {{
          "action": "CREATE_NEW",
          "event_json": {{ ... }}
        }}

        **Option 2: UPDATE_EXISTING**
        {{
          "action": "UPDATE_EXISTING",
          "target_event_title": "The exact title of the event to update",
          "event_json": {{ ... }}
        }}
        """
        try:
            response = await self.ai_client.chat.completions.create(model=self.ai_model, messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}], response_format={"type": "json_object"})
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"    Error during curation API call: {e}")
            return None

    def _get_all_subcategories(self) -> dict:
        """Returns a predefined, hardcoded dictionary of main and subcategories."""
        return {
            "Creative Works": ["Music", "Film & TV", "Publications & Art", "Awards & Honors"],
            "Live & Broadcast": ["Concerts & Tours", "Fan Events", "Broadcast Appearances"],
            "Public Relations": ["Media Interviews", "Endorsements & Ambassadors", "Social & Digital"],
            "Personal Milestones": ["Relationships & Family", "Health & Service", "Education & Growth"],
            "Incidents & Controversies": ["Legal & Scandal", "Accidents & Emergencies", "Public Backlash"]
        }

    def _add_event_years(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Calculates and adds the 'event_years' field to an event object."""
        years = set()
        for point in event.get('timeline_points', []):
            date_str = point.get('date', '')
            if date_str and isinstance(date_str, str) and '-' in date_str:
                try: years.add(int(date_str.split('-')[0]))
                except (ValueError, IndexError): pass
        event['event_years'] = sorted(list(years), reverse=True)
        return event

    # --- MODIFIED ---
    def _fetch_unprocessed_articles(self) -> list:
        """Fetches ALL unprocessed articles, regardless of their content."""
        print("Fetching ALL unprocessed articles...")
        from google.cloud.firestore_v1.base_query import FieldFilter
        
        articles_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries')
        query = articles_ref.where(filter=FieldFilter('is_processed_for_timeline', '!=', True))
        
        # We return the full document object now, not a custom dictionary
        articles = [doc for doc in query.stream()]
        
        print(f"Found {len(articles)} unprocessed articles to check.")
        return articles

    # --- REWRITTEN to align with migration script ---
    async def run_incremental_update(self):
        """Fetches unprocessed articles and intelligently merges their events into the timeline."""
        print(f"--- Starting Incremental Timeline Update for {self.figure_id} ---")
        
        all_categories = self._get_all_subcategories()
        # This now gets ALL unprocessed articles
        articles_to_process = self._fetch_unprocessed_articles()

        if not articles_to_process:
            print("No new articles to process. Update complete.")
            await self.news_manager.close() # Close connection if nothing to do
            return

        for article_snapshot in articles_to_process:
            source_id = article_snapshot.id
            article_data = article_snapshot.to_dict()
            
            # Use .get() to safely access the field. It returns None if the key doesn't exist.
            event_contents = article_data.get('event_contents')

            # --- THIS IS THE CORE OF THE FIX ---
            # Check if event_contents is missing, not a dictionary, or empty.
            if not event_contents or not isinstance(event_contents, dict):
                print(f"  -> Article {source_id} has no 'event_contents'. Marking as processed.")
                # Mark it as processed and immediately continue to the next article
                article_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries').document(source_id)
                article_ref.update({"is_processed_for_timeline": True})
                continue # Skip to the next item in the main 'for' loop
            # --- END OF FIX ---

            # If the script reaches here, it means event_contents exists and is valid.
            # The original processing logic now runs.
            print(f"\nProcessing article with sourceId: {source_id} ({len(event_contents)} event points)")
            
            # Process each granular event point within the article
            for date, summary in event_contents.items():
                if not date or not summary: continue
                
                # 1. Create a "mini-event"
                new_event_point = self._create_mini_event(source_id, date, summary)
                print(f"  -> Processing event point: '{new_event_point.get('event_title')}'")

                # 2. Re-categorize the event
                main_cat, sub_cat = await self._recategorize_event(new_event_point, all_categories)
                if not main_cat or not sub_cat:
                    print("    -> Failed to classify event point. Skipping.")
                    continue
                print(f"    -> Classified into: [{main_cat}] > [{sub_cat}]")

                # 3. Fetch existing events and apply context limit
                timeline_doc_ref = self.db.collection('selected-figures').document(self.figure_id).collection(CURATED_TIMELINE_COLLECTION).document(main_cat)
                existing_main_category_data = timeline_doc_ref.get().to_dict() or {}
                curated_events_for_subcategory = existing_main_category_data.get(sub_cat, [])

                # --- START OF MODIFICATION ---
                limited_context_events = curated_events_for_subcategory
                if len(curated_events_for_subcategory) > self.RECENT_EVENTS_CONTEXT_LIMIT:
                    print(f"    -> Context reduction: Original event count is {len(curated_events_for_subcategory)}. Limiting to {self.RECENT_EVENTS_CONTEXT_LIMIT}.")
                    # Sort events chronologically (oldest to newest)
                    sorted_events = sorted(curated_events_for_subcategory, key=self._get_sort_date)
                    # Slice the list to get only the last N (most recent) events
                    limited_context_events = sorted_events[-self.RECENT_EVENTS_CONTEXT_LIMIT:]
                # --- END OF MODIFICATION ---

                # 4. Curation AI call (now with the limited list)
                ai_decision = await self._call_curation_api(sub_cat, limited_context_events, new_event_point)
                
                if not ai_decision or "action" not in ai_decision or "event_json" not in ai_decision:
                    print("    Action: Curation AI failed or returned invalid format. Skipping point.")
                    continue

                # 5. Apply AI decision
                action = ai_decision.get("action")
                event_json = ai_decision.get("event_json")

                if action == "CREATE_NEW":
                    curated_events_for_subcategory.append(self._add_event_years(event_json))
                elif action == "UPDATE_EXISTING":
                    target_title = ai_decision.get("target_event_title")
                    found_and_updated = False
                    if target_title:
                        for idx, event in enumerate(curated_events_for_subcategory):
                            if event.get("event_title") == target_title:
                                curated_events_for_subcategory[idx] = self._add_event_years(event_json)
                                found_and_updated = True
                                break
                    if not found_and_updated:
                        curated_events_for_subcategory.append(self._add_event_years(event_json))
                
                # 6. Save data back to Firestore
                existing_main_category_data[sub_cat] = curated_events_for_subcategory
                timeline_doc_ref.set(existing_main_category_data)
                print(f"    -> Successfully updated timeline for [{main_cat}] > [{sub_cat}]")

            # 7. CRITICAL: Mark the entire article as processed after all its events are handled
            article_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries').document(source_id)
            article_ref.update({"is_processed_for_timeline": True})
            print(f"  -> Finished processing article {source_id} and marked as processed.")
        
        # Close the connection after the loop finishes
        await self.news_manager.close()
        print("\n--- Incremental Update Complete ---")


async def main():
    """Parses arguments and runs the update process."""
    parser = argparse.ArgumentParser(
        description="""
        Runs an incremental update to the timeline. Processes new articles for a specific figure,
        or for all figures if no figure ID is specified.
        """
    )
    parser.add_argument(
        "--figure",
        type=str,
        help="Optional: The ID of a single figure to process. If omitted, the script runs for all figures."
    )
    args = parser.parse_args()

    news_manager = NewsManager()
    db = news_manager.db
    
    figure_ids_to_process = []
    if args.figure:
        figure_ids_to_process.append(args.figure)
        print(f"\n--- Running update in single-figure mode for: {args.figure.upper()} ---")
    else:
        print("\n--- Running update in all-figures mode ---")
        try:
            all_figure_docs = db.collection('selected-figures').stream()
            figure_ids_to_process = [doc.id for doc in all_figure_docs]
            print(f"Found {len(figure_ids_to_process)} figures to process: {', '.join(figure_ids_to_process)}")
        except Exception as e:
            print(f"Error fetching all figure IDs: {e}")
            return
            
    for figure_id in figure_ids_to_process:
        print(f"\n{'='*25} PROCESSING FIGURE: {figure_id.upper()} {'='*25}")
        engine = CurationEngine(figure_id=figure_id)
        await engine.run_incremental_update()

if __name__ == "__main__":
    asyncio.run(main())