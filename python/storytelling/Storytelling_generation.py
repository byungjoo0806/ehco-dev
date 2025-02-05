import asyncio
from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict

class ContentGenerationManager:
    def __init__(self, news_manager, celebrity_name: Optional[str] = None):
        self.news_manager = news_manager
        self.collection_name = "generated_content"
        self.celebrity_name = celebrity_name

    def create_overall_prompt(self, all_articles: List[Dict]) -> str:
        """Create a prompt for generating overall summary across all articles"""
        celebrity_context = f"with a focus on {self.celebrity_name}'s involvement and impact" if self.celebrity_name else ""
        
        prompt = f"""You are a professional wiki content writer. Analyze ALL the provided articles and generate a comprehensive overview that synthesizes the main themes, developments, and significance across all content {celebrity_context}. Include source citations in the format [Source URL] (YYYY.MM.DD).

Please generate your response in the following structure:

<overall_overview>
Write a comprehensive overview (3-4 paragraphs) that:
- Identifies the main themes and developments across all content{' related to ' + self.celebrity_name if self.celebrity_name else ''}
- Highlights key patterns or trends{' involving ' + self.celebrity_name if self.celebrity_name else ''}
- Summarizes the broader significance or impact{' of ' + self.celebrity_name + "'s involvement" if self.celebrity_name else ''}
</overall_overview>

<key_findings>
List 5-7 major findings or conclusions{' about ' + self.celebrity_name if self.celebrity_name else ''} drawn from analyzing all content.
</key_findings>

Remember to:
1. Maintain neutral, objective tone
2. Include source citations for key facts
3. Note any significant conflicting information
4. {f'Focus specifically on content involving or relating to {self.celebrity_name}' if self.celebrity_name else 'Focus on synthesizing information across all sources'}
5. If mentioned information involves others, explain their connection to {self.celebrity_name if self.celebrity_name else 'the main subject'}

Here are all the articles to analyze:
"""
        for article in all_articles:
            prompt += f"\nURL: {article.get('url')}"
            prompt += f"\nDate: {article.get('formatted_date')}"
            prompt += f"\nSubcategory: {article.get('subcategory', 'general')}"
            prompt += f"\nContent: {article.get('content')}\n"

        return prompt

    def create_subcategory_prompt(self, subcategory: str, articles: List[Dict]) -> str:
        """Create a prompt for detailed analysis of a specific subcategory"""
        celebrity_context = f"with a focus on {self.celebrity_name}'s involvement" if self.celebrity_name else ""
        
        prompt = f"""You are a professional wiki content writer. Analyze the provided articles for the subcategory "{subcategory}" {celebrity_context} and generate detailed, chronological content. Include source citations in the format [Source URL] (YYYY.MM.DD).

Please generate your response in the following structure:

<subcategory_overview>
Write a focused overview (2-3 paragraphs) specific to {f"{self.celebrity_name}'s involvement in" if self.celebrity_name else ''} this subcategory's developments and significance.
</subcategory_overview>

<chronological_developments>
Present a detailed, chronological analysis of all major developments, events, or changes within this subcategory{f' involving {self.celebrity_name}' if self.celebrity_name else ''}.
Organize by date and include specific details with source citations.
</chronological_developments>

<key_implications>
Analyze the implications or impact of these developments{f' on {self.celebrity_name} and their career/public image' if self.celebrity_name else ''}.
</key_implications>

Remember to:
1. Maintain neutral, objective tone
2. Include source citations for EVERY fact
3. Note any conflicting information
4. {f'Focus specifically on {self.celebrity_name} involvement in this subcategory' if self.celebrity_name else 'Focus specifically on content relevant to this subcategory'}
5. If other individuals are mentioned, explain their relationship to {self.celebrity_name if self.celebrity_name else 'the main subject'}

Here are the articles to analyze:
"""
        for article in articles:
            prompt += f"\nURL: {article.get('url')}"
            prompt += f"\nDate: {article.get('formatted_date')}"
            prompt += f"\nContent: {article.get('content')}\n"

        return prompt

    async def process_overall_summary(self, all_articles: List[Dict]) -> Dict:
        """Generate overall summary across all articles"""
        prompt = self.create_overall_prompt(all_articles)

        try:
            response = self.news_manager.client.messages.create(
                model=self.news_manager.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text if isinstance(response.content, list) else response.content

            def extract_section(content, tag):
                import re
                pattern = f"<{tag}>(.*?)</{tag}>"
                match = re.search(pattern, content, re.DOTALL)
                return match.group(1).strip() if match else ""

            return {
                "overall_overview": extract_section(content, "overall_overview"),
                "key_findings": extract_section(content, "key_findings"),
                "raw_content": content,
                "generation_date": datetime.now().isoformat(),
                "celebrity_focus": self.celebrity_name
            }
        except Exception as e:
            print(f"Error processing overall summary: {e}")
            return None

    async def process_subcategory(self, subcategory: str, articles: List[Dict]) -> Dict:
        """Process articles for a specific subcategory"""
        prompt = self.create_subcategory_prompt(subcategory, articles)

        try:
            response = self.news_manager.client.messages.create(
                model=self.news_manager.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text if isinstance(response.content, list) else response.content

            def extract_section(content, tag):
                import re
                pattern = f"<{tag}>(.*?)</{tag}>"
                match = re.search(pattern, content, re.DOTALL)
                return match.group(1).strip() if match else ""

            return {
                "subcategory": subcategory,
                "subcategory_overview": extract_section(content, "subcategory_overview"),
                "chronological_developments": extract_section(content, "chronological_developments"),
                "key_implications": extract_section(content, "key_implications"),
                "raw_content": content,
                "source_articles": [article["url"] for article in articles],
                "generation_date": datetime.now().isoformat(),
                "celebrity_focus": self.celebrity_name
            }
        except Exception as e:
            print(f"Error processing subcategory {subcategory}: {e}")
            return None

    async def generate_and_store_content(self):
        """Main method to process all articles and generate hierarchical content"""
        try:
            # Fetch all articles
            fields_to_fetch = ["url", "content", "category", "subcategory", "formatted_date"]
            articles, total = self.news_manager.fetch_multiple_fields(fields_to_fetch)

            if not articles:
                print("No articles found to process")
                return 0

            # Generate overall summary first
            overall_summary = await self.process_overall_summary(articles)

            # Group articles by subcategory
            grouped_articles = defaultdict(list)
            for article in articles:
                grouped_articles[article.get("subcategory", "general")].append(article)

            # Process each subcategory
            subcategory_tasks = [
                self.process_subcategory(subcategory, subcategory_articles)
                for subcategory, subcategory_articles in grouped_articles.items()
            ]
            subcategory_results = await asyncio.gather(*subcategory_tasks, return_exceptions=True)

            # Filter out None results
            successful_results = [r for r in subcategory_results if r is not None and not isinstance(r, Exception)]

            # Store results in a new collection for this generation
            generation_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            if self.celebrity_name:
                # Include celebrity name in generation_id if provided
                safe_celebrity_name = self.celebrity_name.replace(' ', '_').lower()
                generation_id = f"{generation_id}_{safe_celebrity_name}"
                
            collection_ref = self.news_manager.db.collection(self.collection_name).document(generation_id).collection("content")

            # Store overall summary
            if overall_summary:
                collection_ref.document("overall_summary").set({
                    "type": "overall_summary",
                    **overall_summary,
                    "last_updated": datetime.now().isoformat()
                })

            # Store subcategory summaries
            for result in successful_results:
                # Create a safe document ID from the subcategory name
                safe_subcategory_id = result['subcategory'].replace('/', '_').replace(' ', '_').lower()
                
                doc_ref = collection_ref.document(f"subcategory_{safe_subcategory_id}")
                doc_ref.set({
                    "type": "subcategory_summary",
                    **result,
                    "last_updated": datetime.now().isoformat()
                })

                # Update original articles with reference to generated content
                batch = self.news_manager.db.batch()
                for source_url in result["source_articles"]:
                    docs = (
                        self.news_manager.db.collection("news")
                        .where("url", "==", source_url)
                        .get()
                    )
                    for doc in docs:
                        batch.update(doc.reference, {
                            "generated_content_ref": f"{self.collection_name}/{generation_id}/content/subcategory_{safe_subcategory_id}"
                        })
                batch.commit()

            return len(successful_results) + (1 if overall_summary else 0)

        except Exception as e:
            print(f"Error in generate_and_store_content: {e}")
            raise