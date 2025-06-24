import asyncio
import json
from collections import defaultdict
from setup_firebase_deepseek import NewsManager
from typing import Union, Optional, Dict, Any

# --- CONFIGURATION ---
TARGET_FIGURE_ID = "ateez"
CURATED_TIMELINE_COLLECTION = "curated-timeline"

class CurationEngine:
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        self.news_manager = NewsManager()
        self.db = self.news_manager.db
        self.ai_client = self.news_manager.client
        self.ai_model = self.news_manager.model
        print(f"✓ CurationEngine initialized for figure: {self.figure_id}")
        
    # AI FUNCTION FOR RE-CATEGORIZATION
    async def _recategorize_event(self, event_data: dict, all_categories: dict) -> Union[tuple[str, str], None]:
        """
        Takes a single event object and determines its correct main and subcategory.
        """
        system_prompt = "You are an expert content classifier. Your job is to read the event summary and determine the most appropriate main and subcategory from the provided list. Respond with a JSON object containing 'main_category' and 'subcategory'."
        
        category_options = json.dumps(all_categories, indent=2)
        
        user_prompt = f"""
        Please analyze the following timeline event and classify it into the most appropriate category from the options provided.

        Event Data:
        - Title: "{event_data.get('event_title', '')}"
        - Summary: "{event_data.get('event_summary', '')}"
        - Timeline Points: {json.dumps(event_data.get('timeline_points', []), indent=2)}

        ---
        Category Options:
        {category_options}
        ---

        Based on the event content, what is the correct classification?
        Your response must be a single JSON object with two keys: "main_category" and "subcategory".
        Example: {{ "main_category": "Film & TV", "subcategory": "Drama Series" }}
        """
        
        try:
            response = await self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            main_cat = result.get("main_category")
            sub_cat = result.get("subcategory")

            if main_cat and sub_cat and main_cat in all_categories and sub_cat in all_categories[main_cat]:
                return main_cat, sub_cat
            else:
                print(f"    Warning: AI returned an invalid category: {main_cat} / {sub_cat}. Will skip this event for now.")
                return None, None

        except Exception as e:
            print(f"    Error during event re-categorization: {e}")
            return None, None

    # FUNCTION FOR INITIAL EVENT GENERATION FROM A RAW ARTICLE
    async def _generate_initial_event(self, raw_entry: dict) -> Union[dict, None]:
        """Takes a single raw entry and asks the AI to generate one structured event JSON."""
        
        system_prompt = "You are an expert data entry assistant. Your sole job is to take the provided text and convert it into a single, structured JSON object representing a timeline event. Follow all formatting rules precisely. The final output must be only the JSON object."
        
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
            
            if 'event_title' in event_json and 'timeline_points' in event_json:
                for point in event_json.get('timeline_points', []):
                    if 'sourceIds' not in point:
                        point['sourceIds'] = [raw_entry['sourceId']]
                    elif not isinstance(point['sourceIds'], list):
                        point['sourceIds'] = [raw_entry['sourceId']]
                return event_json

            for key, value in event_json.items():
                if isinstance(value, dict) and 'event_title' in value:
                    return value
            
            print("    Warning: AI response was not in the expected format.")
            return None
        except Exception as e:
            print(f"    Error during initial event generation: {e}")
            return None

    # FUNCTION FOR MERGING/CURATION DECISIONS
    async def _call_curation_api(self, subcategory_name: str, existing_events: list, new_event: dict) -> Union[dict, None]:
        """Takes a new, pre-formatted event and decides if it should be merged into the existing timeline."""
        
        system_prompt = """
        You are an Expert Timeline Editor. Your task is to intelligently merge historical event data.
        When you decide to MERGE, you must combine the `timeline_points` from the new event into the target event.
        - If a timeline point from the new event is completely new, add it to the list.
        - If a timeline point is identical to an existing one (same date and description), MERGE their `sourceIds` arrays, ensuring no duplicate IDs.
        - The final `updated_event_json` must be a complete, coherent, and chronologically sorted event object.
        """
        
        user_prompt = f"""
        You are curating the timeline for the subcategory: "{subcategory_name}".

        Here are the existing curated events:
        {json.dumps(existing_events, indent=2)}

        ---
        A new event has been generated from a new source. Decide if this new event should be MERGED or ADDED AS NEW.

        New Event to evaluate:
        {json.dumps(new_event, indent=2)}
        ---

        Your Decision (Respond with one of the two JSON formats):

        Option 1: MERGE
        {{
          "decision": "MERGE",
          "target_event_title": "The exact title of the event to merge with",
          "updated_event_json": {{ ... the complete, merged and updated event object ... }}
        }}

        Option 2: ADD AS NEW
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

    # HELPER: Get all categories from the database
    def _get_all_subcategories(self) -> dict:
        """
        Returns a predefined, hardcoded dictionary of main and subcategories
        to ensure consistency across the entire timeline.
        """
        print("Loading predefined category structure...")
        
        predefined_categories = {
            "Creative Works": ["Music", "Film & TV", "Publications & Art", "Awards & Honors"],
            "Live & Broadcast": ["Concerts & Tours", "Fan Events", "Broadcast Appearances"],
            "Public Relations": ["Media Interviews", "Endorsements & Ambassadors", "Social & Digital"],
            "Personal Milestones": ["Relationships & Family", "Health & Service", "Education & Growth"],
            "Incidents & Controversies": ["Legal & Scandal", "Accidents & Emergencies", "Public Backlash"]
        }
        
        print(f"Loaded {len(predefined_categories)} main categories.")
        return predefined_categories

    # HELPER: Fetch articles for a given category
    def _fetch_raw_entries_for_subcategory(self, subcategory_name: str) -> list:
        from google.cloud.firestore_v1.base_query import FieldFilter
        articles_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries')
        query = articles_ref.where(filter=FieldFilter('subcategory', '==', subcategory_name)).order_by("primary_event_date", direction="ASCENDING")
        docs = query.stream()
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
    
    def _add_event_years(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates and adds the 'event_years' field to an event object.
        It extracts all unique years from the timeline_points dates.
        """
        years = set()
        for point in event.get('timeline_points', []):
            date_str = point.get('date', '')
            if date_str and isinstance(date_str, str) and '-' in date_str:
                try:
                    # Extracts the year part from 'YYYY-MM-DD'
                    year = int(date_str.split('-')[0])
                    years.add(year)
                except (ValueError, IndexError):
                    print(f"    Warning: Could not parse year from date '{date_str}' in event '{event.get('event_title', 'Untitled')}'.")
        
        # Add the new field, sorted from newest to oldest
        event['event_years'] = sorted(list(years), reverse=True)
        return event
    
    # MAIN MIGRATION LOGIC
    async def run_initial_migration(self):
        print("--- Starting Enhanced Timeline Migration ---")
        all_categories = self._get_all_subcategories()

        # PHASE 1: EXTRACT ALL EVENTS INTO A STAGING AREA
        print("\n--- Phase 1: Extracting all events from all articles ---")
        staged_events = []
        processed_source_ids = set()
        all_subcategories = [sub for subs in all_categories.values() for sub in subs]
        
        for sub_cat in all_subcategories:
            print(f"  -> Fetching entries for subcategory: [{sub_cat}]")
            raw_entries = self._fetch_raw_entries_for_subcategory(sub_cat)
            for entry in raw_entries:
                generated_event = await self._generate_initial_event(entry)
                if generated_event:
                    staged_events.append(generated_event)
                    processed_source_ids.add(entry['sourceId'])
        
        print(f"\n--- Phase 1 Complete: Extracted {len(staged_events)} potential events. ---")

        # PHASE 2: RE-CATEGORIZE EACH EVENT
        print("\n--- Phase 2: Re-categorizing each event based on its content ---")
        recategorized_timeline = defaultdict(lambda: defaultdict(list))
        for i, event in enumerate(staged_events):
            print(f"  -> Re-categorizing event {i + 1}/{len(staged_events)}: '{event.get('event_title', 'Untitled')}'")
            main_cat, sub_cat = await self._recategorize_event(event, all_categories)
            
            if main_cat and sub_cat:
                recategorized_timeline[main_cat][sub_cat].append(event)
                print(f"    -> Classified into: [{main_cat}] > [{sub_cat}]")
            else:
                print(f"    -> SKIPPED due to categorization failure.")
                
        print("\n--- Phase 2 Complete: All events have been re-categorized. ---")

        # PHASE 3: CURATE AND MERGE WITHIN CORRECTED CATEGORIES
        print("\n--- Phase 3: Curating timelines within their new, correct categories ---")
        final_timeline = defaultdict(dict)

        for main_cat, sub_cat_data in recategorized_timeline.items():
            for sub_cat, events_to_process in sub_cat_data.items():
                print(f"\n--- Curating: [{main_cat}] > [{sub_cat}] ({len(events_to_process)} events) ---")
                
                curated_events_for_subcategory = []
                for i, new_event in enumerate(events_to_process):
                    print(f"  -> Processing event {i + 1}/{len(events_to_process)}: '{new_event.get('event_title')}'")
                    
                    if not curated_events_for_subcategory:
                        curated_events_for_subcategory.append(new_event)
                        print(f"    Action: CREATED first event '{new_event.get('event_title')}'")
                        continue
                    
                    ai_decision = await self._call_curation_api(sub_cat, curated_events_for_subcategory, new_event)
                    
                    if not ai_decision:
                        print("    Action: Curation AI failed. Adding event as new.")
                        curated_events_for_subcategory.append(new_event)
                        continue

                    decision_type = ai_decision.get("decision")
                    if decision_type == "MERGE":
                        target_title = ai_decision.get("target_event_title")
                        updated_event = ai_decision.get("updated_event_json")
                        if target_title and updated_event:
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
                            curated_events_for_subcategory.append(new_event)
                            print("    Action: MERGE decision received, but data was incomplete. Added event as new.")
                    
                    elif decision_type == "ADD_AS_NEW":
                        curated_events_for_subcategory.append(new_event)
                        print(f"    Action: ADDED AS NEW event '{new_event.get('event_title')}'")
                    else:
                        curated_events_for_subcategory.append(new_event)
                        print(f"    Action: Decision unclear. Added event as new.")
                
                final_timeline[main_cat][sub_cat] = curated_events_for_subcategory
                
        # PHASE 4: Enriching final data with event_years ---        
        print("\n--- Phase 4: Enriching events with calculated year data ---")
        for main_cat, sub_cat_data in final_timeline.items():
            for sub_cat, events in sub_cat_data.items():
                # Apply the year calculation to each event
                final_timeline[main_cat][sub_cat] = [self._add_event_years(event) for event in events]
        print("--- Phase 4 Complete. All events enriched. ---")
        
        # PHASE 5: Mark all processed articles in Firestore --- <--- ADD THIS NEW SECTION
        print("\n--- Phase 5: Marking processed articles in Firestore ---")
        if not processed_source_ids:
            print("No source IDs were processed, skipping update.")
        else:
            articles_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries')
            for source_id in processed_source_ids:
                article_ref = articles_ref.document(source_id)
                article_ref.update({"is_processed_for_timeline": True})
            print(f"--- Phase 5 Complete. Marked {len(processed_source_ids)} articles as processed. ---")
        

        print("\n--- Migration processing complete. Saving to Firestore... ---")
        timeline_collection_ref = self.db.collection('selected-figures').document(self.figure_id).collection(CURATED_TIMELINE_COLLECTION)
        
        print("Clearing old timeline data...")
        for doc in timeline_collection_ref.stream():
            doc.reference.delete()
        print("Old data cleared.")
            
        for main_cat, sub_cat_data in final_timeline.items():
            timeline_collection_ref.document(main_cat).set(sub_cat_data)
        print(f"Successfully saved data for {len(final_timeline)} main categories.")


async def main():
    engine = CurationEngine(figure_id=TARGET_FIGURE_ID)
    await engine.run_initial_migration()

if __name__ == "__main__":
    asyncio.run(main())