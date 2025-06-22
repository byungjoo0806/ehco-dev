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
        Fetches overviews for all documents in the 'wiki-content' subcollection, 
        generates a compact version using an AI model, and updates the Firestore documents.

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
                    # Get a stream for all documents in the 'wiki-content' subcollection
                    wiki_content_ref = figures_ref.document(figure_id).collection('wiki-content')
                    wiki_content_stream = wiki_content_ref.stream()

                    for content_doc in wiki_content_stream:
                        doc_id = content_doc.id
                        print(f"\n  -- Processing document: {doc_id} --")
                        
                        try:
                            # Extract the content from the document
                            data = content_doc.to_dict()
                            content = data.get('content')
                            is_compacted = data.get('is_compacted', False)

                            if is_compacted:
                                print(f"    - Document '{doc_id}' has already been compacted. Skipping.")
                                continue

                            if content and isinstance(content, str) and len(content.split()) > 50: # Only process longer content
                                print(f"    - Original content found. Length: {len(content)} characters.")

                                # Create a prompt for the AI model
                                prompt = f"Summarize the following text into a concise overview of 2-3 sentences:\n\n{content}"

                                # Call the DeepSeek API to get the compacted overview
                                chat_completion = await self.manager.client.chat.completions.create(
                                    model=self.manager.model,
                                    messages=[{"role": "user", "content": prompt}],
                                )
                                compacted_content = chat_completion.choices[0].message.content
                                
                                print(f"    - Compacted content generated. Length: {len(compacted_content)} characters.")

                                # Get a reference to the specific document to update it
                                doc_ref_to_update = wiki_content_ref.document(doc_id)
                                
                                # Update the document in Firestore with the compacted content
                                doc_ref_to_update.update({
                                    'content': compacted_content,
                                    'original_content': content, # Back up the original content
                                    'is_compacted': True # Add a flag
                                })
                                print(f"    - Successfully updated document '{doc_id}' for {figure_id}.")

                            elif content:
                                print(f"    - Content in '{doc_id}' is already short, skipping.")
                            else:
                                print(f"    - 'content' field is empty or missing in '{doc_id}'. Skipping.")
                        
                        except Exception as e:
                            print(f"    - An error occurred while processing document '{doc_id}': {e}")


                except Exception as e:
                    print(f"  - An error occurred while processing subcollection for {figure_id}: {e}")

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
    parser = argparse.ArgumentParser(description="Compact content in all 'wiki-content' documents in Firestore.")
    parser.add_argument("--figure", type=str, help="The ID of a single figure to process for testing.")
    args = parser.parse_args()
    
    compactor = CompactOverview()
    await compactor.compact_figure_overviews(figure_id_to_test=args.figure)

if __name__ == "__main__":
    # Run the asynchronous main function
    asyncio.run(main())