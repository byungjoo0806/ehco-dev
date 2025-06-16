import asyncio
import json
from collections import defaultdict
from setup_firebase_deepseek import NewsManager

# --- CONFIGURATION ---
TARGET_FIGURE_ID = "iu(leejieun)"
CURATED_TIMELINE_COLLECTION = "curated-timeline"

class CurationEngine:
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        self.news_manager = NewsManager()
        self.db = self.news_manager.db
        self.ai_client = self.news_manager.client
        self.ai_model = self.news_manager.model
        print(f"✓ CurationEngine initialized for figure: {self.figure_id}")

    # NEW, SIMPLER FUNCTION FOR INITIAL GENERATION
    async def _generate_initial_event(self, raw_entry: dict) -> dict:
        """Takes a single raw entry and asks the AI to generate one structured event JSON
        with the corrected data structure (sourceIds within timeline_points)."""
        
        system_prompt = "You are an expert data entry assistant. Your sole job is to take the provided text and convert it into a single, structured JSON object representing a timeline event. Follow all formatting rules precisely. The final output must be only the JSON object."
        
        # This new prompt explicitly tells the AI the new structure.
        user_prompt = f"""
        Please convert the following information into a single event JSON object.
        The event object must have 'event_title', 'event_summary', and a 'timeline_points' array.
        
        CRITICAL INSTRUCTION: Each object inside the 'timeline_points' array must have three keys: 'date', 'description', and 'sourceIds'.
        The 'sourceIds' field MUST be an array containing ONLY the single source ID provided below.

        Information to process:
        - sourceId: "{raw_entry['sourceId']}"
        - content: {json.dumps(raw_entry['content'])}

        ---
        EXAMPLE of a single timeline point object within the array:
        {{
          "date": "2024-10-26",
          "description": "A specific event that occurred.",
          "sourceIds": ["{raw_entry['sourceId']}"]
        }}
        ---

        Now, generate the complete JSON object for the event based on the content provided.
        """
        
        try:
            response = await self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                response_format={"type": "json_object"}
            )
            event_json = json.loads(response.choices[0].message.content)
            
            # Basic validation to ensure the response is in the expected format
            if 'event_title' in event_json and 'timeline_points' in event_json:
                # Ensure sourceIds are correctly formatted as arrays
                for point in event_json.get('timeline_points', []):
                    if 'sourceIds' not in point:
                        point['sourceIds'] = [raw_entry['sourceId']] # Inject if missing
                    elif not isinstance(point['sourceIds'], list):
                        point['sourceIds'] = [raw_entry['sourceId']] # Fix if not a list
                return event_json

            # Handle cases where the AI wraps the object
            for key, value in event_json.items():
                if isinstance(value, dict) and 'event_title' in value:
                    return value # Return the nested dictionary
            
            print("    Warning: AI response was not in the expected format.")
            return None
        except Exception as e:
            print(f"    Error during initial event generation: {e}")
            return None

    # This function is now only for merging/curation
    async def _call_curation_api(self, subcategory_name: str, existing_events: list, new_event: dict) -> dict:
        """Takes a new, pre-formatted event and decides if it should be merged into the existing timeline,
        correctly handling the nested sourceIds."""
        
        system_prompt = """
        You are an Expert Timeline Editor. Your task is to intelligently merge historical event data.
        When you decide to MERGE, you must combine the `timeline_points` from the new event into the target event.
        - If a timeline point from the new event is completely new, add it to the list.
        - If a timeline point is identical to an existing one (same date and description), MERGE their `sourceIds` arrays, ensuring no duplicate IDs.
        - The final `updated_event_json` must be a complete, coherent, and chronologically sorted event object.
        """
        
        user_prompt = f"""
        You are curating the timeline for the subcategory: "{subcategory_name}".

        Here are the existing curated events, which follow the correct data structure:
        {json.dumps(existing_events, indent=2)}

        ---
        A new event has been generated from a new source. Your task is to decide if this new event should be MERGED with one of the existing events, or if it should be ADDED AS NEW.

        New Event to evaluate:
        {json.dumps(new_event, indent=2)}
        ---

        Your Decision (Respond with one of the two JSON formats):

        Option 1: MERGE
        Merge the new event's timeline points into an existing event. Combine sourceIds for identical points.
        {{
          "decision": "MERGE",
          "target_event_title": "The exact title of the event to merge with",
          "updated_event_json": {{ ... the complete, merged and updated event object with combined timeline_points ... }}
        }}

        Option 2: ADD AS NEW
        The new event is distinct and should not be merged.
        {{
          "decision": "ADD_AS_NEW"
        }}
        """
        
        try:
            response = await self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"    Error during curation API call: {e}")
            return None

    # The two functions below remain unchanged
    def _get_all_subcategories(self) -> dict:
        # ... no changes here ...
        print("Finding all unique subcategories to process...")
        articles_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries')
        docs = articles_ref.get()
        grouped_categories = defaultdict(set)
        for doc in docs:
            data = doc.to_dict()
            main_cat = data.get('mainCategory')
            sub_cat = data.get('subcategory')
            if main_cat and sub_cat:
                grouped_categories[main_cat].add(sub_cat)
        for main_cat in grouped_categories:
            grouped_categories[main_cat] = list(grouped_categories[main_cat])
        print(f"Found {sum(len(v) for v in grouped_categories.values())} subcategories across {len(grouped_categories)} main categories.")
        return dict(grouped_categories)

    def _fetch_raw_entries_for_subcategory(self, subcategory_name: str) -> list:
        # ... no changes here ...
        from google.cloud.firestore_v1.base_query import FieldFilter
        articles_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries')
        query = articles_ref.where(filter=FieldFilter('subcategory', '==', subcategory_name)).order_by("primary_event_date", direction="ASCENDING")
        docs = query.get()
        raw_entries = []
        for doc in docs:
            data = doc.to_dict()
            content = f"Summary: {data.get('summary', '')}\n\nBody: {data.get('body', '')}"
            primary_date = data.get("primary_event_date")
            raw_entries.append({
                "sourceId": doc.id,
                "primary_date_for_context": primary_date.strftime('%Y-%m-%d') if primary_date else "Unknown Date",
                "all_event_dates": data.get("event_dates", []),
                "content": content
            })
        return raw_entries
    
    # UPDATED Main logic loop
    async def run_initial_migration(self):
        print("--- Starting Category-Based Timeline Migration ---")
        all_categories = self._get_all_subcategories()
        final_timeline = defaultdict(dict)

        for main_cat, sub_cat_list in all_categories.items():
            for sub_cat in sub_cat_list:
                print(f"\n--- Processing: [{main_cat}] > [{sub_cat}] ---")
                raw_entries = self._fetch_raw_entries_for_subcategory(sub_cat)
                if not raw_entries:
                    print("No entries found for this subcategory. Skipping.")
                    continue

                curated_events_for_subcategory = []
                for i, entry in enumerate(raw_entries):
                    print(f"  -> Processing entry {i + 1}/{len(raw_entries)} (Source: {entry['sourceId']})")
                    
                    # STEP A: Generate a single structured event from the raw entry
                    newly_generated_event = await self._generate_initial_event(entry)
                    if not newly_generated_event:
                        print("    Action: FAILED to generate initial event. Skipping.")
                        continue
                    
                    # If this is the first event, just add it and continue
                    if not curated_events_for_subcategory:
                        curated_events_for_subcategory.append(newly_generated_event)
                        print(f"    Action: CREATED first event '{newly_generated_event.get('event_title')}'")
                        continue
                    
                    # STEP B: Ask the curation AI if this new event should be merged
                    ai_decision = await self._call_curation_api(sub_cat, curated_events_for_subcategory, newly_generated_event)
                    if not ai_decision:
                        print("    Action: Curation AI failed. Adding event as new.")
                        curated_events_for_subcategory.append(newly_generated_event)
                        continue

                    decision_type = ai_decision.get("decision")
                    if decision_type == "MERGE":
                        target_title = ai_decision.get("target_event_title")
                        updated_event = ai_decision.get("updated_event_json")
                        if target_title and updated_event:
                            # ... merge logic ...
                            found = False
                            for idx, event in enumerate(curated_events_for_subcategory):
                                if event.get("event_title") == target_title:
                                    curated_events_for_subcategory[idx] = updated_event
                                    found = True
                                    print(f"    Action: MERGED into '{target_title}'")
                                    break
                            if not found:
                                curated_events_for_subcategory.append(updated_event)
                                print(f"    Action: MERGE failed (target not found). Added merged event as new.")
                        else:
                            curated_events_for_subcategory.append(newly_generated_event)
                            print("    Action: MERGE decision received, but data was incomplete. Added event as new.")
                    
                    elif decision_type == "ADD_AS_NEW":
                        curated_events_for_subcategory.append(newly_generated_event)
                        print(f"    Action: ADDED AS NEW event '{newly_generated_event.get('event_title')}'")
                    else: # Default case if decision is unclear
                        curated_events_for_subcategory.append(newly_generated_event)
                        print(f"    Action: Decision unclear. Added event as new.")


                final_timeline[main_cat][sub_cat] = curated_events_for_subcategory

        print("\n--- Migration processing complete. Saving to Firestore... ---")
        timeline_collection_ref = self.db.collection('selected-figures').document(self.figure_id).collection(CURATED_TIMELINE_COLLECTION)
        for main_cat, sub_cat_data in final_timeline.items():
            timeline_collection_ref.document(main_cat).set(sub_cat_data)
        print(f"Successfully saved data for {len(final_timeline)} main categories.")


async def main():
    engine = CurationEngine(figure_id=TARGET_FIGURE_ID)
    await engine.run_initial_migration()

if __name__ == "__main__":
    asyncio.run(main())