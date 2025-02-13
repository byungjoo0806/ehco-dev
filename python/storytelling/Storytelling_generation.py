import asyncio
from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict
from rate_limiter import APIRateLimiter

class ContentGenerationManager:
    def __init__(self, news_manager, celebrity_name: Optional[str] = None):
        self.news_manager = news_manager
        self.collection_name = "celebrities"
        self.celebrity_name = celebrity_name
        self.rate_limiter = APIRateLimiter() 
        self.key_works_categories = {
            "Drama/Series": "drama_series",
            "Film": "films",
            "OTT": "ott_content",
            "Film/TV/drama Awards": "media_awards",
            "Variety show": "variety_shows",
            "Album Release": "albums",
            "Collaboration": "collaborations",
            "Performance": "performances",
            "Tour/concert": "concerts",
            "Music Awards": "music_awards",
        }

    def get_celebrity_doc_id(self):
        """Generate a consistent document ID for a celebrity"""
        if not self.celebrity_name:
            print("Error: Celebrity name is required")
            raise ValueError("Celebrity name is required")

        # Convert celebrity name to lowercase and replace spaces with underscores
        return self.celebrity_name.lower().replace(" ", "").replace("-", "")

    def create_overall_prompt(self, all_articles: List[Dict]) -> str:
        """Create a prompt for generating overall summary across all articles"""
        celebrity_context = (
            f"with a focus on {self.celebrity_name}'s involvement and impact"
            if self.celebrity_name
            else ""
        )

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

