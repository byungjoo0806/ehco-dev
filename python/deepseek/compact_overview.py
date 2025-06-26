import asyncio
import argparse
from setup_firebase_deepseek import NewsManager

class CompactOverview:
    """
    A class to fetch, compact, and update the overview for a specific figure in Firestore.
    """
    def __init__(self):
        """
        Initializes the CompactOverview class by creating an instance of NewsManager.
        """
        self.manager = NewsManager()
        self.db = self.manager.db

    async def compact_figure_overview(self, figure_id: str):
        """
        Fetches the overview for a single specified figure, generates a compact
        version using an AI model, and updates the Firestore document.

        Args:
            figure_id (str): The ID of the figure to process.
        """
        print(f"--- Starting process to compact overview for figure: {figure_id} ---")

        try:
            # Get a reference to the specific figure document
            figure_doc_ref = self.db.collection('selected-figures').document(figure_id)
            
            # Check if the figure exists
            if not figure_doc_ref.get().exists:
                print(f"\n❌ Error: Figure with ID '{figure_id}' not found.")
                return

            # Get a stream for all documents in the 'wiki-content' subcollection
            wiki_content_ref = figure_doc_ref.collection('wiki-content')
            wiki_content_stream = wiki_content_ref.stream()

            documents_processed = 0
            for content_doc in wiki_content_stream:
                doc_id = content_doc.id
                documents_processed += 1
                print(f"\n  -- Processing document: {doc_id} --")
                
                try:
                    # Extract the content from the document
                    data = content_doc.to_dict()
                    content = data.get('content')
                    is_compacted = data.get('is_compacted', False)

                    if is_compacted:
                        print(f"    - Document '{doc_id}' has already been compacted. Skipping.")
                        continue

                    # Only process content that is reasonably long
                    if content and isinstance(content, str) and len(content.split()) > 50:
                        print(f"    - Original content found. Length: {len(content)} characters.")

                        # Create a prompt for the AI model
                        prompt = f"Summarize the following text into a concise overview of 2-3 sentences:\n\n{content}"

                        # Call the AI API to get the compacted overview
                        chat_completion = await self.manager.client.chat.completions.create(
                            model=self.manager.model,
                            messages=[{"role": "user", "content": prompt}],
                        )
                        compacted_content = chat_completion.choices[0].message.content
                        
                        print(f"    - Compacted content generated. Length: {len(compacted_content)} characters.")

                        # Update the document in Firestore with the compacted content
                        content_doc.reference.update({
                            'content': compacted_content,
                            'original_content': content,  # Back up the original content
                            'is_compacted': True  # Add a flag
                        })
                        print(f"    - Successfully updated document '{doc_id}'.")

                    elif content:
                        print(f"    - Content in '{doc_id}' is already short, skipping compaction.")
                    else:
                        print(f"    - 'content' field is empty or missing in '{doc_id}'. Skipping.")
                
                except Exception as e:
                    print(f"    - An error occurred while processing document '{doc_id}': {e}")
            
            if documents_processed == 0:
                 print(f"\n- No 'wiki-content' documents found for figure '{figure_id}'.")

            print(f"\n✅ Process complete for figure: {figure_id}.")

        except Exception as e:
            print(f"\n❌ An unexpected error occurred: {e}")
        finally:
            # Close any open connections
            await self.manager.close()


async def main():
    """
    Main function to parse arguments and run the compaction process.
    """
    parser = argparse.ArgumentParser(description="Compacts the 'wiki-content' documents for a specific figure.")
    
    # Changed to a required positional argument to match the other scripts
    parser.add_argument(
        "figure_id", 
        type=str, 
        help="The required ID of the single figure to process."
    )
    
    args = parser.parse_args()
    
    compactor = CompactOverview()
    # Call the method with the new argument name
    await compactor.compact_figure_overview(figure_id=args.figure_id)

if __name__ == "__main__":
    # To run this script, provide the figure_id as a command-line argument.
    # Example:
    # python compact_overview.py your_figure_id
    asyncio.run(main())