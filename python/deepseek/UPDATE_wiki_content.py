# wiki_updater.py

from setup_firebase_deepseek import NewsManager
import asyncio
from firebase_admin import firestore
import argparse
import sys

class PublicFigureWikiUpdater:
    def __init__(self):
        self.news_manager = NewsManager()
        # The field to check for unprocessed summaries
        self.processing_flag_field = "is_processed_for_timeline"

    async def update_all_wiki_content(self, specific_figure_id=None):
        """
        Main function to find new article summaries and update existing wiki content.
        
        Args:
            specific_figure_id: If provided, only process this specific figure.
        """
        try:
            print("Starting public figure wiki content update process...")
            
            # Get all public figures or a specific one
            if specific_figure_id:
                # Check if the specific figure exists
                specific_doc = self.news_manager.db.collection("selected-figures").document(specific_figure_id).get()
                if not specific_doc.exists:
                    print(f"Error: Public figure with ID '{specific_figure_id}' not found.")
                    return False
                public_figures = [{"id": specific_figure_id, "name": specific_figure_id}]
            else:
                public_figures_ref = self.news_manager.db.collection("selected-figures").stream()
                public_figures = [{"id": doc.id, "name": doc.id} for doc in public_figures_ref]

            if not public_figures:
                print("No public figures found.")
                return False

            print(f"Found {len(public_figures)} public figure{'s' if len(public_figures) != 1 else ''} to check for updates.")
            
            total_updated_figures = 0
            for i, figure in enumerate(public_figures):
                figure_id = figure["id"]
                figure_name = figure["name"].replace("-", " ").title()
                
                print(f"\n[{i+1}/{len(public_figures)}] Checking '{figure_name}' for new content...")

                # Process updates for this single figure
                updated = await self.update_wiki_content_for_figure(figure_id, figure_name)
                if updated:
                    total_updated_figures += 1
            
            print(f"\nWiki content update process completed!")
            print(f"Successfully updated content for {total_updated_figures}/{len(public_figures)} public figures.")
            return total_updated_figures > 0

        except Exception as e:
            print(f"An error occurred in update_all_wiki_content: {e}")
            raise
        finally:
            await self.news_manager.close()

    async def update_wiki_content_for_figure(self, figure_id, figure_name):
        """
        Updates wiki content for a single public figure if new summaries are found.
        """
        try:
            # 1. Find new article summaries that haven't been processed yet
            summaries_ref = self.news_manager.db.collection("selected-figures").document(figure_id) \
                            .collection("article-summaries")
            
            new_summaries_query = summaries_ref.where(field_path=self.processing_flag_field, op_string='==', value=False)
            new_summary_docs = list(new_summaries_query.stream())

            if not new_summary_docs:
                print(f"No new article summaries found for '{figure_name}'. Skipping.")
                return False

            print(f"Found {len(new_summary_docs)} new summaries for '{figure_name}'. Processing updates...")

            # 2. Group new summaries by the wiki document they affect (main, category, subcategory)
            updates_to_process = {}
            for doc in new_summary_docs:
                summary_data = doc.to_dict()
                summary_text = summary_data.get("summary")
                if not summary_text:
                    continue

                main_category = summary_data.get("mainCategory")
                subcategory = summary_data.get("subcategory")

                # Add to main overview update list
                if "main-overview" not in updates_to_process:
                    updates_to_process["main-overview"] = []
                updates_to_process["main-overview"].append(summary_text)

                # Add to category update list
                if main_category:
                    cat_doc_id = main_category.lower().replace(' ', '-')
                    if cat_doc_id not in updates_to_process:
                        updates_to_process[cat_doc_id] = []
                    updates_to_process[cat_doc_id].append(summary_text)
                
                # Add to subcategory update list
                if main_category and subcategory:
                    subcat_doc_id = subcategory.lower().replace(' ', '-')
                    if subcat_doc_id not in updates_to_process:
                        updates_to_process[subcat_doc_id] = []
                    updates_to_process[subcat_doc_id].append(summary_text)

            # 3. For each wiki document that has new information, perform the update
            wiki_content_ref = summaries_ref.parent.collection("wiki-content")
            for doc_id, new_summaries in updates_to_process.items():
                
                wiki_doc_ref = wiki_content_ref.document(doc_id)
                existing_doc = wiki_doc_ref.get()

                if not existing_doc.exists:
                    print(f"  - Warning: Wiki document '{doc_id}' not found. Cannot update.")
                    continue

                existing_content = existing_doc.to_dict().get("content", "")
                
                # Call the LLM to get potentially updated content
                new_content = await self._get_updated_content_from_llm(figure_name, existing_content, new_summaries)

                # 4. Update Firestore only if the content has changed
                if new_content and new_content.strip() != existing_content.strip():
                    wiki_doc_ref.update({
                        "content": new_content,
                        "lastUpdated": firestore.SERVER_TIMESTAMP,
                        "is_compacted": False
                    })
                    print(f"  - Updated wiki document: '{doc_id}'")
                else:
                    print(f"  - No significant changes needed for wiki document: '{doc_id}'")

            # 5. Mark all new summaries as processed in a batch
            # batch = self.news_manager.db.batch()
            # for doc in new_summary_docs:
            #     batch.update(doc.reference, {self.processing_flag_field: True})
            # batch.commit()
            print(f"Successfully marked {len(new_summary_docs)} summaries as processed for '{figure_name}'.")

            return True

        except Exception as e:
            print(f"Error updating content for {figure_name}: {e}")
            return False

    async def _get_updated_content_from_llm(self, figure_name, existing_content, new_summaries):
        """
        Calls the LLM with a specific "editor" prompt to integrate new info.
        """
        summaries_str = "\n\n".join(f"- {s}" for s in new_summaries)

        prompt = f"""
You are a meticulous editor responsible for updating the biographical profile of {figure_name}. Your task is to integrate new information into the existing text while maintaining a neutral, encyclopedic tone.

**Existing Content:**
---
{existing_content}
---

**New Information from Recent Articles:**
---
{summaries_str}
---

**Instructions:**
1.  Carefully review the "New Information" and compare it to the "Existing Content".
2.  Seamlessly integrate any **significant new events, details, or nuances** from the new information into the existing text.
3.  **DO NOT** add information that is redundant, trivial, or already covered in spirit by the existing content. Your goal is to enhance, not just lengthen, the text.
4.  Maintain a consistent, neutral, and encyclopedic tone. Avoid phrases like "Recently, it was reported..." or "According to new articles...".
5.  If you determine that the new information is not significant enough to warrant a change, **return the "Existing Content" exactly as it is, with no modifications.**
6.  Ensure the final output is only the body of the text, without any titles, headings, or explanatory notes.

**Revised and Updated Content:**
"""

        try:
            response = await self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a skilled editor updating biographical content based on new source material."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5 # Lower temperature for more deterministic editing
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Error calling LLM for content update: {e}")
            return existing_content # On error, return original to prevent data loss

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Update existing wiki content for public figures based on new articles.",
        epilog="""
Examples:
  python wiki_updater.py                    # Check all public figures for updates
  python wiki_updater.py --figure john-doe  # Check only john-doe for updates
"""
    )
    parser.add_argument(
        '--figure', '-f',
        type=str,
        help='Update only the specified public figure (use the figure ID, e.g., "john-doe")',
        metavar='FIGURE_ID'
    )
    return parser.parse_args()

async def main():
    args = parse_arguments()
    
    if args.figure:
        print(f"\n=== Public Figure Wiki Content Updater Starting (Figure: {args.figure}) ===\n")
    else:
        print(f"\n=== Public Figure Wiki Content Updater Starting (All Figures) ===\n")

    updater = PublicFigureWikiUpdater()
    success = await updater.update_all_wiki_content(specific_figure_id=args.figure)

    if success:
        print("\n=== Wiki Content Update Process Finished Successfully ===\n")
    else:
        print("\n=== Wiki Content Update Process Finished (No new updates or failed) ===\n")

if __name__ == "__main__":
    asyncio.run(main())