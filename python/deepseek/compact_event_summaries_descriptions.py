import asyncio
import argparse  # Added import
from setup_firebase_deepseek import NewsManager  # Assuming this sets up your clients

# --- CONFIGURATION ---
# TARGET_FIGURE_ID = "newjeans"  # This is now a command-line argument
CURATED_TIMELINE_COLLECTION = "curated-timeline"

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
        total_events = sum(len(sub_cat_data.get(sub_cat_name, [])) for main_cat_id, sub_cat_data in all_events_data.items() for sub_cat_name in sub_cat_data)
        events_processed = 0

        for main_cat_id, main_cat_data in all_events_data.items():
            for sub_cat_name, events in main_cat_data.items():
                if not isinstance(events, list): continue # Skip if data is not a list of events

                for event in events:
                    events_processed += 1
                    print(f"  Processing event {events_processed}/{total_events}: '{event.get('event_title')}'...")
                    
                    tasks = []
                    # Create tasks for all descriptions AND for the event summary.
                    if 'timeline_points' in event:
                        for point in event['timeline_points']:
                            tasks.append(self._summarize_description(point.get("description", "")))
                    
                    tasks.append(self._summarize_event_summary(event.get("event_summary", "")))

                    if not tasks:
                        continue
                    
                    # Run all AI calls for the current event concurrently
                    results = await asyncio.gather(*tasks)
                    
                    # Distribute the results back to the correct fields.
                    num_points = len(event.get('timeline_points', []))
                    new_descriptions = results[:num_points]
                    new_summary = results[num_points] # The summary is the last task we added

                    # Update the event object in memory
                    event['event_summary'] = new_summary
                    if 'timeline_points' in event:
                        for i, point in enumerate(event['timeline_points']):
                            point['description'] = new_descriptions[i]

        print("\n✓ All descriptions and summaries processed in memory.")
        print("-> Uploading updated data to Firestore...")

        batch = self.db.batch()
        for main_cat_id, main_cat_data in all_events_data.items():
            doc_ref = self.timeline_ref.document(main_cat_id)
            batch.set(doc_ref, main_cat_data)
        
        batch.commit()
        
        print(f"✓ Successfully updated {len(all_events_data)} documents in Firestore for figure '{self.figure_id}'.")


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