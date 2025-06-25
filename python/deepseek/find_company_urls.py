import asyncio
import argparse
import re # Import the regular expressions module
from setup_firebase_deepseek import NewsManager

class CompanyUrlFinder:
    """
    A class to find company URLs based on the company name in Firestore
    and update the document with the URL.
    """
    def __init__(self):
        """
        Initializes the CompanyUrlFinder class by creating an instance of NewsManager.
        """
        self.manager = NewsManager()
        self.db = self.manager.db

    async def find_and_update_urls(self, figure_id_to_test: str = None):
        """
        Fetches documents, finds company URLs using an AI model,
        and updates the Firestore documents with a 'companyUrl' field.

        Args:
            figure_id_to_test (str, optional): If provided, only this figure will be processed.
                                              Defaults to None.
        """
        print("Starting the process to find and update company URLs...")

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
                    data = figure_doc.to_dict()
                    company_name = data.get('company')
                    company_url = data.get('companyUrl')

                    if company_url:
                        print(f"  - 'companyUrl' already exists for {figure_id}. Skipping.")
                        continue

                    if not company_name:
                        print(f"  - 'company' field not found for {figure_id}. Skipping.")
                        continue
                    
                    print(f"  - Found company: '{company_name}'. Searching for website.")

                    # Create a prompt for the AI model to get only the URL
                    prompt = f"What is the official website for the company '{company_name}'? Please provide only the URL and nothing else."

                    # Call the DeepSeek API
                    chat_completion = await self.manager.client.chat.completions.create(
                        model=self.manager.model,
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=100 # Increased max_tokens slightly to not cut off conversational text
                    )
                    raw_output = chat_completion.choices[0].message.content.strip()

                    # Use a regular expression to find the first URL in the model's output
                    url_match = re.search(r'https?://[^\s]+', raw_output)

                    if url_match:
                        found_url = url_match.group(0).strip(".,") # Get the matched URL and remove trailing punctuation
                        print(f"  - Extracted URL: {found_url}")
                        
                        # Update the document in Firestore
                        figure_doc.reference.update({'companyUrl': found_url})
                        print(f"  - Successfully updated {figure_id} with company URL.")
                    else:
                        print(f"  - Could not extract a valid URL for '{company_name}'. Received: '{raw_output}'")

                except Exception as e:
                    print(f"  - An error occurred while processing {figure_id}: {e}")

            print("\n✅ All figures have been processed.")

        except Exception as e:
            print(f"\n❌ An error occurred during the process: {e}")
        finally:
            # Close any open connections
            await self.manager.close()

async def main():
    """
    Main function to parse arguments and run the URL finding process.
    """
    parser = argparse.ArgumentParser(description="Find and update company URLs for figures in Firestore.")
    parser.add_argument("--figure", type=str, help="The ID of a single figure to process for testing.")
    args = parser.parse_args()

    finder = CompanyUrlFinder()
    await finder.find_and_update_urls(figure_id_to_test=args.figure)

if __name__ == "__main__":
    # Run the asynchronous main function
    asyncio.run(main())