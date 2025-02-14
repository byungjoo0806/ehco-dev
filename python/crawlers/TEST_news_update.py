import asyncio
from datetime import datetime, timedelta
import pandas as pd
from typing import List, Dict, Optional, Set
import os
import firebase_admin
from firebase_admin import credentials, firestore
from anthropic import Anthropic
from playwright.async_api import async_playwright
import hashlib
from dotenv import load_dotenv
import csv
from pathlib import Path
import random
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import time

# Reuse the ArticleSchema from original code
@dataclass
class ArticleSchema:
    url: str
    title: str
    content: str
    date: str
    thumbnail: str = ""
    source: str = ""
    celebrity: str = ""
    relevance_score: float = 0.0
    relevance_reason: str = ""
    headline: str = ""
    subheading: str = ""
    category: str = ""
    subcategory: str = ""
    category_reason: str = ""

class IncrementalNewsProcessor:
    def __init__(self, celebrity: Dict[str, str]):
        """Initialize with all the same configurations as the original NewsProcessor"""
        self.celebrity = celebrity
        self.celebrity_id = celebrity["name_eng"].lower().replace(" ", "").replace("-", "")
        self.output_dir = Path("crawled_data") / self.celebrity_id
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.seen_urls: Set[str] = set()
        self.total_tokens = 0
        self.raw_articles = []
        self.setup_anthropic()
        self.db = self.setup_firebase()
        self.rate_limiter = asyncio.Semaphore(3)
        self.BATCH_SIZE = 20
        self.REQUESTS_PER_MINUTE = 45
        # New: Store existing document IDs
        self.existing_doc_ids: Set[str] = set()

    # Keep all the setup methods from original code (setup_anthropic, setup_firebase)
    def setup_anthropic(self):
        load_dotenv()
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
        self.client = Anthropic(api_key=api_key)
        self.model = "claude-3-5-sonnet-20241022"
        
    def setup_firebase(self):
        """Initialize Firebase with environment variables and proper error handling"""
        print("Setting up Firebase connection...")
        # Load environment variables
        load_dotenv()

        try:
            # Get configuration from environment variables
            config_path = os.getenv("FIREBASE_CONFIG_PATH")
            database_url = os.getenv("FIREBASE_TEST_DATABASE_URL")

            if not config_path:
                raise ValueError(
                    "FIREBASE_CONFIG_PATH not found in environment variables"
                )
            if not database_url:
                raise ValueError(
                    "FIREBASE_TEST_DATABASE_URL not found in environment variables"
                )
            if not os.path.exists(config_path):
                raise FileNotFoundError(
                    f"Service account key not found at: {config_path}"
                )

            try:
                # Initialize with specific project
                cred = credentials.Certificate(config_path)
                project_id = "crawling-test-1"  # Your test project ID
                
                firebase_admin.initialize_app(cred, {
                    'projectId': project_id
                })
                print(f"Firebase initialized successfully for project: {project_id}")
            except ValueError as e:
                if "The default Firebase app already exists" in str(e):
                    print("Using existing Firebase app")
                else:
                    raise e

            try:
                # Get client with specific database
                db = firestore.Client.from_service_account_json(
                    config_path,
                    database='crawling-test-1'
                )
                print("Firestore client connected successfully to specified database")
                return db
            except Exception as e:
                print(f"Failed to get Firestore client: {e}")
                raise

        except Exception as e:
            print(f"Failed to initialize Firebase: {e}")
            raise
    
    
    # article data validation
    def validate_article(self, article: Dict) -> bool:
        """Validate article against schema"""
        try:
            ArticleSchema(**article)
            return True
        except Exception as e:
            print(f"Article validation failed: {str(e)}")
            return False
    
    def is_article_relevant(self, response: str) -> bool:
        """Determine if an article is relevant based on Claude's response"""
        try:
            # Extract score from response
            score_line = next(
                (line for line in response.split("\n") if line.startswith("SCORE:")),
                None,
            )
            if not score_line:
                return False

            # Clean up the score string and extract just the number
            score_str = score_line.replace("SCORE:", "").strip()
            # Extract first number from the string using string split
            score_num = score_str.split()[0]  # Takes first part before any space
            # Convert to float and check if it's above threshold
            score = float(score_num)
            
            return (
                score >= 3.0
            )  # Articles with score 3 or higher are considered relevant
        except Exception as e:
            print(f"Error checking article relevance: {str(e)}")
            return False
    
    # fetch necessary data from firebase
    @staticmethod
    async def fetch_all_celebrities(db) -> list:
        """
        Fetch all celebrities and their specified fields from Firestore
        
        Args:
            db: Firestore database instance
            
        Returns:
            list: List of dictionaries containing celebrity data
        """
        try:
            # Get all documents from celebrities collection
            celebrities_ref = db.collection('celebrities')
            docs = await asyncio.to_thread(celebrities_ref.stream)
            
            celebrities_data = []
            for doc in docs:
                data = doc.to_dict()
                
                # Extract required fields and map to our expected structure
                celebrity_info = {
                    "name_eng": data.get("name", ""),  # Map 'name' to 'name_eng'
                    "name_kr": data.get("koreanName", ""),  # Map 'koreanName' to 'name_kr'
                    "sex": data.get("gender", ""),
                    "occupation": data.get("occupation", []),
                }
                
                # Ensure occupation is a list
                if isinstance(celebrity_info["occupation"], str):
                    celebrity_info["occupation"] = [celebrity_info["occupation"]]

                # Add document ID
                celebrity_info["id"] = doc.id
                
                # Validate required fields
                if all(celebrity_info.values()):
                    celebrities_data.append(celebrity_info)
                else:
                    print(f"Skipping celebrity {doc.id} due to missing required fields")
            
            return celebrities_data
            
        except Exception as e:
            print(f"Error fetching celebrities data: {str(e)}")
            return []
    
    async def fetch_existing_doc_ids(self):
        """Fetch all existing document IDs for the current celebrity from the news collection"""
        try:
            # Get reference to the news collection
            news_ref = self.db.collection("news")
            
            # Use where() with keyword arguments to avoid the warning
            query = news_ref.where(filter=firestore.FieldFilter("celebrity_id", "==", self.celebrity_id))
            
            # Stream all documents to get their IDs
            docs = await asyncio.to_thread(query.stream)
            
            # Store document IDs in the set
            self.existing_doc_ids = {doc.id for doc in docs}
            print(f"Fetched {len(self.existing_doc_ids)} existing document IDs for {self.celebrity['name_eng']}")
            
        except Exception as e:
            print(f"Error fetching existing document IDs: {str(e)}")
            self.existing_doc_ids = set()


    # compare urls to check existing data
    def url_exists(self, url: str) -> bool:
        """Check if a URL already exists in Firebase by checking its hashed ID"""
        doc_id = hashlib.md5(url.encode()).hexdigest()
        return doc_id in self.existing_doc_ids


    # parse crawled articles
    async def parse_koreaherald_article(self, article) -> Optional[Dict]:
        try:
            # Get URL first before doing any other processing
            url = await article.evaluate("article => article.querySelector('a')?.href || ''")
            if not url:
                return None
                
            # Handle relative URLs
            if not url.startswith("http"):
                url = "https://www.koreaherald.com" + url
                
            # Check if URL exists - if it does, signal to stop crawling
            if self.url_exists(url):
                return None
                
            # Only proceed with full parsing if URL is new
            article_data = await article.evaluate("""(article) => {
                const title = article.querySelector('.news_title');
                const date = article.querySelector('.date');
                const img = article.querySelector('.news_img img');
                const content = article.querySelector('.news_text');
                
                return {
                    title: title ? title.textContent.trim() : '',
                    date: date ? date.textContent.trim() : '',
                    thumbnail: img ? img.src : '',
                    content: content ? content.textContent.trim() : ''
                };
            }""")
            
            if not article_data["title"]:
                return None
                
            article_data["url"] = url
            
            # Convert date format from "2021.10.05 18:42" to "2021-10-05"
            try:
                if article_data["date"]:
                    date_part = article_data["date"].split()[0]
                    year, month, day = date_part.split(".")
                    article_data["date"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                else:
                    article_data["date"] = datetime.now().strftime("%Y-%m-%d")
            except Exception as e:
                print(f"Date parsing error: {str(e)}")
                article_data["date"] = datetime.now().strftime("%Y-%m-%d")

            # Ensure content exists
            if not article_data["content"]:
                article_data["content"] = article_data["title"]

            # Add celebrity ID
            article_data["celebrity"] = self.celebrity_id
            return article_data
            
        except Exception as e:
            print(f"Parse error for article: {str(e)}")
            return None

    async def parse_yonhap_article(self, article) -> Optional[Dict]:
        """Parse article data from Yonhap News with early URL checking"""
        try:
            # Get URL first
            url = await article.evaluate("article => article.querySelector('figure > a')?.href")
            if not url or self.url_exists(url):
                return None
                
            # Only proceed with full parsing if URL is new
            article_data = await article.evaluate("""(article) => {
                const img = article.querySelector('figure > a > img');
                const titleLink = article.querySelector('div.txt-con > h2.tit > a');
                const leadSpan = article.querySelector('span.lead');
                const dateSpan = article.querySelector('span.date.datefm-EN01');
                
                return {
                    thumbnail: img ? img.src : '',
                    title: titleLink ? titleLink.textContent.trim() : null,
                    content: leadSpan ? leadSpan.textContent.trim() : '',
                    date: dateSpan ? dateSpan.textContent.trim() : null
                };
            }""")

            if not article_data["title"]:
                return None

            article_data["url"] = url

            # Format the date (rest of date formatting logic remains the same)
            try:
                year = None
                if "AEN" in url:
                    year = url.split("AEN")[1][:4]
                if not year:
                    year = str(datetime.now().year)

                date_parts = article_data["date"].split()
                month = date_parts[1].replace(".", "").strip()
                day = date_parts[2].strip()

                date_str = f"{month} {day} {year}"
                formatted_date = datetime.strptime(date_str, "%b %d %Y").strftime("%Y-%m-%d")
                article_data["date"] = formatted_date
            except Exception as e:
                print(f"Date parsing error: {e}")
                article_data["date"] = datetime.now().strftime("%Y-%m-%d")

            article_data["source"] = "Yonhap News"
            article_data["celebrity"] = self.celebrity_id

            return article_data

        except Exception as e:
            print(f"Error parsing Yonhap article: {str(e)}")
            return None

    async def parse_joongang_article(self, article) -> Optional[Dict]:
        """Parse a JoongAng Daily article with early URL checking"""
        try:
            # Get URL first
            url = await article.evaluate("article => article.querySelector('a.media')?.href")
            if not url or self.url_exists(url):
                return None
                
            # Only proceed with full parsing if URL is new
            article_data = await article.evaluate("""(article) => {
                const img = article.querySelector('span.img-mask-wrap img');
                const title = article.querySelector('.mid-article-title3');
                const content = article.querySelector('.mid-article-content3');
                const dateSpan = article.querySelector('.media-date span:last-child');
                
                return {
                    title: title ? title.textContent.trim() : null,
                    content: content ? content.textContent.trim() : null,
                    thumbnail: img ? img.src : '',
                    date: dateSpan ? dateSpan.textContent.trim() : ''
                };
            }""")
            
            if not article_data["title"]:
                return None

            article_data["url"] = url
            article_data["source"] = "JoongAng Daily"
            article_data["celebrity"] = self.celebrity_id
            
            return article_data
                
        except Exception as e:
            print(f"Error in parse_joongang_article: {str(e)}")
            return None


    # crawling articles
    async def crawl_korea_herald(self):
        """Crawl Korea Herald with early stopping on existing content"""
        print(f"Starting Korea Herald crawl for {self.celebrity['name_eng']}...")
        articles = []
        current_page = 1
        keyword = self.celebrity["name_eng"].replace(" ", "+")
        base_url = f"https://www.koreaherald.com/search/detail?q={keyword}&stype=NEWS"

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()

            try:
                while True:
                    page_url = f"{base_url}&page={current_page}" if current_page > 1 else base_url
                    print(f"Processing KH page {current_page}")

                    try:
                        await page.goto(page_url, wait_until="networkidle")
                        await page.wait_for_selector(".news_list", timeout=10000)
                    except Exception as e:
                        print(f"Page load error: {str(e)}")
                        break

                    article_elements = await page.query_selector_all(".news_list li")
                    if not article_elements:
                        break

                    for article in article_elements:
                        article_data = await self.parse_koreaherald_article(article)
                        if article_data is None:
                            # Check if it was None because of an existing URL
                            url = await article.evaluate("article => article.querySelector('a')?.href")
                            if url and self.url_exists(url):
                                print("Found existing article, stopping Korea Herald crawl")
                                return articles
                        else:
                            articles.append(article_data)

                    current_page += 1
                    await asyncio.sleep(2)

            finally:
                await context.close()
                await browser.close()

        return articles

    async def crawl_yonhap(self):
        """Crawl articles from Yonhap News with incremental update support"""
        print(f"Starting Yonhap crawl for {self.celebrity['name_eng']}...")
        articles = []
        current_page = 1
        max_pages = 50
        found_existing = False

        keyword = self.celebrity["name_eng"].replace(" ", "%20")
        base_url = f"https://en.yna.co.kr/search/index?query={keyword}&ctype=A&lang=EN"

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            )
            page = await context.new_page()
            page.set_default_timeout(30000)

            try:
                while current_page <= max_pages and not found_existing:
                    page_url = f"{base_url}&page_no={current_page}" if current_page > 1 else base_url
                    print(f"Processing Yonhap page {current_page}")

                    try:
                        await page.goto(page_url, wait_until="domcontentloaded")
                        await page.wait_for_selector(".smain-list-type01", timeout=20000)
                        await page.wait_for_timeout(2000)

                        article_elements = await page.query_selector_all("li article")
                        
                        if not article_elements:
                            await page.wait_for_load_state("networkidle")
                            await page.wait_for_timeout(2000)
                            article_elements = await page.query_selector_all("li article")

                        if not article_elements:
                            print("No articles found on this page")
                            break

                        articles_processed = 0
                        for article in article_elements:
                            article_data = await self.parse_yonhap_article(article)
                            if article_data is None:
                                # If we got None because we found an existing article
                                if self.url_exists(await article.evaluate("article => article.querySelector('figure > a')?.href")):
                                    found_existing = True
                                    break
                                continue
                            
                            articles.append(article_data)
                            articles_processed += 1

                        if found_existing or articles_processed == 0:
                            break

                        await page.wait_for_timeout(2000)
                        current_page += 1

                    except Exception as e:
                        print(f"Error processing page {current_page}: {str(e)}")
                        break

            finally:
                await context.close()
                await browser.close()

        print(f"Completed Yonhap crawl with {len(articles)} new articles found")
        return articles

    async def crawl_joongang(self):
        """Crawl articles from JoongAng Daily with incremental update support"""
        print(f"Starting JoongAng crawl for {self.celebrity['name_eng']}...")
        articles = []
        found_existing = False

        keyword = self.celebrity["name_eng"].replace(" ", "%2520")
        base_url = f"https://koreajoongangdaily.joins.com/section/searchResult/{keyword}?"

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = await context.new_page()

            try:
                await page.goto(base_url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_selector(".mid-article3", timeout=20000)
                await page.wait_for_timeout(3000)

                while not found_existing:
                    current_articles = await page.query_selector_all("div.mid-article3")
                    current_count = len(current_articles)

                    if not current_articles:
                        break

                    start_idx = len(articles)
                    for idx in range(start_idx, current_count):
                        try:
                            article = current_articles[idx]
                            article_data = await self.parse_joongang_article(article)
                            
                            if article_data is None:
                                # Check if we hit an existing article
                                url = await article.evaluate("article => article.querySelector('a.media')?.href")
                                if url and self.url_exists(url):
                                    found_existing = True
                                    break
                                continue
                            
                            articles.append(article_data)

                        except Exception as e:
                            print(f"Error processing article {idx + 1}: {str(e)}")
                            continue

                    if found_existing:
                        break

                    # Try to load more articles
                    try:
                        more_button = await page.query_selector(".btn-more")
                        if not more_button or not await more_button.is_visible():
                            print("No more articles to load")
                            break

                        await more_button.click()
                        print("Clicked 'Load More' button")
                        await page.wait_for_timeout(2000)

                        new_count = len(await page.query_selector_all("div.mid-article3"))
                        if new_count <= current_count:
                            print("No new articles loaded after clicking 'More'")
                            break

                    except Exception as e:
                        print(f"Error loading more articles: {str(e)}")
                        break

            except Exception as e:
                print(f"Error in JoongAng crawl: {str(e)}")

            finally:
                await context.close()
                await browser.close()

        print(f"Successfully extracted {len(articles)} new articles from JoongAng")
        return articles

    async def crawl_websites(self):
        """Crawl articles from multiple websites with incremental update support"""
        all_articles = []
        seen_urls = set()

        crawlers = [
            ("Korea Herald", self.crawl_korea_herald),
            ("Yonhap", self.crawl_yonhap),
            ("JoongAng", self.crawl_joongang),
        ]

        for source, crawler in crawlers:
            try:
                print(f"\nStarting crawl of {source}...")
                async with self.rate_limiter:
                    source_articles = await crawler()

                    # Validate and deduplicate articles
                    valid_articles = []
                    for article in source_articles:
                        if (
                            article
                            and self.validate_article(article)
                            and article["url"] not in seen_urls
                            and not self.url_exists(article["url"])  # Double check we're not adding existing articles
                        ):
                            seen_urls.add(article["url"])
                            valid_articles.append(article)

                    all_articles.extend(valid_articles)
                    print(f"Found {len(valid_articles)} new articles from {source}")

            except Exception as e:
                print(f"Error crawling {source}: {str(e)}")
                continue

        print(f"Total new articles found across all sources: {len(all_articles)}")
        return all_articles


    # pre data generation
    async def analyze_relevance(self, articles: List[Dict]) -> pd.DataFrame:
        """Analyze article relevance with improved error handling and validation"""
        if not articles:
            print("No articles to analyze")
            return pd.DataFrame()

        relevant_articles = []

        for batch in self.batch_articles(articles, self.BATCH_SIZE):
            try:
                print(
                    f"Processing batch of {len(batch)} articles for relevance analysis..."
                )
                prompts = [self.create_relevance_prompt(article) for article in batch]
                responses = await self.batch_claude_call(prompts)

                for article, response in zip(batch, responses):
                    if response and self.is_article_relevant(response):
                        article_data = {
                            **article,
                            "relevance_score": self.extract_relevance_score(response),
                            "relevance_reason": self.extract_relevance_reason(response),
                        }
                        if self.validate_article(article_data):
                            relevant_articles.append(article_data)

            except Exception as e:
                print(f"Error processing batch: {str(e)}")
                continue

        # Save to CSV with error handling
        df = pd.DataFrame(relevant_articles)
        try:
            output_file = self.output_dir / f"{self.celebrity_id}_relevant_articles.csv"
            df.to_csv(output_file, index=False)
        except Exception as e:
            print(f"Error saving CSV: {str(e)}")

        return df

    async def generate_headlines(self, df: pd.DataFrame) -> pd.DataFrame:
        """Generate headlines and subheadings using Claude API (Step 5)"""
        articles_with_headlines = []

        for batch in self.batch_articles(df.to_dict("records"), self.BATCH_SIZE):
            print(
                f"Processing batch of {len(batch)} articles for headline generation..."
            )
            prompts = [self.create_headline_prompt(article) for article in batch]
            responses = await self.batch_claude_call(prompts)

            for article, response in zip(batch, responses):
                if response:
                    headline_data = self.extract_headline_data(response)
                    articles_with_headlines.append({**article, **headline_data})

        headlines_df = pd.DataFrame(articles_with_headlines)
        output_file = (
            self.output_dir / f"{self.celebrity_id}_articles_with_headlines.csv"
        )
        headlines_df.to_csv(output_file, index=False)
        return headlines_df

    async def categorize_articles(self, df: pd.DataFrame) -> pd.DataFrame:
        """Categorize articles using Claude API (Step 6)"""
        categorized_articles = []

        for batch in self.batch_articles(df.to_dict("records"), self.BATCH_SIZE):
            print(f"Processing batch of {len(batch)} articles for categorization...")
            prompts = [self.create_category_prompt(article) for article in batch]
            responses = await self.batch_claude_call(prompts)

            for article, response in zip(batch, responses):
                if response:
                    category_data = self.extract_category_data(response)
                    categorized_articles.append({**article, **category_data})

        final_df = pd.DataFrame(categorized_articles)
        output_file = self.output_dir / f"{self.celebrity_id}_final_articles.csv"
        final_df.to_csv(output_file, index=False)
        return final_df


    # Helper methods
    def batch_articles(self, articles: List[Dict], batch_size: int):
        """Yield batches of articles"""
        for i in range(0, len(articles), batch_size):
            yield articles[i : i + batch_size]

    async def batch_claude_call(self, prompts: List[str]) -> List[Optional[str]]:
        """Make batch API calls to Claude with improved rate limiting"""
        print(f"\n=== BATCH CLAUDE API CALL ({len(prompts)} prompts) ===")

        # Track requests within a minute
        request_times = []
        rate_limit = asyncio.Semaphore(3)  # Limit concurrent requests

        async def process_single_prompt(
            prompt: str, attempt: int = 0, max_retries: int = 3
        ) -> Optional[str]:
            async with rate_limit:
                try:
                    # Check rate limit
                    current_time = time.time()
                    request_times[:] = [
                        t for t in request_times if current_time - t < 60
                    ]

                    if len(request_times) >= self.REQUESTS_PER_MINUTE:
                        # Wait until we're under the rate limit
                        sleep_time = 60 - (current_time - request_times[0])
                        print(f"Rate limit approached, waiting {sleep_time:.2f}s...")
                        await asyncio.sleep(sleep_time)

                    # Add this request to our tracking
                    request_times.append(time.time())

                    # Run the API call in a thread pool
                    response = await asyncio.to_thread(
                        self.client.messages.create,
                        model=self.model,
                        max_tokens=1000,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.3,
                    )

                    if not response.content:
                        raise ValueError("Empty response from Claude API")

                    self.total_tokens += (
                        response.usage.input_tokens + response.usage.output_tokens
                    )

                    # Add small delay between successful requests
                    await asyncio.sleep(0.2)

                    return response.content[0].text

                except Exception as e:
                    if attempt >= max_retries - 1:
                        print(f"Failed after {max_retries} attempts: {str(e)}")
                        return None

                    # Longer backoff for rate limit errors
                    if "rate_limit_error" in str(e):
                        wait_time = min(5 + (2**attempt) + random.uniform(0, 2), 60)
                        print(
                            f"Rate limit hit, waiting {wait_time:.2f}s before retry..."
                        )
                    else:
                        wait_time = min(2**attempt + random.uniform(0, 1), 32)
                        print(
                            f"Error occurred, waiting {wait_time:.2f}s before retry..."
                        )

                    await asyncio.sleep(wait_time)
                    return await process_single_prompt(prompt, attempt + 1)

        # Process prompts with progress tracking
        results = []
        total_prompts = len(prompts)

        # Process in smaller chunks to avoid overwhelming the rate limit
        chunk_size = 5
        for i in range(0, len(prompts), chunk_size):
            chunk = prompts[i : i + chunk_size]
            chunk_tasks = [process_single_prompt(prompt) for prompt in chunk]

            # Wait for this chunk to complete
            chunk_results = await asyncio.gather(*chunk_tasks)
            results.extend(chunk_results)

            print(
                f"Progress: {min(i + chunk_size, total_prompts)}/{total_prompts} prompts processed"
            )

            # Add delay between chunks
            if i + chunk_size < total_prompts:
                await asyncio.sleep(1)  # 1 second delay between chunks

        # Log success rate
        success_count = sum(1 for r in results if r is not None)
        print(
            f"Batch success rate: {success_count}/{total_prompts} ({success_count/total_prompts*100:.1f}%)"
        )
        print(f"Total tokens used: {self.total_tokens}")
        print("=== END BATCH API CALL ===\n")

        return results


    # Prompt creation methods
    def create_relevance_prompt(self, article: Dict) -> str:
        """
        Enhanced relevance prompt that considers celebrity's sex and occupations
        """
        occupations_str = ", ".join(self.celebrity['occupation'])
        return f"""Analyze this article's relevance to {self.celebrity['name_eng']}, who is a {self.celebrity['sex']} {occupations_str}.

    Article: {article['title']}
    Content: {article['content']}

    Evaluation criteria:
    1. Does the article specifically mention {self.celebrity['name_eng']} or {self.celebrity['name_kr']}?
    2. Is the article's focus related to their work as {occupations_str}?
    3. Is this about the correct person, considering their sex and occupation?
    4. Does the context match what would be expected for someone in these roles: {occupations_str}?

    Return exactly in this format:
    SCORE: [just a number 1-5, where 5 is most relevant]
    REASON: [brief explanation]"""

    def create_headline_prompt(self, article: Dict) -> str:
        """
        Enhanced headline prompt that incorporates occupations
        """
        occupations_str = ", ".join(self.celebrity['occupation'])
        return f"""Create a headline and subheading for this article about {self.celebrity['name_eng']}, who works as {occupations_str}.
    Content: {article['content']}

Requirements:
- Include "{self.celebrity['name_eng']}" in both the headline and subheading
- Make the headline compelling and attention-grabbing
- Make the subheading provide additional context
- Keep the celebrity's name natural in the text, not forced
- Consider their roles as {occupations_str} in the framing

Return exactly:
HEADLINE: (compelling headline with {self.celebrity['name_eng']})
SUBHEADING: (one clear sentence with {self.celebrity['name_eng']} and context)"""

    def create_category_prompt(self, article: Dict) -> str:
        return f"""Categorize this article about {self.celebrity['name_eng']}.
Headline: {article['headline']}
Subheading: {article['subheading']}

Choose from categories:
- Music (Album Release, Collaboration, Performance, Tour/concert, Music Awards)
- Acting (Drama/Series, Film, OTT, Film/TV/drama Awards, Variety show)
- Promotion (Fan meeting, Media appearance, Social media, Interviews, Brand activities)
- Social (Donation, Helath/diet, Daily fasion, Airport fashion, Family, Friends/companion, Marriage/relationship, Pets, Company/representation, Political stance, Social Recognition, Real estate)
- Controversy (Plagiarism, Romance, Political Controversy)

Return exactly:
CATEGORY: (main category)
SUBCATEGORY: (specific subcategory)
REASON: (brief explanation)"""


    # extracting data
    def extract_relevance_score(self, response: str) -> float:
        """Extract the relevance score from Claude's response"""
        try:
            score_line = next(
                (line for line in response.split("\n") if line.startswith("SCORE:")),
                None,
            )
            if not score_line:
                return 0.0
            score_str = score_line.replace("SCORE:", "").strip()
            return float(score_str)
        except Exception as e:
            print(f"Error extracting relevance score: {str(e)}")
            return 0.0

    def extract_relevance_reason(self, response: str) -> str:
        """Extract the relevance reason from Claude's response"""
        try:
            reason_line = next(
                (line for line in response.split("\n") if line.startswith("REASON:")),
                None,
            )
            if not reason_line:
                return ""
            return reason_line.replace("REASON:", "").strip()
        except Exception as e:
            print(f"Error extracting relevance reason: {str(e)}")
            return ""

    def extract_headline_data(self, response: str) -> Dict[str, str]:
        """Extract headline and subheading from Claude's response"""
        try:
            lines = response.split("\n")
            headline = next(
                (
                    line.replace("HEADLINE:", "").strip()
                    for line in lines
                    if line.startswith("HEADLINE:")
                ),
                "",
            )
            subheading = next(
                (
                    line.replace("SUBHEADING:", "").strip()
                    for line in lines
                    if line.startswith("SUBHEADING:")
                ),
                "",
            )
            return {"headline": headline, "subheading": subheading}
        except Exception as e:
            print(f"Error extracting headline data: {str(e)}")
            return {"headline": "", "subheading": ""}

    def extract_category_data(self, response: str) -> Dict[str, str]:
        """Extract category data from Claude's response"""
        try:
            lines = response.split("\n")
            category = next(
                (
                    line.replace("CATEGORY:", "").strip()
                    for line in lines
                    if line.startswith("CATEGORY:")
                ),
                "",
            )
            subcategory = next(
                (
                    line.replace("SUBCATEGORY:", "").strip()
                    for line in lines
                    if line.startswith("SUBCATEGORY:")
                ),
                "",
            )
            reason = next(
                (
                    line.replace("REASON:", "").strip()
                    for line in lines
                    if line.startswith("REASON:")
                ),
                "",
            )
            return {
                "category": category,
                "subcategory": subcategory,
                "category_reason": reason,
            }
        except Exception as e:
            print(f"Error extracting category data: {str(e)}")
            return {"category": "", "subcategory": "", "category_reason": ""}


    # process data
    async def process_celebrity(self):
        """Process a single celebrity's news with incremental updates"""
        try:
            # First fetch existing document IDs
            await self.fetch_existing_doc_ids()
            
            # Crawl for new articles
            articles = await self.crawl_websites()
            if not articles:
                print(f"No new articles found for {self.celebrity['name_eng']}")
                return

            # Process only new articles
            relevant_df = await self.analyze_relevance(articles)
            if relevant_df.empty:
                print(f"No relevant new articles found for {self.celebrity['name_eng']}")
                return

            headlines_df = await self.generate_headlines(relevant_df)
            final_df = await self.categorize_articles(headlines_df)
            
            # Upload new articles to Firebase
            await self.upload_to_firebase(final_df)
            
            print(f"Successfully processed new articles for {self.celebrity['name_eng']}")
            
        except Exception as e:
            print(f"Error processing {self.celebrity['name_eng']}: {str(e)}")


    # upload to firebase
    async def upload_batch_with_retry(self, batch, max_retries=3, initial_delay=1):
        """Upload a batch to Firebase with exponential backoff retry logic"""
        for attempt in range(max_retries):
            try:
                await asyncio.to_thread(batch.commit)
                return True
            except Exception as e:
                if attempt == max_retries - 1:
                    print(f"Failed to upload batch after {max_retries} attempts: {str(e)}")
                    return False
                
                delay = initial_delay * (2 ** attempt) + random.uniform(0, 1)
                print(f"Batch upload failed, retrying in {delay:.2f}s... (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(delay)
        
        return False
    
    async def upload_to_firebase(self, df: pd.DataFrame):
        """Upload new articles to Firebase with improved structure - using separate news collection"""
        if df.empty:
            print("No new articles to upload")
            return

        BATCH_SIZE = 450  # Slightly reduced from 500 to provide safety margin
        total_uploaded = 0
        total_failed = 0
        
        for start_idx in range(0, len(df), BATCH_SIZE):
            batch = self.db.batch()
            batch_df = df.iloc[start_idx:start_idx + BATCH_SIZE]
            batch_docs = []
            
            # Prepare batch
            for _, row in batch_df.iterrows():
                try:
                    doc_id = hashlib.md5(row["url"].encode()).hexdigest()
                    if doc_id in self.existing_doc_ids:
                        continue
                        
                    # Changed: Use root-level news collection
                    doc_ref = self.db.collection("news").document(doc_id)
                    
                    doc_data = {
                        "title": row["title"],
                        "content": row["content"],
                        "url": row["url"],
                        "date": firestore.SERVER_TIMESTAMP,
                        "formatted_date": row["date"],
                        "celebrity": self.celebrity_id,
                        "headline": row.get("headline", ""),
                        "subheading": row.get("subheading", ""),
                        "category": row.get("category", ""),
                        "subcategory": row.get("subcategory", ""),
                        "relevance_score": float(row.get("relevance_score", 0)),
                        "created_at": firestore.SERVER_TIMESTAMP,
                        "thumbnail": row.get("thumbnail", ""),
                    }
                    
                    batch.set(doc_ref, doc_data)
                    batch_docs.append(doc_id)
                    
                except Exception as e:
                    print(f"Error preparing document: {str(e)}")
                    continue
            
            if batch_docs:
                # Attempt to upload batch
                if await self.upload_batch_with_retry(batch):
                    total_uploaded += len(batch_docs)
                    # Update existing_doc_ids only after successful upload
                    self.existing_doc_ids.update(batch_docs)
                    print(f"Successfully uploaded batch of {len(batch_docs)} articles")
                else:
                    total_failed += len(batch_docs)
                    print(f"Failed to upload batch of {len(batch_docs)} articles")
            
            # Add delay between batches to avoid overwhelming Firebase
            await asyncio.sleep(1)
        
        print(f"\nUpload Summary for {self.celebrity['name_eng']}:")
        print(f"- Successfully uploaded: {total_uploaded}")
        print(f"- Failed to upload: {total_failed}")
        print(f"- Total processed: {total_uploaded + total_failed}")

async def main():
    try:
        # Create a temporary instance just to get a db connection
        temp_processor = IncrementalNewsProcessor({"name_eng": "temp", "name_kr": "temp", "sex": "temp", "occupation": ["temp"]})
        db = temp_processor.db
        
        # Fetch all celebrities data
        celebrities = await IncrementalNewsProcessor.fetch_all_celebrities(db)
        
        if not celebrities:
            raise ValueError("No celebrities found in database")
            
        print(f"Found {len(celebrities)} celebrities to process")
        
        # Process each celebrity
        for celebrity_data in celebrities:
            processor = IncrementalNewsProcessor(celebrity_data)
            await processor.process_celebrity()
                
    except Exception as e:
        print(f"Error in main process: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main())