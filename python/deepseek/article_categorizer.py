from setup_firebase_deepseek import NewsManager
import asyncio
import json
import re
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

    async def categorize_all_summaries(self):
        """
        Main function to fetch all public figure summaries and categorize each one individually.
        """
        try:
            print("Starting public figure summary categorization process...")
            
            # Get all public figures
            public_figures_ref = self.news_manager.db.collection("selected-figures").stream()
            public_figures = []
            
            for doc in public_figures_ref:
                public_figures.append({"id": doc.id, "name": doc.id})  # Using doc.id as name as per your structure
            
            public_figure_count = len(public_figures)
            print(f"Found {public_figure_count} public figures to process")
            
            if public_figure_count == 0:
                print("No public figures found")
                return
            
            # Process each public figure's summaries
            total_summaries_categorized = 0
            
            for i, public_figure in enumerate(public_figures):
                public_figure_id = public_figure["id"]
                public_figure_name = public_figure["name"].replace("-", " ").title()  # Convert ID to readable name
                
                print(f"\nProcessing public figure {i+1}/{public_figure_count}: {public_figure_name} (ID: {public_figure_id})")
                
                # Get all article summaries for this public figure
                summaries_ref = self.news_manager.db.collection("selected-figures").document(public_figure_id) \
                                .collection("article-summaries").stream()
                
                summaries = []
                for summary_doc in summaries_ref:
                    summaries.append({"id": summary_doc.id, "data": summary_doc.to_dict()})
                
                summary_count = len(summaries)
                print(f"  Found {summary_count} summaries for {public_figure_name}")
                
                if summary_count == 0:
                    print(f"  No summaries found for {public_figure_name}")
                    continue
                
                # Process each summary
                for j, summary in enumerate(summaries):
                    summary_id = summary["id"]
                    summary_data = summary["data"]
                    
                    # Skip if already categorized
                    if "mainCategory" in summary_data and "subcategory" in summary_data:
                        print(f"  Skipping summary {j+1}/{summary_count} (ID: {summary_id}) - Already categorized")
                        continue
                    
                    # Get the summary text
                    summary_text = summary_data.get("summary", "")
                    if not summary_text:
                        print(f"  Skipping summary {j+1}/{summary_count} (ID: {summary_id}) - No summary text")
                        continue
                    
                    print(f"  Categorizing summary {j+1}/{summary_count} (ID: {summary_id})")
                    
                    # Categorize this summary
                    categories_result = await self.categorize_summary(
                        public_figure_name=public_figure_name,
                        summary_text=summary_text
                    )
                    
                    if not categories_result:
                        print(f"  Failed to categorize summary {summary_id}")
                        continue
                    
                    # Update the summary document with categories
                    self.news_manager.db.collection("selected-figures").document(public_figure_id) \
                        .collection("article-summaries").document(summary_id).update({
                            "mainCategory": categories_result["category"],
                            "subcategory": categories_result["subcategory"]
                        })
                    
                    print(f"  Updated summary {summary_id} with mainCategory: {categories_result['category']} and subcategory: {categories_result['subcategory']}")
                    total_summaries_categorized += 1
            
            print(f"\nSummary categorization completed successfully! Categorized {total_summaries_categorized} summaries.")
        
        except Exception as e:
            print(f"Error in categorize_all_summaries: {e}")
            raise
        finally:
            # Close the connection
            await self.news_manager.close()

    async def categorize_summary(self, public_figure_name, summary_text):
        """
        Categorize a single public figure summary using DeepSeek.
        
        Args:
            public_figure_name: Name of the public figure
            summary_text: The summary text to categorize
            
        Returns:
            Dictionary with 'category' and 'subcategory' keys
        """
        try:
            # Define the categorization prompt
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
            
            # Call DeepSeek API
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that analyzes text and categorizes content accurately."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            
            # Extract the response
            result = response.choices[0].message.content.strip()
            
            # Try to find a JSON object in the response
            json_match = re.search(r"\{.*\}", result, re.DOTALL)
            if json_match:
                result = json_match.group(0)
                
            # Handle potential JSON formatting issues
            if result.startswith("```json"):
                result = result[7:-3].strip()
            elif result.startswith("```"):
                result = result[3:-3].strip()
                
            # Parse the JSON
            categories_data = json.loads(result)
            
            # Validate the response structure
            if not isinstance(categories_data, dict):
                print("Error: Response is not a dictionary")
                return None
                
            if "category" not in categories_data or "subcategory" not in categories_data:
                print("Error: Response missing required fields")
                return None
            
            # Validate that category is from the allowed list
            valid_categories = list(self.categories.keys())
            if categories_data["category"] not in valid_categories:
                print(f"Error: Invalid category '{categories_data['category']}'")
                return None
            
            # Validate that subcategory belongs to the selected category
            selected_category = categories_data["category"]
            valid_subcategories = self.categories[selected_category]
            if categories_data["subcategory"] not in valid_subcategories:
                print(f"Error: Subcategory '{categories_data['subcategory']}' does not belong to category '{selected_category}'")
                return None
            
            return categories_data
        
        except Exception as e:
            print(f"Error categorizing summary for {public_figure_name}: {e}")
            print(f"Summary excerpt: {summary_text[:100]}...")
            return None


# Main function to run the categorizer
async def main():
    print("\n=== Public Figure Summary Categorization Starting ===\n")
    categorizer = PublicFigureSummaryCategorizer()
    await categorizer.categorize_all_summaries()
    print("\n=== Public Figure Summary Categorization Complete ===\n")


# Run the script
if __name__ == "__main__":
    asyncio.run(main())