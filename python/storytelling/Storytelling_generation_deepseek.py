import asyncio
from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict
from rate_limiter_deepseek import APIRateLimiter
from Storytelling_fetch_TEST_firebase import TestNewsManager
from Storytelling_fetch_firebase_deepseek import NewsManager


class ContentGenerationManager:
    def __init__(self, news_manager, celebrity_name: Optional[str] = None):
        self.news_manager = news_manager
        self.collection_name = "celebrities-test"
        self.celebrity_name = celebrity_name
        self.rate_limiter = APIRateLimiter(
            requests_per_minute=60,
            tokens_per_minute=150000,
            max_wait_time=30.0,  # 30 second maximum wait
            max_prompt_tokens=10000  # Reject prompts >10k tokens
        )
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

    @staticmethod
    async def fetch_celebrity_names(db):
        """Fetch all celebrity names from the celebrities collection"""
        try:
            # Query the celebrities collection
            celebrities_ref = db.collection("celebrities")
            docs = celebrities_ref.get()

            # Extract celebrity names from the documents
            celebrity_names = []
            for doc in docs:
                data = doc.to_dict()
                if "name" in data:  # Make sure the field exists
                    celebrity_names.append(data["name"])

            return celebrity_names
        except Exception as e:
            print(f"Error fetching celebrity names: {e}")
            return []

    def get_celebrity_doc_id(self):
        """Generate a consistent document ID for a celebrity"""
        if not self.celebrity_name:
            print("Error: Celebrity name is required")
            raise ValueError("Celebrity name is required")

        # Convert celebrity name to lowercase and replace spaces with underscores
        return self.celebrity_name.lower().replace(" ", "").replace("-", "")

    # content generation prompt
    def create_overall_prompt(self, all_articles: List[Dict]) -> str:
        """Create a prompt for generating overall summary across all articles"""
        celebrity_context = (
            f"with a focus on {self.celebrity_name}'s involvement and impact"
            if self.celebrity_name
            else ""
        )

        prompt = f"""You are a professional wiki content writer. Analyze ALL the provided articles and generate a comprehensive overview that synthesizes the main themes, developments, and significance across all content {celebrity_context}. DO NOT include source citations within the text. Instead, provide sources separately as requested below.

    Please generate your response in the following structure:

    <overall_overview>
    Write a comprehensive overview (3-4 paragraphs) that:
    - Identifies the main themes and developments across all content{' related to ' + self.celebrity_name if self.celebrity_name else ''}
    - Highlights key patterns or trends{' involving ' + self.celebrity_name if self.celebrity_name else ''}
    - Summarizes the broader significance or impact{' of ' + self.celebrity_name + "'s involvement" if self.celebrity_name else ''}
    DO NOT include source citations within this text.
    </overall_overview>

    <sources>
    List all sources used in your analysis in a simple array format. Each source should be just the URL, e.g.:
    ["https://example.com/article1", "https://example.com/article2", ...]
    Include only the URLs that you directly referenced when creating the overview.
    </sources>

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
    2. IMPORTANT: Keep the overview text free of citations - all sources should be in the separate <sources> section
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
DO NOT include source citations within this text.
</subcategory_overview>

<chronological_developments>
Present a detailed, chronological analysis of all major developments, events, or changes within this subcategory{f' involving {self.celebrity_name}' if self.celebrity_name else ''}.
Organize by date and include specific details.
DO NOT include source citations within this text.
</chronological_developments>

<key_implications>
Analyze the implications or impact of these developments{f' on {self.celebrity_name} and their career/public image' if self.celebrity_name else ''}.
</key_implications>
{key_works_prompt}

Remember to:
1. Maintain neutral, objective tone
2. IMPORTANT: Keep the overview text free of citations - all sources should be in the separate <sources> section
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

    @staticmethod
    async def process_celebrity(news_manager, celebrity_name):
        """Process content generation for a single celebrity"""
        try:
            content_generator = ContentGenerationManager(news_manager, celebrity_name)
            print(f"\nStarting content generation for {celebrity_name}")
            num_generated, doc_id = await content_generator.generate_and_store_content()
            print(
                f"Successfully generated {num_generated} content pieces for {celebrity_name}"
            )
            print(f"Document ID: {doc_id}")
            return True
        except Exception as e:
            print(f"Error processing {celebrity_name}: {e}")
            return False

    async def process_overall_summary(self, all_articles: List[Dict]) -> Dict:
        """Generate overall summary across all articles"""
        # First create a truncated version of articles if they're too large
        max_articles = 10  # Example limit
        truncated_articles = all_articles[:max_articles] if len(all_articles) > max_articles else all_articles
        
        prompt = self.create_overall_prompt(truncated_articles)
        
        # Check if prompt is too large before proceeding
        prompt_tokens = len(prompt.split())  # Simple approximation
        max_supported_tokens = 4000  # Adjust based on your API limits
        
        if prompt_tokens > max_supported_tokens:
            print(f"Warning: Truncating prompt from {prompt_tokens} tokens")
            # Implement your truncation logic here

        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Add timeout to wait_for_tokens
                try:
                    await asyncio.wait_for(
                        self.rate_limiter.wait_for_tokens(prompt),
                        timeout=30.0  # Don't wait more than 30 seconds
                    )
                except asyncio.TimeoutError:
                    print("Timeout waiting for rate limiter")
                    return None

                # DeepSeek API call
                response = self.news_manager.client.chat.completions.create(  # DeepSeek/OpenAI syntax
                    model=self.news_manager.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=4096,
                    temperature=0.7,  # Optional: Controls creativity (0.7 is balanced)
                )

                content = response.choices[0].message.content

                def extract_section(content, tag):
                    import re

                    pattern = f"<{tag}>(.*?)</{tag}>"
                    match = re.search(pattern, content, re.DOTALL)
                    return match.group(1).strip() if match else ""

                # Rest of the extraction logic remains the same
                sources_text = extract_section(content, "sources")
                sources = []
                if sources_text:
                    import json

                    try:
                        sources = json.loads(sources_text)
                    except json.JSONDecodeError:
                        sources = [
                            line.strip().strip('"')
                            for line in sources_text.split("\n")
                            if line.strip()
                            and not line.strip().startswith("[")
                            and not line.strip().startswith("]")
                        ]

                return {
                    "overall_overview": extract_section(content, "overall_overview"),
                    "sources": sources,
                    "key_findings": extract_section(content, "key_findings"),
                    "key_works": extract_section(content, "key_works"),
                    "raw_content": content,
                    "generation_date": datetime.now().isoformat(),
                    "celebrity_focus": self.celebrity_name,
                }

            except Exception as e:
                if "rate_limit_error" in str(e) and attempt < max_retries - 1:
                    wait_time = 5 * (2**attempt)
                    print(
                        f"Rate limit hit for Overview. Retrying in {wait_time} seconds... (Attempt {attempt+1}/{max_retries})"
                    )
                    await asyncio.sleep(wait_time)
                else:
                    print(f"Error processing overall summary: {e}")
                    return None

    async def process_subcategory(self, subcategory: str, articles: List[Dict]) -> Dict:
        """Process articles for a specific subcategory"""
        print(f"\nProcessing subcategory: {subcategory} ({len(articles)} articles)")
        prompt = self.create_subcategory_prompt(subcategory, articles)

        # Add retry logic
        max_retries = 3
        for attempt in range(max_retries):
            try:
                await self.rate_limiter.wait_for_tokens(prompt)
                print(f"Generating content for {subcategory}...")

                # DeepSeek API call
                response = self.news_manager.client.chat.completions.create(  # DeepSeek/OpenAI syntax
                    model=self.news_manager.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=4096,
                    temperature=0.7,  # Optional: Controls creativity (0.7 is balanced)
                )

                content = response.choices[0].message.content
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
                                            "source": (
                                                source.strip() if source else None
                                            ),
                                        }
                                    )

                        result[self.key_works_categories[subcategory]] = works_list

                return result

            except Exception as e:
                if "rate_limit_error" in str(e) and attempt < max_retries - 1:
                    # Calculate exponential backoff
                    wait_time = 5 * (2**attempt)  # 5, 10, 20 seconds
                    print(
                        f"Rate limit hit for {subcategory}. Retrying in {wait_time} seconds... (Attempt {attempt+1}/{max_retries})"
                    )
                    await asyncio.sleep(wait_time)
                else:
                    print(f"Error processing subcategory {subcategory}: {e}")
                    return None

    async def store_generated_content(self, overall_summary, subcategory_results):
        """Store or update generated content in Firebase"""
        try:
            celebrity_doc_id = self.get_celebrity_doc_id()
            print(f"\nStoring content for {self.celebrity_name}")

            # Reference to the celebrity's document
            celebrity_doc_ref = self.news_manager.db.collection(
                self.collection_name
            ).document(celebrity_doc_id)

            # Reference to the content subcollection
            content_collection_ref = celebrity_doc_ref.collection("content")

            # Initialize combined key_works dictionary
            all_key_works = {}

            # Store overall summary
            if overall_summary:
                print("Storing overall summary")
                content_collection_ref.document("overall_summary").set(
                    {
                        "type": "overall_summary",
                        "overall_overview": overall_summary.get("overall_overview", ""),
                        "sources": overall_summary.get(
                            "sources", []
                        ),  # Store the sources field
                        "key_findings": overall_summary.get("key_findings", ""),
                        "raw_content": overall_summary.get("raw_content", ""),
                        "generation_date": overall_summary.get(
                            "generation_date", datetime.now().isoformat()
                        ),
                        "celebrity_focus": overall_summary.get(
                            "celebrity_focus", self.celebrity_name
                        ),
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

            celebrity_name_lower = (
                self.celebrity_name.lower().replace(" ", "").replace("-", "")
            )

            articles, total = self.news_manager.fetch_multiple_fields(
                fields_to_fetch, celebrity_name_lower
            )
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
            subcategory_results = []

            # Process subcategories sequentially to avoid overwhelming the API
            for subcategory, subcategory_articles in grouped_articles.items():
                print(
                    f"Processing {subcategory} with {len(subcategory_articles)} articles..."
                )

                # Optional: Limit articles per subcategory if there are too many
                if len(subcategory_articles) > 15:
                    print(
                        f"Limiting {subcategory} from {len(subcategory_articles)} to 15 articles"
                    )
                    subcategory_articles = sorted(
                        subcategory_articles,
                        key=lambda x: x.get("formatted_date", ""),
                        reverse=True,
                    )[:15]

                result = await self.process_subcategory(
                    subcategory, subcategory_articles
                )
                if result is not None:
                    subcategory_results.append(result)
                    print(f"✓ Successfully processed {subcategory}")
                else:
                    print(f"❌ Failed to process {subcategory}")

                # Add a short delay between subcategories
                await asyncio.sleep(2)

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


async def main():
    # Initialize NewsManager
    news_manager = NewsManager()

    try:
        # Fetch all celebrity names from Firebase
        # print("Fetching existing celebrity names from Firebase...")
        # celebrity_names = await ContentGenerationManager.fetch_celebrity_names(news_manager.db)
        # print(f"Found {len(celebrity_names)} celebrities")

        # if not celebrity_names:
        #     print("No celebrities found in the database")
        #     return

        # # Process each celebrity
        # successful = 0
        # failed = 0

        # for celebrity_name in celebrity_names:
        #     result = await ContentGenerationManager.process_celebrity(news_manager, celebrity_name)
        #     if result:
        #         successful += 1
        #     else:
        #         failed += 1

        # Print summary
        # print("\nProcessing Complete!")
        # print(f"Successfully processed: {successful} celebrities")
        # print(f"Failed to process: {failed} celebrities")

        # Instead of fetching celebrities, hardcode the one you want
        celebrity_name = "IU"  # Hardcode the celebrity name here
        print(f"Processing celebrity: {celebrity_name}")

        # Process just this one celebrity
        result = await ContentGenerationManager.process_celebrity(
            news_manager, celebrity_name
        )

        if result:
            print(f"Successfully processed {celebrity_name}")
        else:
            print(f"Failed to process {celebrity_name}")

    except Exception as e:
        print(f"Error during main execution: {e}")
    finally:
        # Clean up resources
        await news_manager.close()  # Assuming you have a close method


if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
