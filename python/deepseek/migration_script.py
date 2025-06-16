import asyncio
import json
from datetime import datetime
from google.cloud.firestore_v1.base_query import FieldFilter
from typing import List, Dict, Any

# Assuming 'setup_firebase_deepseek.py' is in the same directory
from setup_firebase_deepseek import NewsManager

# --- CONFIGURATION ---
# The document ID for the celebrity you want to migrate.
TARGET_FIGURE_ID = "iu(leejieun)" 
# The field in your 'articles' collection that contains the full text of the article.
# Adjust this if your field name is different (e.g., "content", "full_text").
ARTICLE_CONTENT_FIELD = "article_full_content" 


class MigrationAssistant:
    """
    Handles the data migration from a category-based summary to an event-based timeline
    using Deepseek for data generation and Firestore for storage.
    """
    def __init__(self, figure_id: str):
        if not figure_id:
            raise ValueError("A target figure ID must be provided.")
            
        self.figure_id = figure_id
        self.news_manager = NewsManager()
        self.db = self.news_manager.db
        self.ai_client = self.news_manager.client
        self.ai_model = self.news_manager.model
        print(f"✓ MigrationAssistant initialized for figure: {self.figure_id}")

    def _get_ai_prompt_messages(self, context_text: str, source_ids: List[str]) -> List[Dict[str, str]]:
        """Constructs the message payload for the Deepseek API call."""
        system_prompt = """
        You are an expert AI assistant specializing in data extraction and content organization. Your task is to identify and structure significant events from a block of text about a public figure. You must return the output in a clean JSON format as an array of event objects.
        """
        
        user_prompt = f"""
        I will provide you with a context block of text and a list of source article IDs. Your job is to identify all distinct events mentioned in the text and structure them into a JSON array of event objects.

        **Rules:**
        1.  **Identify Distinct Events:** An event is a specific, noteworthy occurrence, such as a concert, an award show appearance, a relationship confirmation, or a project release.
        2.  **Date Formatting:** The `eventDate` must be in `YYYY-MM-DD` format. If a month and year are given but no day, use the first day of that month (e.g., October 2015 -> 2015-10-01).
        3.  **Category Assignment:** The `category` field MUST be one of the following: "Concerts & Tours", "Fan Events", "Media Interviews", "Relationships & Family", "Education & Growth", "Career Milestones", "Philanthropy".
        4.  **Source Mapping:** In the `sourceArticleIds` array, include ONLY the IDs of the articles that are directly relevant to that specific event.
        5.  **Output Format:** The final output must be a single JSON array `[]` containing one or more event objects. If no events are found, return an empty array.

        **Context Text:**
        {context_text}

        **Source Article IDs:**
        {source_ids}
        """
        
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

    async def _fetch_wiki_content(self) -> List[Dict[str, Any]]:
        """Fetches all documents from the 'wiki-content' subcollection for the figure."""
        print(f"\nFetching 'wiki-content' for {self.figure_id}...")
        wiki_ref = self.db.collection('selected-figures').document(self.figure_id).collection('wiki-content')
        docs = await wiki_ref.get()
        if not docs:
            print("No 'wiki-content' documents found.")
            return []
        
        print(f"Found {len(docs)} subcategories to process.")
        return [{'id': doc.id, **doc.to_dict()} for doc in docs]

    async def _fetch_article_details(self, article_ids: List[str]) -> str:
        """
        Fetches article details from the 'article-summaries' subcollection and combines
        the figure-focused summary and the full body text for the best AI context.
        """
        if not article_ids:
            return ""
        
        # CORRECT PATH: Points to the 'article-summaries' subcollection for the specific figure.
        articles_ref = self.db.collection('selected-figures').document(self.figure_id).collection('article-summaries')
        
        all_content = []

        # We can fetch all specific documents directly.
        # This is efficient for a known list of IDs.
        doc_refs = [articles_ref.document(id) for id in article_ids]
        docs = await self.db.get_all(doc_refs)

        for doc in docs:
            if doc.exists:
                data = doc.to_dict()
                
                # Get both the summary and the body.
                figure_summary = data.get('summary', '')
                full_body = data.get('body', '')
                
                # Combine them into a single block for the AI.
                # This gives the AI maximum context.
                combined_text = f"Figure-focused Summary: {figure_summary}\n\nFull Article Text: {full_body}"
                all_content.append(combined_text)

        # Join the content from all articles with a clear separator.
        return "\n\n--- End of Article ---\n\n".join(all_content)

    async def _call_deepseek_api(self, context_text: str, source_ids: List[str]) -> List[Dict[str, Any]]:
        """Calls the Deepseek API to generate structured event data."""
        if not context_text.strip():
            print("Skipping AI call: context text is empty.")
            return []

        messages = self._get_ai_prompt_messages(context_text, source_ids)
        
        try:
            print("Calling Deepseek API to generate events...")
            response = self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=messages,
                response_format={"type": "json_object"} # Crucial for reliable JSON output
            )
            response_content = response.choices[0].message.content
            # The API often wraps the list in a root key like "events". We need to find the list.
            data = json.loads(response_content)
            
            # Find the actual list of events within the parsed JSON
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, list):
                        print(f"Successfully generated {len(value)} events.")
                        return value
            
            print("Warning: AI response was valid JSON but did not contain a list of events.")
            return []

        except Exception as e:
            print(f"Error calling Deepseek API or parsing JSON: {e}")
            return []

    async def _save_events_to_firestore(self, events: List[Dict[str, Any]]):
        """Saves the generated event documents to the new Firestore subcollection."""
        if not events:
            return
            
        print(f"Saving {len(events)} new event(s) to Firestore...")
        events_ref = self.db.collection('selected-figures').document(self.figure_id).collection('events')
        batch = self.db.batch()
        
        for event in events:
            try:
                # Convert date string to Firestore Timestamp for proper sorting
                event_date = datetime.strptime(event.get('eventDate', ''), '%Y-%m-%d')
                event['eventDate'] = event_date
                
                # Create a new document reference
                doc_ref = events_ref.document()
                batch.set(doc_ref, event)
            except (ValueError, TypeError) as e:
                print(f"Warning: Skipping event due to invalid date format or data: {event}. Error: {e}")
        
        await batch.commit()
        print("Successfully saved events.")

    async def run_migration(self):
        """Orchestrates the entire migration process for the figure."""
        print("--- Starting Data Migration ---")
        subcategories = await self._fetch_wiki_content()
        
        if not subcategories:
            print("--- Migration Finished: No data to process. ---")
            return

        for subcategory in subcategories:
            print(f"\nProcessing subcategory: '{subcategory['id']}'...")
            
            old_summary = subcategory.get('content', '')
            article_ids = subcategory.get('articleIds', [])
            
            if not article_ids:
                print("No article IDs found for this subcategory. Skipping.")
                continue

            article_texts = await self._fetch_article_details(article_ids)
            full_context = f"{old_summary}\n\n{article_texts}"
            
            generated_events = await self._call_deepseek_api(full_context, article_ids)
            
            if generated_events:
                await self._save_events_to_firestore(generated_events)
            else:
                print("No events were generated for this subcategory.")

        print("\n--- Migration Complete ---")

async def main():
    """Main function to run the migration."""
    assistant = None
    try:
        assistant = MigrationAssistant(figure_id=TARGET_FIGURE_ID)
        await assistant.run_migration()
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")
    finally:
        if assistant and hasattr(assistant.news_manager, 'close'):
            print("Closing connections...")
            await assistant.news_manager.close()
            print("Connections closed.")

if __name__ == "__main__":
    asyncio.run(main())