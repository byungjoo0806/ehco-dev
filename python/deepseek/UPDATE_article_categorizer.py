from setup_firebase_deepseek import NewsManager
import asyncio
import json
import re
import argparse # Import argparse for command-line arguments
import firebase_admin
from firebase_admin import firestore


class PublicFigureSummaryCategorizer:
    def __init__(self):
        self.news_manager = NewsManager()
        self.categories = {
            "Creative Works": ["Music", "Film & TV", "Publications & Art", "Awards & Honors"],
            "Live & Broadcast": ["Concerts & Tours", "Fan Events", "Broadcast Appearances"],
            "Public Relations": ["Media Interviews", "Endorsements & Ambassadors", "Social & Digital"],
            "Personal Milestones": ["Relationships & Family", "Health & Service", "Education & Growth"],
            "Incidents & Controversies": ["Legal & Scandal", "Accidents & Emergencies", "Public Backlash"]
        }

    async def process_summaries(self, figure_id=None):
        """
        Main function to fetch unprocessed public figure summaries and categorize them.
        If a figure_id is provided, it only processes that figure. Otherwise, it processes all figures.
        It only processes summaries where 'is_processed_for_timeline' is False.
        """
        try:
            print("Starting public figure summary categorization process...")
            
            public_figures = []
            
            # UPDATED LOGIC: Check if a specific figure_id is provided
            if figure_id:
                print(f"Running for a specific public figure: {figure_id}")
                figure_doc = self.news_manager.db.collection("selected-figures").document(figure_id).get()
                if figure_doc.exists:
                    public_figures.append({"id": figure_doc.id, "name": figure_doc.id})
                else:
                    print(f"Error: Public figure with ID '{figure_id}' not found.")
                    return
            else:
                print("Running for all public figures.")
                public_figures_ref = self.news_manager.db.collection("selected-figures").stream()
                for doc in public_figures_ref:
                    public_figures.append({"id": doc.id, "name": doc.id})
            
            public_figure_count = len(public_figures)
            print(f"Found {public_figure_count} public figures to process.")
            
            if public_figure_count == 0:
                print("No public figures found to process.")
                return
            
            total_summaries_categorized = 0
            
            for i, public_figure in enumerate(public_figures):
                public_figure_id = public_figure["id"]
                public_figure_name = public_figure["name"].replace("-", " ").title()
                
                print(f"\nProcessing public figure {i+1}/{public_figure_count}: {public_figure_name} (ID: {public_figure_id})")
                
                # UPDATED QUERY: Fetch only documents where 'is_processed_for_timeline' is False.
                summaries_ref = self.news_manager.db.collection("selected-figures").document(public_figure_id) \
                                .collection("article-summaries").where("is_processed_for_timeline", "==", False).stream()
                
                summaries = []
                for summary_doc in summaries_ref:
                    summaries.append({"id": summary_doc.id, "data": summary_doc.to_dict()})
                
                summary_count = len(summaries)
                
                if summary_count == 0:
                    print(f"  No unprocessed summaries found for {public_figure_name}.")
                    continue
                
                print(f"  Found {summary_count} unprocessed summaries for {public_figure_name}.")
                
                for j, summary in enumerate(summaries):
                    summary_id = summary["id"]
                    summary_data = summary["data"]
                    
                    summary_text = summary_data.get("summary", "")
                    if not summary_text:
                        print(f"  Skipping summary {j+1}/{summary_count} (ID: {summary_id}) - No summary text found.")
                        continue
                    
                    print(f"  Categorizing summary {j+1}/{summary_count} (ID: {summary_id})")
                    
                    categories_result = await self.categorize_summary(
                        public_figure_name=public_figure_name,
                        summary_text=summary_text
                    )
                    
                    if not categories_result:
                        print(f"  Failed to categorize summary {summary_id}. It will be re-processed on the next run.")
                        continue
                    
                    # UPDATED UPDATE: Set 'is_processed_for_timeline' to True along with categories.
                    self.news_manager.db.collection("selected-figures").document(public_figure_id) \
                        .collection("article-summaries").document(summary_id).update({
                            "mainCategory": categories_result["category"],
                            "subcategory": categories_result["subcategory"],
                            # "is_processed_for_timeline": True
                        })
                    
                    print(f"  Successfully updated summary {summary_id} with categories and marked as processed.")
                    total_summaries_categorized += 1
            
            print(f"\nCategorization process completed! Categorized {total_summaries_categorized} new summaries.")
        
        except Exception as e:
            print(f"An error occurred during the process: {e}")
            raise
        finally:
            await self.news_manager.close()

    async def categorize_summary(self, public_figure_name, summary_text):
        """
        Categorize a single public figure summary using DeepSeek.
        """
        try:
            category_structure = ""
            for category, subcategories in self.categories.items():
                subcategories_str = " / ".join(subcategories)
                category_structure += f"**{category}** → {subcategories_str}\n"
            
            prompt = f"""
            Based on the following summary about {public_figure_name}, categorize it into exactly ONE main category and ONE corresponding subcategory.
            
            The available categories and subcategories are:
            {category_structure}
            
            Summary about {public_figure_name}:
            "{summary_text}"
            
            Instructions:
            1. Review the summary to understand what it says about {public_figure_name}
            2. Select the SINGLE most appropriate main category from: Creative Works, Live & Broadcast, Public Relations, Personal Milestones, Incidents & Controversies
            3. Select the SINGLE most appropriate subcategory that belongs to your selected main category
            4. Only select the category and subcategory that are most strongly evidenced in the summary
            5. Respond with a JSON object containing exactly one category and one subcategory
            
            Response format:
            {{
                "category": "MainCategory",
                "subcategory": "Subcategory"
            }}
            
            Where category must be ONE of ["Creative Works", "Live & Broadcast", "Public Relations", "Personal Milestones", "Incidents & Controversies"] and subcategory must be ONE that belongs to the selected category.
            """
            
            # FIXED: Added 'await' to the asynchronous API call.
            response = await self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that analyzes text and categorizes content accurately."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            
            result = response.choices[0].message.content.strip()
            
            json_match = re.search(r"\{.*\}", result, re.DOTALL)
            if json_match:
                result = json_match.group(0)
                
            if result.startswith("```json"):
                result = result[7:-3].strip()
            elif result.startswith("```"):
                result = result[3:-3].strip()
                
            categories_data = json.loads(result)
            
            if not isinstance(categories_data, dict) or "category" not in categories_data or "subcategory" not in categories_data:
                print("Error: Response from AI is not a valid JSON with required 'category' and 'subcategory' fields.")
                return None
            
            valid_categories = list(self.categories.keys())
            if categories_data["category"] not in valid_categories:
                print(f"Error: Invalid category '{categories_data['category']}' received from AI.")
                return None
            
            selected_category = categories_data["category"]
            valid_subcategories = self.categories[selected_category]
            if categories_data["subcategory"] not in valid_subcategories:
                print(f"Error: Subcategory '{categories_data['subcategory']}' does not belong to category '{selected_category}'.")
                return None
            
            return categories_data
        
        except Exception as e:
            print(f"Error categorizing summary for {public_figure_name}: {e}")
            print(f"Summary excerpt: {summary_text[:100]}...")
            return None


async def main():
    # UPDATED: Add argument parser to handle command-line options
    parser = argparse.ArgumentParser(description="Categorize unprocessed article summaries for public figures.")
    parser.add_argument("--figure_id", type=str, help="The document ID of a specific public figure to process.")
    args = parser.parse_args()

    print("\n=== Public Figure Summary Categorization (Update Script) Starting ===\n")
    categorizer = PublicFigureSummaryCategorizer()
    # Pass the figure_id from the arguments to the main processing function
    await categorizer.process_summaries(figure_id=args.figure_id)
    print("\n=== Public Figure Summary Categorization Complete ===\n")


if __name__ == "__main__":
    asyncio.run(main())
