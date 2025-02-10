import asyncio
import time
from typing import List, Dict, Optional
from functools import wraps
from collections import defaultdict
from Storytelling_generation import ContentGenerationManager


class RateLimitHandler:
    def __init__(self, max_tokens_per_minute: int = 40000):
        self.max_tokens_per_minute = max_tokens_per_minute
        self.token_usage = []
        self.lock = asyncio.Lock()
        print(
            f"\nInitialized rate limiter with {max_tokens_per_minute} tokens/minute limit"
        )

    async def wait_for_capacity(self, required_tokens: int):
        print(f"Requesting capacity for {required_tokens} tokens")  # Debug line
        while True:
            async with self.lock:
                current_time = time.time()
                # Debug old usage before cleanup
                old_usage = sum(t[0] for t in self.token_usage)
                print(f"Usage before cleanup: {old_usage}")  # Debug line
                
                self.token_usage = [
                    t for t in self.token_usage if current_time - t[1] < 60
                ]
                current_usage = sum(t[0] for t in self.token_usage)

                print(f"Current token usage entries: {len(self.token_usage)}")  # Debug line
                if current_usage + required_tokens <= self.max_tokens_per_minute:
                    self.token_usage.append((required_tokens, current_time))
                    print(f"Capacity granted. New usage: {current_usage + required_tokens}")  # Debug line
                    return

                print(
                    f"Waiting for capacity - Current usage: {current_usage}/{self.max_tokens_per_minute}"
                )
                print(f"Need {required_tokens} more tokens")  # Debug line

            await asyncio.sleep(1)


def estimate_tokens(text: str) -> int:
    tokens = min(len(text) // 4, 35000)  # Never exceed rate limit with some buffer
    print(f"Estimated tokens for text: {tokens}")  # Debug line
    return tokens


class RateLimitedContentGenerationManager:
    def __init__(
        self, news_manager, celebrity_name: Optional[str] = None, batch_size: int = 5
    ):
        self.content_manager = ContentGenerationManager(news_manager, celebrity_name)
        self.rate_limiter = RateLimitHandler()
        self.batch_size = batch_size
        print(f"\nStarting content generation for {celebrity_name}")

    async def process_with_rate_limit(self, prompt: str, retries: int = 3):
        estimated_tokens = estimate_tokens(prompt)
        print(f"Processing prompt with estimated {estimated_tokens} tokens")  # Debug line

        for attempt in range(retries):
            try:
                await self.rate_limiter.wait_for_capacity(estimated_tokens)
                print(f"Making API call - attempt {attempt + 1}/{retries}")

                # Run the synchronous API call in a thread pool
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.content_manager.news_manager.client.messages.create(
                        model=self.content_manager.news_manager.model,
                        max_tokens=4096,
                        messages=[{"role": "user", "content": prompt}],
                    )
                )
                print("API call successful")
                return response

            except Exception as e:
                if "rate_limit_error" in str(e) and attempt < retries - 1:
                    wait_time = (attempt + 1) * 5
                    print(f"Rate limit hit - waiting {wait_time} seconds before retry")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"Error in API call: {str(e)}")
                    raise

    async def process_subcategories_in_batches(
        self, grouped_articles: Dict[str, List[Dict]]
    ):
        results = []
        subcategory_items = list(grouped_articles.items())
        total_batches = (
            len(subcategory_items) + self.batch_size - 1
        ) // self.batch_size

        print(
            f"\nProcessing {len(subcategory_items)} subcategories in {total_batches} batches"
        )

        for i in range(0, len(subcategory_items), self.batch_size):
            batch = subcategory_items[i : i + self.batch_size]
            current_batch = i // self.batch_size + 1
            print(f"\nStarting batch {current_batch}/{total_batches}")

            batch_tasks = []
            for subcategory, articles in batch:
                print(f"Creating prompt for: {subcategory} ({len(articles)} articles)")
                prompt = self.content_manager.create_subcategory_prompt(
                    subcategory, articles
                )
                task = self.process_with_rate_limit(prompt)
                batch_tasks.append(task)

            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            results.extend(batch_results)

            if current_batch < total_batches:
                print("Waiting 2 seconds before next batch")
                await asyncio.sleep(2)

        return results

    async def generate_and_store_content(self):
        try:
            print("\nStarting content generation process")

            fields_to_fetch = [
                "url",
                "content",
                "category",
                "subcategory",
                "formatted_date",
            ]
            celebrity_name_lower = (
                self.content_manager.celebrity_name.lower()
                .replace(" ", "")
                .replace("-", "")
            )

            print(f"Fetching articles for: {self.content_manager.celebrity_name}")
            articles, total = self.content_manager.news_manager.fetch_multiple_fields(
                fields_to_fetch, celebrity_name_lower
            )

            if not articles:
                print("No articles found")
                return 0, None

            print(f"Found {len(articles)} articles")

            print("\nProcessing overall summary")
            overall_prompt = self.content_manager.create_overall_prompt(articles)
            overall_response = await self.process_with_rate_limit(overall_prompt)
            overall_summary = self.content_manager.extract_sections(
                overall_response.content if hasattr(overall_response, 'content') else overall_response
            )
            print("Overall summary completed")

            grouped_articles = defaultdict(list)
            for article in articles:
                grouped_articles[article.get("subcategory", "general")].append(article)

            print(f"\nFound {len(grouped_articles)} subcategories to process")
            subcategory_results = await self.process_subcategories_in_batches(
                grouped_articles
            )

            successful_results = [
                r
                for r in subcategory_results
                if r is not None and not isinstance(r, Exception)
            ]
            print(f"\nSuccessfully processed {len(successful_results)} subcategories")

            print("\nStoring generated content")
            celebrity_doc_id = await self.content_manager.store_generated_content(
                overall_summary, successful_results
            )
            print(f"Content stored with ID: {celebrity_doc_id}")

            return (
                len(successful_results) + (1 if overall_summary else 0),
                celebrity_doc_id,
            )

        except Exception as e:
            print(f"\nError in content generation: {str(e)}")
            raise