import asyncio
import json
from collections import defaultdict
from setup_firebase_deepseek import NewsManager # Assuming this is your setup file
from typing import Union, Optional, Dict, Any

# --- CONFIGURATION ---
TARGET_FIGURE_ID = "ateez" # Make sure this matches your figure ID
CURATED_TIMELINE_COLLECTION = "curated-timeline"

class CurationEngine:
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        self.news_manager = NewsManager()
        self.db = self.news_manager.db
        self.ai_client = self.news_manager.client
        self.ai_model = self.news_manager.model
        print(f"✓ CurationEngine initialized for figure: {self.figure_id}")

    # =================================================================================
    # ALL THE CORE AI HELPER FUNCTIONS FROM THE MIGRATION SCRIPT ARE REUSED HERE
    # These are copied directly from your initial_migration.py script as they are
    # essential and their logic does not need to change.
    # =================================================================================

    async def _recategorize_event(self, event_data: dict, all_categories: dict) -> Union[tuple[str, str], None]:
        # This function is identical to the one in your migration script.
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
        Your response must be a single JSON object with two keys: "main_category" and "subcategory".
        """
        try:
            response = await self.ai_client.chat.completions.create(model=self.ai_model, messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}], response_format={"type": "json_object"})
            result = json.loads(response.choices[0].message.content)
            main_cat, sub_cat = result.get("main_category"), result.get("subcategory")
            if main_cat and sub_cat and main_cat in all_categories and sub_cat in all_categories[main_cat]:
                return main_cat, sub_cat
            else:
                print(f"    Warning: AI returned an invalid category: {main_cat} / {sub_cat}. Skipping.")
                return None, None
        except Exception as e:
            print(f"    Error during event re-categorization: {e}")
            return None, None


    async def _generate_initial_event(self, raw_entry: dict) -> Union[dict, None]:
        """
        Takes a single raw entry and asks the AI to generate ONE structured event JSON.
        This logic is copied directly from the reliable initial_migration.py script.
        """
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
        Now, generate the complete JSON object for the event based on the content provided.
        """
        
        try:
            response = await self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                response_format={"type": "json_object"}
            )
            event_json = json.loads(response.choices[0].message.content)
            
            # Basic validation to ensure the returned JSON is a valid event
            if 'event_title' in event_json and 'timeline_points' in event_json:
                for point in event_json.get('timeline_points', []):
                    # Defensive check for malformed points
                    if isinstance(point, dict):
                        point.setdefault('sourceIds', [raw_entry['sourceId']])
                return event_json
            else:
                print(f"    Warning: AI response was not in the expected event format for {raw_entry['sourceId']}. Skipping.")
                return None

        except Exception as e:
            print(f"    Error during initial event generation for {raw_entry['sourceId']}: {e}")
            return None


    async def _call_curation_api(self, subcategory_name: str, existing_events: list, new_event: dict) -> Union[dict, None]:
        # This function is identical to the one in your migration script.
        system_prompt = "You are an Expert Timeline Editor..." # Keeping this brief, copy the full prompt from your original script
        user_prompt = f"""
        You are curating the timeline for the subcategory: "{subcategory_name}".
        Here are the existing curated events: {json.dumps(existing_events, indent=2)}
        ---
        A new event has been generated from a new source. Decide if this new event should be MERGED or ADDED AS NEW.
        New Event to evaluate: {json.dumps(new_event, indent=2)}
        ---
        Your Decision (Respond with one of the two JSON formats):
        Option 1: MERGE {{ "decision": "MERGE", "target_event_title": "...", "updated_event_json": {{...}} }}
        Option 2: ADD AS NEW {{ "decision": "ADD_AS_NEW" }}
        """
        try:
            response = await self.ai_client.chat.completions.create(model=self.ai_model, messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}], response_format={"type": "json_object"})
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"    Error during curation API call: {e}")
            return None

    def _get_all_subcategories(self) -> dict:
        # This uses your preferred hardcoded category list.
        print("Loading predefined category structure...")
        predefined_categories = {
            "Creative Works": ["Music", "Film & TV", "Publications & Art", "Awards & Honors"],
            "Live & Broadcast": ["Concerts & Tours", "Fan Events", "Broadcast Appearances"],
            "Public Relations": ["Media Interviews", "Endorsements & Ambassadors", "Social & Digital"],
            "Personal Milestones": ["Relationships & Family", "Health & Service", "Education & Growth"],
            "Incidents & Controversies": ["Legal & Scandal", "Accidents & Emergencies", "Public Backlash"]
        }
        return predefined_categories

    def _add_event_years(self, event: Dict[str, Any]) -> Dict[str, Any]:
        # This function is identical to the one in your migration script.
        years = set()
        for point in event.get('timeline_points', []):
            date_str = point.get('date', '')
            if date_str and isinstance(date_str, str) and '-' in date_str:
                try:
                    years.add(int(date_str.split('-')[0]))
                except (ValueError, IndexError):
                    pass
        event['event_years'] = sorted(list(years), reverse=True)
        return event

    # =================================================================================
    # NEW FUNCTIONS FOR THE INCREMENTAL UPDATE PROCESS
    # =================================================================================

    def _fetch_unprocessed_articles(self) -> list:
        """Fetches all articles that have not yet been processed for the timeline."""
        print("Fetching unprocessed articles...")
        from google.cloud.firestore_v1.base_query import FieldFilter
        
        articles_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries')
        # Query for documents where our tracking flag is 'false'
        query = articles_ref.where(filter=FieldFilter('is_processed_for_timeline', '==', False))
        docs = query.stream()
        
        raw_entries = []
        for doc in docs:
            data = doc.to_dict()
            content = f"Summary: {data.get('summary', '')}\n\nBody: {data.get('body', '')}"
            raw_entries.append({
                "sourceId": doc.id,
                "content": content
            })
        print(f"Found {len(raw_entries)} new articles to process.")
        return raw_entries

    # In UPDATE_timeline.py, REPLACE the entire run_incremental_update function with this

    async def run_incremental_update(self):
        """
        REVERTED: Fetches unprocessed articles, generates ONE event from each,
        and intelligently merges it into the existing curated timeline.
        """
        print(f"--- Starting Incremental Timeline Update for {self.figure_id} ---")
        
        all_categories = self._get_all_subcategories()
        new_articles = self._fetch_unprocessed_articles()

        if not new_articles:
            print("No new articles to process. Update complete.")
            return

        for article in new_articles:
            print(f"\nProcessing article with sourceId: {article['sourceId']}")
            
            # 1. Generate a SINGLE event from the article using the trusted function.
            new_event = await self._generate_initial_event(article)
            
            # If no event could be generated, mark as processed and skip to the next article.
            if not new_event:
                article_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries').document(article['sourceId'])
                article_ref.update({"is_processed_for_timeline": True})
                continue
            
            print(f"  -> Generated event: '{new_event.get('event_title')}'")

            # 2. Re-categorize the new event to find its correct home
            main_cat, sub_cat = await self._recategorize_event(new_event, all_categories)
            if not main_cat or not sub_cat:
                print(f"    -> Failed to classify event. Skipping article.")
                article_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries').document(article['sourceId'])
                article_ref.update({"is_processed_for_timeline": True})
                continue
            print(f"    -> Classified into: [{main_cat}] > [{sub_cat}]")

            # 3. Fetch EXISTING curated events for the target subcategory
            timeline_doc_ref = self.db.collection('selected-figures').document(self.figure_id).collection(CURATED_TIMELINE_COLLECTION).document(main_cat)
            timeline_doc = timeline_doc_ref.get()
            
            existing_main_category_data = timeline_doc.to_dict() or {}
            curated_events_for_subcategory = existing_main_category_data.get(sub_cat, [])

            # 4. Use the Curation AI to decide what to do
            if not curated_events_for_subcategory:
                ai_decision = {"decision": "ADD_AS_NEW"}
                print("      Action: No existing events in this subcategory. Creating first event.")
            else:
                ai_decision = await self._call_curation_api(sub_cat, curated_events_for_subcategory, new_event)
            
            if not ai_decision:
                print("      Action: Curation AI failed. Adding event as new by default.")
                ai_decision = {"decision": "ADD_AS_NEW"}

            # 5. Apply the AI's decision
            decision_type = ai_decision.get("decision")
            if decision_type == "MERGE":
                target_title = ai_decision.get("target_event_title")
                updated_event = ai_decision.get("updated_event_json")
                if target_title and updated_event:
                    found = False
                    for idx, event in enumerate(curated_events_for_subcategory):
                        if event.get("event_title") == target_title:
                            curated_events_for_subcategory[idx] = self._add_event_years(updated_event)
                            found = True
                            print(f"      Action: MERGED into '{target_title}'")
                            break
                    if not found:
                        curated_events_for_subcategory.append(self._add_event_years(updated_event))
                        print(f"      Action: MERGE failed (target not found). Added merged event as new.")
                else:
                    curated_events_for_subcategory.append(self._add_event_years(new_event))
                    print("      Action: MERGE decision received, but data was incomplete. Added event as new.")
            
            elif decision_type == "ADD_AS_NEW":
                curated_events_for_subcategory.append(self._add_event_years(new_event))
                print(f"      Action: ADDED AS NEW event.")
            else:
                curated_events_for_subcategory.append(self._add_event_years(new_event))
                print(f"      Action: Decision unclear ('{decision_type}'). Added event as new by default.")
            
            # 6. Save the updated subcategory data back to Firestore
            existing_main_category_data[sub_cat] = curated_events_for_subcategory
            timeline_doc_ref.set(existing_main_category_data, merge=True)
            print(f"    -> Successfully updated timeline for [{main_cat}] > [{sub_cat}]")

            # 7. CRITICAL: Mark the article as processed
            article_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries').document(article['sourceId'])
            article_ref.update({"is_processed_for_timeline": True})
            print(f"  -> Finished processing article {article['sourceId']} and marked as processed.")

        print("\n--- Incremental Update Complete ---")

async def main():
    engine = CurationEngine(figure_id=TARGET_FIGURE_ID)
    await engine.run_incremental_update()

if __name__ == "__main__":
    # To run this script, save it as `update_timeline.py` and execute from your terminal
    asyncio.run(main())