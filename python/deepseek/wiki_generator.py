from setup_firebase_deepseek import NewsManager
import asyncio
from firebase_admin import firestore
import argparse
import sys
import tiktoken


class PublicFigureWikiGenerator:
    def __init__(self):
        self.news_manager = NewsManager()
        self.categories = ["Creative Works","Live & Broadcast","Public Relations","Personal Milestones","Incidents & Controversies"]
        # Initialize tokenizer for counting tokens (using cl100k_base which is similar to most models)
        try:
            self.tokenizer = tiktoken.get_encoding("cl100k_base")
        except:
            # Fallback if tiktoken not available
            self.tokenizer = None
        
        # Token limits - leaving buffer for system message and response
        self.max_tokens = 60000  # Conservative limit
        self.max_summaries_per_batch = 50  # Fallback if token counting fails
    
    def count_tokens(self, text):
        """Count tokens in text. Returns approximate count if tiktoken not available."""
        if self.tokenizer:
            return len(self.tokenizer.encode(text))
        else:
            # Rough approximation: 1 token ≈ 4 characters for English text
            return len(text) // 4
    
    def batch_summaries_by_tokens(self, summaries, max_tokens_per_batch):
        """Split summaries into batches that fit within token limits."""
        batches = []
        current_batch = []
        current_tokens = 0
        
        # Base prompt tokens (estimated)
        base_prompt_tokens = 1000  # Rough estimate for the instruction part
        
        for summary in summaries:
            summary_text = f"- {summary['summary']}"
            summary_tokens = self.count_tokens(summary_text)
            
            # Check if adding this summary would exceed the limit
            if current_tokens + summary_tokens + base_prompt_tokens > max_tokens_per_batch and current_batch:
                # Start a new batch
                batches.append(current_batch)
                current_batch = [summary]
                current_tokens = summary_tokens
            else:
                # Add to current batch
                current_batch.append(summary)
                current_tokens += summary_tokens
            
            # Safety check: if a single summary is too large, truncate it
            if summary_tokens > max_tokens_per_batch - base_prompt_tokens:
                print(f"Warning: Summary too large ({summary_tokens} tokens), truncating...")
                # Truncate the summary to fit
                max_chars = (max_tokens_per_batch - base_prompt_tokens) * 4  # Rough char estimate
                summary['summary'] = summary['summary'][:max_chars] + "..."
        
        # Add the last batch if it has content
        if current_batch:
            batches.append(current_batch)
        
        return batches
    
    async def generate_all_wiki_content(self, specific_figure_id=None):
        """
        Main function to fetch all public figure summaries and generate wiki content.
        
        Args:
            specific_figure_id: If provided, only process this specific figure
        """
        try:
            print("Starting public figure wiki content generation process...")
            
            # Get all public figures or specific figure
            if specific_figure_id:
                # Check if the specific figure exists
                specific_doc = self.news_manager.db.collection("selected-figures").document(specific_figure_id).get()
                if not specific_doc.exists:
                    print(f"Error: Public figure with ID '{specific_figure_id}' not found")
                    return False
                
                public_figures = [{"id": specific_figure_id, "name": specific_figure_id}]
                print(f"Processing specific public figure: {specific_figure_id}")
            else:
                public_figures_ref = self.news_manager.db.collection("selected-figures").stream()
                public_figures = []
                
                for doc in public_figures_ref:
                    public_figures.append({"id": doc.id, "name": doc.id})
            
            public_figure_count = len(public_figures)
            print(f"Found {public_figure_count} public figure{'s' if public_figure_count != 1 else ''} to process")
            
            if public_figure_count == 0:
                print("No public figures found")
                return False
            
            # Process each public figure
            success_count = 0
            for i, public_figure in enumerate(public_figures):
                public_figure_id = public_figure["id"]
                public_figure_name = public_figure["name"].replace("-", " ").title()
                
                print(f"\nProcessing public figure {i+1}/{public_figure_count}: {public_figure_name} (ID: {public_figure_id})")
                
                # Generate wiki content for this public figure
                success = await self.generate_wiki_content_for_figure(public_figure_id, public_figure_name)
                if success:
                    success_count += 1
            
            print(f"\nWiki content generation completed!")
            print(f"Successfully processed {success_count}/{public_figure_count} public figures")
            return success_count > 0
        
        except Exception as e:
            print(f"Error in generate_all_wiki_content: {e}")
            raise
        finally:
            # Close the connection
            await self.news_manager.close()
    
    async def generate_wiki_content_for_figure(self, public_figure_id, public_figure_name):
        """
        Generate wiki content for a single public figure.
        
        Args:
            public_figure_id: ID of the public figure
            public_figure_name: Name of the public figure
        """
        try:
            # Get all article summaries for this public figure
            summaries_ref = self.news_manager.db.collection("selected-figures").document(public_figure_id) \
                            .collection("article-summaries").stream()
            
            # Organize summaries by category and subcategory
            categorized_summaries = {category: [] for category in self.categories}
            subcategorized_summaries = {}  # Will be populated with {category-subcategory: [summaries]}
            all_summaries = []  # For main overview
            
            for summary_doc in summaries_ref:
                summary_data = summary_doc.to_dict()
                if "mainCategory" in summary_data and "summary" in summary_data:
                    category = summary_data["mainCategory"]
                    subcategory = summary_data.get("subcategory", "Unknown")
                    
                    # Format summary entry
                    summary_entry = {
                        "summary": summary_data["summary"],
                        "subcategory": subcategory,
                        "date": summary_data.get("date", "Unknown"),
                        "id": summary_doc.id
                    }
                    
                    # Add to all summaries
                    all_summaries.append(summary_entry)
                    
                    # Add to category if valid
                    if category in self.categories:
                        categorized_summaries[category].append(summary_entry)
                        
                        # Add to subcategory
                        subcategory_key = f"{category}-{subcategory}"
                        if subcategory_key not in subcategorized_summaries:
                            subcategorized_summaries[subcategory_key] = []
                        subcategorized_summaries[subcategory_key].append(summary_entry)
            
            if not all_summaries:
                print(f"No article summaries found for {public_figure_name}")
                return False
            
            print(f"Found {len(all_summaries)} article summaries for {public_figure_name}")
            
            # Create wiki-content subcollection reference
            wiki_content_ref = self.news_manager.db.collection("selected-figures").document(public_figure_id) \
                              .collection("wiki-content")
            
            # Generate and store main overview (with batching)
            await self.generate_and_store_main_overview(
                public_figure_name, 
                all_summaries, 
                wiki_content_ref
            )
            
            # Generate and store category overviews (with batching)
            await self.generate_and_store_category_overviews(
                public_figure_name, 
                categorized_summaries, 
                wiki_content_ref
            )
            
            # Generate and store subcategory overviews (with batching)
            await self.generate_and_store_subcategory_overviews(
                public_figure_name, 
                subcategorized_summaries, 
                wiki_content_ref
            )
            
            print(f"Successfully generated and stored wiki content for {public_figure_name}")
            
            return True
            
        except Exception as e:
            print(f"Error generating wiki content for {public_figure_name}: {e}")
            return False
    
    async def generate_content_from_batches(self, public_figure_name, summaries, content_type, category=None, subcategory=None):
        """
        Generate content from summaries using batching to handle token limits.
        
        Args:
            public_figure_name: Name of the public figure
            summaries: List of summary entries
            content_type: Type of content ('main', 'category', 'subcategory')
            category: Category name (for category/subcategory content)
            subcategory: Subcategory name (for subcategory content)
        """
        if not summaries:
            return f"No information available for {public_figure_name} at this time."
        
        # Split summaries into batches
        batches = self.batch_summaries_by_tokens(summaries, self.max_tokens)
        print(f"Split {len(summaries)} summaries into {len(batches)} batches for {content_type} content")
        
        batch_results = []
        
        for i, batch in enumerate(batches):
            print(f"Processing batch {i+1}/{len(batches)} for {content_type} content...")
            
            # Extract summaries for this batch
            summary_texts = [s["summary"] for s in batch]
            summaries_str = "\n\n".join(f"- {summary}" for summary in summary_texts)
            
            # Generate prompt based on content type
            if content_type == "main":
                prompt = f"""
                I need you to create part of a comprehensive profile overview for {public_figure_name} based on the following article summaries.

                Article summaries about {public_figure_name}:
                {summaries_str}

                Instructions:
                1. Synthesize the key information from these summaries
                2. Focus on the most significant information that defines who {public_figure_name} is
                3. Write in a neutral, encyclopedic tone
                4. Keep this section between 150-250 words
                5. Do not include any headings, titles, or section markers
                6. Do not include phrases like "according to the summaries" or references to the source material
                7. Provide only the content without any formatting or labels
                8. This will be combined with other sections, so focus on unique aspects covered in these summaries

                Create a focused section about {public_figure_name}:
                """
            
            elif content_type == "category":
                subcategories = set(s["subcategory"] for s in batch)
                subcategories_str = ", ".join(sorted(subcategories))
                
                prompt = f"""
                I need you to create part of an overview of {public_figure_name}'s {category} based on the following article summaries.

                The summaries cover these subcategories: {subcategories_str}

                Article summaries about {public_figure_name}'s {category}:
                {summaries_str}

                Instructions:
                1. Synthesize the key information from these summaries into a cohesive narrative
                2. Focus on significant events, achievements, or developments
                3. Write in a neutral, encyclopedic tone
                4. Keep this section between 100-200 words
                5. Do not include any headings, titles, or section markers
                6. Do not include phrases like "according to the summaries" or references to the source material
                7. Provide only the content without any formatting or labels
                8. This will be combined with other sections, so focus on unique aspects covered in these summaries

                Create a focused section about {public_figure_name}'s {category}:
                """
            
            else:  # subcategory
                prompt = f"""
                I need you to create part of a focused overview of {public_figure_name}'s activities related to {subcategory} within their {category}.

                Article summaries about {public_figure_name}'s {category} (specifically {subcategory}):
                {summaries_str}

                Instructions:
                1. Create a detailed overview that synthesizes information about {public_figure_name}'s {subcategory} activities
                2. Focus specifically on the {subcategory} aspect of their {category}
                3. Write in a neutral, encyclopedic tone
                4. Keep this section between 80-150 words
                5. Do not include any headings, titles, or section markers
                6. Do not include phrases like "according to the summaries" or references to the source material
                7. Provide only the content without any formatting or labels
                8. This will be combined with other sections, so focus on unique aspects covered in these summaries

                Create a focused section about {public_figure_name}'s {subcategory} activities:
                """
            
            # Call DeepSeek API
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a skilled content writer who creates concise, informative overviews based on multiple sources."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7
            )
            
            # Extract the response
            batch_result = response.choices[0].message.content.strip()
            batch_results.append(batch_result)
        
        # If multiple batches, combine them with a final synthesis call
        if len(batch_results) > 1:
            print(f"Combining {len(batch_results)} batch results for {content_type} content...")
            
            combined_content = "\n\n".join(batch_results)
            
            # Final synthesis prompt
            if content_type == "main":
                synthesis_prompt = f"""
                I have multiple sections about {public_figure_name} that need to be combined into a single, cohesive profile overview.

                Content sections:
                {combined_content}

                Instructions:
                1. Combine these sections into a single, flowing narrative about {public_figure_name}
                2. Remove any redundancies and merge similar information
                3. Organize information logically to create a comprehensive profile
                4. Write in a neutral, encyclopedic tone
                5. Keep the final overview between 250-400 words
                6. Begin with a strong introductory sentence that summarizes who they are
                7. Do not include any headings, titles, or section markers
                8. Provide only the final combined content

                Create the final comprehensive profile overview for {public_figure_name}:
                """
            
            elif content_type == "category":
                synthesis_prompt = f"""
                I have multiple sections about {public_figure_name}'s {category} that need to be combined into a single, cohesive overview.

                Content sections:
                {combined_content}

                Instructions:
                1. Combine these sections into a single, flowing narrative about {public_figure_name}'s {category}
                2. Remove any redundancies and merge similar information
                3. Organize information logically, possibly chronologically where appropriate
                4. Write in a neutral, encyclopedic tone
                5. Keep the final overview between 150-300 words
                6. Do not include any headings, titles, or section markers
                7. Provide only the final combined content

                Create the final overview of {public_figure_name}'s {category}:
                """
            
            else:  # subcategory
                synthesis_prompt = f"""
                I have multiple sections about {public_figure_name}'s {subcategory} activities that need to be combined into a single, cohesive overview.

                Content sections:
                {combined_content}

                Instructions:
                1. Combine these sections into a single, flowing narrative about {public_figure_name}'s {subcategory} activities
                2. Remove any redundancies and merge similar information
                3. Organize information logically, possibly chronologically where appropriate
                4. Write in a neutral, encyclopedic tone
                5. Keep the final overview between 100-250 words
                6. Do not include any headings, titles, or section markers
                7. Provide only the final combined content

                Create the final overview of {public_figure_name}'s {subcategory} activities:
                """
            
            # Call DeepSeek API for synthesis
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a skilled editor who combines multiple content sections into cohesive narratives."},
                    {"role": "user", "content": synthesis_prompt}
                ],
                temperature=0.7
            )
            
            final_content = response.choices[0].message.content.strip()
            return final_content
        else:
            # Single batch, return as-is
            return batch_results[0]
    
    async def generate_and_store_main_overview(self, public_figure_name, all_summaries, wiki_content_ref):
        """
        Generate and store main overview for a public figure.
        """
        overview = await self.generate_content_from_batches(
            public_figure_name, 
            all_summaries, 
            "main"
        )
        
        # Extract article IDs used for the main overview
        article_ids = [s["id"] for s in all_summaries]
        
        # Store in Firestore
        wiki_content_ref.document("main-overview").set({
            "content": overview,
            "articleIds": article_ids,
            "lastUpdated": firestore.SERVER_TIMESTAMP
        })
        
        print(f"Generated main overview for {public_figure_name}")
    
    async def generate_and_store_category_overviews(self, public_figure_name, categorized_summaries, wiki_content_ref):
        """
        Generate and store category overviews for a public figure.
        """
        for category, summaries in categorized_summaries.items():
            # Skip categories with no summaries
            if not summaries:
                continue
            
            overview = await self.generate_content_from_batches(
                public_figure_name, 
                summaries, 
                "category",
                category=category
            )
            
            # Store in Firestore using simplified category name as the document ID
            category_doc_id = category.lower().replace(' ', '-')
            
            # Extract article IDs used for this category
            article_ids = [s["id"] for s in summaries]
            
            wiki_content_ref.document(category_doc_id).set({
                "content": overview,
                "category": category,
                "articleIds": article_ids,
                "lastUpdated": firestore.SERVER_TIMESTAMP
            })
            
            print(f"Generated category overview for {public_figure_name}'s {category}")
    
    async def generate_and_store_subcategory_overviews(self, public_figure_name, subcategorized_summaries, wiki_content_ref):
        """
        Generate and store subcategory overviews for a public figure.
        """
        for subcategory_key, summaries in subcategorized_summaries.items():
            if not summaries:
                continue
                
            # Parse category and subcategory from key
            category, subcategory = subcategory_key.split('-', 1)
            
            overview = await self.generate_content_from_batches(
                public_figure_name, 
                summaries, 
                "subcategory",
                category=category,
                subcategory=subcategory
            )
            
            # Store in Firestore using simplified subcategory naming
            subcategory_doc_id = subcategory.lower().replace(' ', '-')
            
            # Extract article IDs used for this subcategory
            article_ids = [s["id"] for s in summaries]
            
            wiki_content_ref.document(subcategory_doc_id).set({
                "content": overview,
                "category": category,
                "subcategory": subcategory,
                "articleIds": article_ids,
                "lastUpdated": firestore.SERVER_TIMESTAMP
            })
            
            print(f"Generated subcategory overview for {public_figure_name}'s {category} - {subcategory}")


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate wiki content for public figures",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python wiki_generator.py                    # Process all public figures
  python wiki_generator.py --figure john-doe # Process only john-doe
  python wiki_generator.py -f jane-smith     # Process only jane-smith
        """
    )
    
    parser.add_argument(
        '--figure', '-f',
        type=str,
        help='Process only the specified public figure (use the figure ID, e.g., "john-doe")',
        metavar='FIGURE_ID'
    )
    
    return parser.parse_args()


# Main function to run the wiki generator
async def main():
    # Parse command line arguments
    args = parse_arguments()
    
    if args.figure:
        print(f"\n=== Public Figure Wiki Content Generation Starting (Figure: {args.figure}) ===\n")
    else:
        print(f"\n=== Public Figure Wiki Content Generation Starting (All Figures) ===\n")
    
    generator = PublicFigureWikiGenerator()
    success = await generator.generate_all_wiki_content(specific_figure_id=args.figure)
    
    if success:
        print("\n=== Public Figure Wiki Content Generation Complete ===\n")
    else:
        print("\n=== Public Figure Wiki Content Generation Failed ===\n")
        sys.exit(1)


# Run the script
if __name__ == "__main__":
    asyncio.run(main())