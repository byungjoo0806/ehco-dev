import asyncio
from setup_firebase_deepseek import NewsManager  # Assuming this sets up your clients

# --- CONFIGURATION ---
TARGET_FIGURE_ID = "seventeen"  # <-- Change this to the figure you want to update
CURATED_TIMELINE_COLLECTION = "curated-timeline"

class DescriptionUpdater:
    def __init__(self, figure_id: str):
        self.figure_id = figure_id
        self.news_manager = NewsManager()
        self.db = self.news_manager.db
        self.ai_client = self.news_manager.client
        self.ai_model = self.news_manager.model
        self.timeline_ref = self.db.collection('selected-figures').document(figure_id).collection(CURATED_TIMELINE_COLLECTION)
        print(f"✓ DescriptionUpdater initialized for figure: {self.figure_id}")

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
        # If the text is already short, don't bother calling the AI.
        if len(text_to_summarize.split()) < 15:
            return text_to_summarize

        system_prompt = "You are an expert editor. Your sole job is to take the provided text and summarize it into a single, clear, and concise sentence."
        user_prompt = f"Please summarize the following text into one concise sentence:\n\n---\n{text_to_summarize}\n---"

        try:
            response = await self.ai_client.chat.completions.create(
                model=self.ai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            summary = response.choices[0].message.content
            return summary.strip()
        except Exception as e:
            print(f"    ! AI summarization failed: {e}. Returning original text.")
            return text_to_summarize

    async def run_update(self):
        """Main function to fetch, process, and update the descriptions."""
        all_events_data = self._fetch_timeline_events()

        if not all_events_data:
            print("! No timeline data found for this figure. Exiting.")
            return

        print("\n-> Starting description summarization process...")
        total_points = 0
        points_processed = 0

        # Loop through the entire data structure
        for main_cat_id, main_cat_data in all_events_data.items():
            for sub_cat_name, events in main_cat_data.items():
                for event in events:
                    if 'timeline_points' not in event:
                        continue
                    
                    total_points += len(event['timeline_points'])
                    
                    # Create a list of tasks for concurrent AI calls
                    tasks = []
                    for point in event['timeline_points']:
                        original_description = point.get("description", "")
                        tasks.append(self._summarize_description(original_description))
                    
                    # Run all summarizations for the current event concurrently
                    new_descriptions = await asyncio.gather(*tasks)
                    
                    # Update the descriptions in the event object
                    for i, point in enumerate(event['timeline_points']):
                        point['description'] = new_descriptions[i]
                        points_processed += 1
                        print(f"  Processed {points_processed}/{total_points} descriptions...")


        print("\n✓ All descriptions processed in memory.")
        print("-> Uploading updated data to Firestore...")

        # Write the updated data back to Firestore
        for main_cat_id, main_cat_data in all_events_data.items():
            self.timeline_ref.document(main_cat_id).set(main_cat_data)
        
        print(f"✓ Successfully updated {len(all_events_data)} documents in Firestore for figure '{self.figure_id}'.")


async def main():
    updater = DescriptionUpdater(figure_id=TARGET_FIGURE_ID)
    await updater.run_update()

if __name__ == "__main__":
    asyncio.run(main())