<key_works>
If the content mentions any of the following, list them chronologically with years:
- Drama series appearances
- Film roles
- OTT/streaming content
- Award wins and nominations
- Variety show appearances
- Album releases
- Musical collaborations
- Notable performances
- Tours and concerts
Format each entry as: "YYYY - Title/Description [Source URL]"
</key_works>

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
        celebrity_context = (
            f"with a focus on {self.celebrity_name}'s involvement"
            if self.celebrity_name
            else ""
        )

        # Add key works section if this is a relevant subcategory
        key_works_prompt = ""
        if subcategory in self.key_works_categories:
            key_works_prompt = f"""
<key_works>
List ALL mentioned works chronologically in this format: "YYYY - Title/Description [Source URL]"
For {subcategory}, include:
- {"TV series/drama roles and character names" if subcategory == "Drama/Series" else ""}
- {"Film roles and character names" if subcategory == "Film" else ""}
- {"OTT/streaming content appearances" if subcategory == "OTT" else ""}
- {"Award nominations and wins with categories" if "Awards" in subcategory else ""}
- {"Variety show appearances and roles" if subcategory == "Variety show" else ""}
- {"Album names and release dates" if subcategory == "Album Release" else ""}
- {"Collaboration details and participating artists" if subcategory == "Collaboration" else ""}
- {"Performance details and venues" if subcategory == "Performance" else ""}
- {"Tour names, dates, and venues" if subcategory == "Tour/concert" else ""}
Each entry MUST include the year and source citation.
</key_works>
"""

        prompt = f"""You are a professional wiki content writer. Analyze the provided articles for the subcategory "{subcategory}" {celebrity_context} and generate detailed, chronological content.

Please generate your response in the following structure:

<subcategory_overview>
Write a focused overview (2-3 paragraphs) specific to {f"{self.celebrity_name}'s involvement in" if self.celebrity_name else ''} this subcategory's developments and significance.
</subcategory_overview>

<chronological_developments>
Present a detailed, chronological analysis of all major developments, events, or changes within this subcategory{f' involving {self.celebrity_name}' if self.celebrity_name else ''}.
Organize by date and include specific details.
</chronological_developments>

<key_implications>
Analyze the implications or impact of these developments{f' on {self.celebrity_name} and their career/public image' if self.celebrity_name else ''}.
</key_implications>
{key_works_prompt}

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
            await self.rate_limiter.wait_for_tokens(prompt)
            
            response = self.news_manager.client.messages.create(
                model=self.news_manager.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )

            content = (
                response.content[0].text
                if isinstance(response.content, list)
                else response.content
            )

            def extract_section(content, tag):
                import re

                pattern = f"<{tag}>(.*?)</{tag}>"
                match = re.search(pattern, content, re.DOTALL)
                return match.group(1).strip() if match else ""

            return {
                "overall_overview": extract_section(content, "overall_overview"),
                "key_findings": extract_section(content, "key_findings"),
                "key_works": extract_section(content, "key_works"),
                "raw_content": content,
                "generation_date": datetime.now().isoformat(),
                "celebrity_focus": self.celebrity_name,
            }
        except Exception as e:
            print(f"Error processing overall summary: {e}")
            return None

    async def process_subcategory(self, subcategory: str, articles: List[Dict]) -> Dict:
        """Process articles for a specific subcategory"""
        print(f"\nProcessing subcategory: {subcategory} ({len(articles)} articles)")
        prompt = self.create_subcategory_prompt(subcategory, articles)

        try:
            await self.rate_limiter.wait_for_tokens(prompt)
            print(f"Generating content for {subcategory}...")
            
            response = self.news_manager.client.messages.create(
                model=self.news_manager.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )

            content = (
                response.content[0].text
                if isinstance(response.content, list)
                else response.content
            )
            print(f"✓ Content generated for {subcategory}")

            def extract_section(content, tag):
                import re

                pattern = f"<{tag}>(.*?)</{tag}>"
                match = re.search(pattern, content, re.DOTALL)
                return match.group(1).strip() if match else ""

            result = {
                "subcategory": subcategory,
                "subcategory_overview": extract_section(
                    content, "subcategory_overview"
                ),
                "chronological_developments": extract_section(
                    content, "chronological_developments"
                ),
                "key_implications": extract_section(content, "key_implications"),
                "raw_content": content,
                "source_articles": [article["url"] for article in articles],
                "generation_date": datetime.now().isoformat(),
                "celebrity_focus": self.celebrity_name,
            }

            # Add key_works if this is a relevant subcategory
            if subcategory in self.key_works_categories:
                key_works = extract_section(content, "key_works")
                if key_works:
                    # Parse the key works into a structured format
                    import re

                    works_list = []
                    for line in key_works.split("\n"):
                        line = line.strip()
                        if line and "-" in line:
                            # Match pattern: "YYYY - Description [Source]"
                            match = re.match(
                                r"(\d{4})\s*-\s*([^\[]+)(?:\[([^\]]+)\])?", line
                            )
                            if match:
                                year, description, source = match.groups()
                                works_list.append(
                                    {
                                        "year": year.strip(),
                                        "description": description.strip(),
                                        "source": source.strip() if source else None,
                                    }
                                )

                    result[self.key_works_categories[subcategory]] = works_list

            return result

        except Exception as e:
            print(f"Error processing subcategory {subcategory}: {e}")
            return None

    async def store_generated_content(self, overall_summary, subcategory_results):
        """Store or update generated content in Firebase"""
        try:
            celebrity_doc_id = self.get_celebrity_doc_id()
            print(f"\nStoring content for {self.celebrity_name}")

            # Reference to the celebrity's document
            celebrity_doc_ref = self.news_manager.db.collection(self.collection_name).document(celebrity_doc_id)

            # Reference to the content subcollection
            content_collection_ref = celebrity_doc_ref.collection("content")

            # Store metadata at the celebrity document level
            print("Storing celebrity metadata")
            celebrity_doc_ref.set(
                {
                    "celebrity_name": self.celebrity_name,
                    "last_updated": datetime.now().isoformat(),
                    "content_available": True,
                },
                merge=True,
            )  # Use merge to preserve any existing metadata

            # Initialize combined key_works dictionary
            all_key_works = {}

            # Store overall summary
            if overall_summary:
                print("Storing overall summary")
                content_collection_ref.document("overall_summary").set(
                    {
                        "type": "overall_summary",
                        **{
                            k: v for k, v in overall_summary.items() if k != "key_works"
                        },
                        "last_updated": datetime.now().isoformat(),
                    }
                )

            # Store subcategory summaries and collect key_works
            print("\nStoring subcategory results")
            for result in subcategory_results:
                if result is None or isinstance(result, Exception):
                    continue
                
                subcategory = result["subcategory"]
                print(f"Processing subcategory: {subcategory}")

                # Create a consistent document ID from the subcategory name
                safe_subcategory_id = (
                    result["subcategory"].replace("/", "_").replace(" ", "_").lower()
                )

                # Extract key_works if present
                for category, works in result.items():
                    if category in self.key_works_categories.values():
                        if category not in all_key_works:
                            all_key_works[category] = []
                        all_key_works[category].extend(works)

                # Store subcategory content without key_works
                doc_ref = content_collection_ref.document(f"{safe_subcategory_id}")
                filtered_result = {
                    k: v
                    for k, v in result.items()
                    if k not in self.key_works_categories.values()
                }
                doc_ref.set(
                    {
                        "type": "subcategory_summary",
                        **filtered_result,
                        "last_updated": datetime.now().isoformat(),
                    }
                )

                # Update original articles with reference to generated content
                batch = self.news_manager.db.batch()
                for source_url in result.get("source_articles", []):
                    docs = (
                        self.news_manager.db.collection("news")
                        .where("url", "==", source_url)
                        .get()
                    )
                    for doc in docs:
                        batch.update(
                            doc.reference,
                            {
                                "generated_content_ref": f"{self.collection_name}/{celebrity_doc_id}/content/{safe_subcategory_id}"
                            },
                        )
                batch.commit()

            # Store all key_works in a separate document
            if all_key_works:
                print("\nStoring combined key works")
                content_collection_ref.document("key_works").set(
                    {
                        "type": "key_works",
                        "key_works": all_key_works,
                        "last_updated": datetime.now().isoformat(),
                    }
                )

            print("Content storage completed")
            return celebrity_doc_id

        except Exception as e:
            print(f"Error in store_generated_content: {e}")
            raise

    async def generate_and_store_content(self):
        """Main method to process all articles and generate hierarchical content"""
        try:
            # Fetch all articles
            print("\nFetching articles...")
            fields_to_fetch = [
                "url",
                "content",
                "category",
                "subcategory",
                "formatted_date",
            ]
            
            celebrity_name_lower = self.celebrity_name.lower().replace(" ", "").replace("-", "")
            
            articles, total = self.news_manager.fetch_multiple_fields(fields_to_fetch,celebrity_name_lower)
            print(f"✓ Found {total} articles to process")

            if not articles:
                print("❌ No articles found to process")
                return 0

            # Generate overall summary first
            print("\nGenerating overall summary...")
            overall_summary = await self.process_overall_summary(articles)
            print("✓ Overall summary generated")

            # Group articles by subcategory
            print("\nProcessing articles by subcategory...")
            grouped_articles = defaultdict(list)
            for article in articles:
                grouped_articles[article.get("subcategory", "general")].append(article)

            # Process each subcategory
            print(f"Found {len(grouped_articles)} subcategories to process:")
            for subcategory, articles in grouped_articles.items():
                print(f"  - {subcategory}: {len(articles)} articles")
            
            print("\nStarting subcategory processing...")
            subcategory_tasks = [
                self.process_subcategory(subcategory, subcategory_articles)
                for subcategory, subcategory_articles in grouped_articles.items()
            ]
            subcategory_results = await asyncio.gather(
                *subcategory_tasks, return_exceptions=True
            )

            # Filter out None results
            successful_results = [
                r
                for r in subcategory_results
                if r is not None and not isinstance(r, Exception)
            ]
            print(f"✓ Successfully processed {len(successful_results)} subcategories")

            # Store or update the content
            print("\nStoring generated content...")
            celebrity_doc_id = await self.store_generated_content(
                overall_summary, successful_results
            )
            print(f"✓ Content stored successfully with document ID: {celebrity_doc_id}")

            return (
                len(successful_results) + (1 if overall_summary else 0),
                celebrity_doc_id,
            )

        except Exception as e:
            print(f"Error in generate_and_store_content: {e}")
            raise