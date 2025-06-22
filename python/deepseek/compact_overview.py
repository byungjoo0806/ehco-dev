import asyncio
import argparse
from setup_firebase_deepseek import NewsManager

class CompactOverview:
    """
    A class to fetch, compact, and update figure overviews in Firestore.
    """
    def __init__(self):
        """
        Initializes the CompactOverview class by creating an instance of NewsManager.
        """
        self.manager = NewsManager()
        self.db = self.manager.db

    async def compact_figure_overviews(self, figure_id_to_test: str = None):
        """
        Fetches overviews, generates a compact version using an AI model,
        and updates the Firestore documents.

        Args:
            figure_id_to_test (str, optional): If provided, only this figure will be processed.
                                              Defaults to None.
        """
        print("Starting the process to compact figure overviews...")

        try:
            figures_ref = self.db.collection('selected-figures')

            if figure_id_to_test:
                print(f"--- RUNNING IN TEST MODE FOR FIGURE: {figure_id_to_test} ---")
                figure_doc_to_test = figures_ref.document(figure_id_to_test).get()
                if not figure_doc_to_test.exists:
                    print(f"Error: Test figure with ID '{figure_id_to_test}' not found.")
                    return
                figures_stream = [figure_doc_to_test]
            else:
                print("--- RUNNING IN FULL MIGRATION MODE ---")
                figures_stream = figures_ref.stream()


            for figure_doc in figures_stream:
                figure_id = figure_doc.id
                print(f"\n--- Processing Figure: {figure_id} ---")

                try:
                    # Path to the 'main-overview' document
                    overview_ref = figures_ref.document(figure_id).collection('wiki-content').document('main-overview')
                    overview_doc = overview_ref.get()

                    if overview_doc.exists:
                        # Extract the content from the document
                        data = overview_doc.to_dict()
                        content = data.get('content')
                        is_compacted = data.get('is_compacted', False)

                        if is_compacted:
                            print("  - Overview has already been compacted. Skipping.")
                            continue

                        if content and isinstance(content, str) and len(content.split()) > 50: # Only process longer overviews
                            print(f"  - Original overview found. Length: {len(content)} characters.")

                            # Create a prompt for the AI model
                            prompt = f"Summarize the following text into a concise overview of 2-3 sentences:\n\n{content}"

                            # Call the DeepSeek API to get the compacted overview
                            chat_completion = await self.manager.client.chat.completions.create(
                                model=self.manager.model,
                                messages=[{"role": "user", "content": prompt}],
                            )
                            compacted_content = chat_completion.choices[0].message.content
                            
                            print(f"  - Compacted overview generated. Length: {len(compacted_content)} characters.")

                            # Update the 'content' field in Firestore with the compacted overview
                            overview_ref.update({
                                'content': compacted_content,
                                'original_content': content, # Back up the original content
                                'is_compacted': True # Add a flag
                            })
                            print(f"  - Successfully updated the overview for {figure_id}.")

                        elif content:
                             print("  - Overview is already short, skipping.")
                        else:
                            print("  - 'content' field is empty or missing. Skipping.")
                    else:
                        print(f"  - 'main-overview' document not found for {figure_id}. Skipping.")

                except Exception as e:
                    print(f"  - An error occurred while processing {figure_id}: {e}")

            print("\n✅ All figure overviews have been processed.")

        except Exception as e:
            print(f"\n❌ An error occurred: {e}")
        finally:
            # Close any open connections
            await self.manager.close()


async def main():
    """
    Main function to parse arguments and run the compaction process.
    """
    parser = argparse.ArgumentParser(description="Compact figure overviews in Firestore.")
    parser.add_argument("--figure", type=str, help="The ID of a single figure to process for testing.")
    args = parser.parse_args()
    
    compactor = CompactOverview()
    await compactor.compact_figure_overviews(figure_id_to_test=args.figure)

if __name__ == "__main__":
    # Run the asynchronous main function
    asyncio.run(main())
