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


@dataclass
class ArticleSchema:
    """Schema for article validation with extended fields"""

    url: str
    title: str
    content: str
    date: str
    thumbnail: str = ""
    source: str = ""
    celebrity: str = ""
    # New fields for article analysis
    relevance_score: float = 0.0
    relevance_reason: str = ""
    headline: str = ""
    subheading: str = ""
    category: str = ""
    subcategory: str = ""
    category_reason: str = ""


class NewsProcessor:
    def __init__(self, celebrity: Dict[str, str]):
        """
        Initialize with expanded celebrity information
        Expected format:
        {
            "name_eng": str,
            "name_kr": str,
            "sex": str,  # "Male" or "Female"
            "occupation": List[str],  # e.g. ["Actor", "Director", "Producer"]
        }
        """
        self.celebrity = celebrity
        self.celebrity_id = (
            celebrity["name_eng"].lower().replace(" ", "").replace("-", "")
        )
        # Add output directory setup
        self.output_dir = Path("crawled_data") / self.celebrity_id
        # Create output directory if it doesn't exist
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.seen_urls: Set[str] = set()
        self.total_tokens = 0
        self.raw_articles = []  # Initialize the raw_articles list
        self.setup_anthropic()
        self.db = self.setup_firebase()
        self.rate_limiter = asyncio.Semaphore(
            3
        )  # Increased from 3 to 5 for larger batches
        self.BATCH_SIZE = 20  # New class variable for batch size
        self.REQUESTS_PER_MINUTE = 45  # Keep below the 50/minute limit to be safe

    def setup_anthropic(self):
        load_dotenv()
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
        self.client = Anthropic(api_key=api_key)
        self.model = "claude-3-5-sonnet-20241022"

    def setup_firebase(self):
        """Initialize Firebase with environment variables and proper error handling"""
        # Load environment variables
        load_dotenv()

        try:
            # Get configuration from environment variables
            config_path = os.getenv("FIREBASE_CONFIG_PATH")
            database_url = os.getenv("FIREBASE_DEFAULT_DATABASE_URL")

            if not config_path:
                raise ValueError(
                    "FIREBASE_CONFIG_PATH not found in environment variables"
                )
            if not database_url:
                raise ValueError(
                    "FIREBASE_DATABASE_URL not found in environment variables"
                )
            if not os.path.exists(config_path):
                raise FileNotFoundError(
                    f"Service account key not found at: {config_path}"
                )

            try:
                # Try to initialize with specific database
                cred = credentials.Certificate(config_path)
                firebase_admin.initialize_app(cred, {"databaseURL": database_url})
                print("Firebase initialized successfully with specific database")
            except ValueError as e:
                if "The default Firebase app already exists" in str(e):
                    print("Using existing Firebase app")
                else:
                    raise e

            try:
                # Get client with specific database
                db = firestore.Client.from_service_account_json(config_path)
                print("Firestore client connected successfully to specified database")
                return db
            except Exception as e:
                print(f"Failed to get Firestore client: {e}")
                raise

        except Exception as e:
            print(f"Failed to initialize Firebase: {e}")
            raise

    def validate_article(self, article: Dict) -> bool:
        """Validate article against schema"""
        try:
            ArticleSchema(**article)
            return True
        except Exception as e:
            print(f"Article validation failed: {str(e)}")
            return False

    async def parse_koreaherald_article(self, article) -> Optional[Dict]:
        try:
            # Using evaluate to get element properties with improved validation
            article_data = await article.evaluate(
                """(article) => {
                const link = article.querySelector('a');
                const title = article.querySelector('.news_title');
                const date = article.querySelector('.date');
                const img = article.querySelector('.news_img img');
                const content = article.querySelector('.news_text');
                // Basic validation inside JS context
                if (!link || !title) {
                    return null;
                }
                const data = {
                    url: link.href || '',
                    title: title.textContent.trim(),
                    date: date ? date.textContent.trim() : '',
                    thumbnail: img ? img.src : '',
                    content: content ? content.textContent.trim() : ''
                };
                // Additional validation
                if (!data.title || !data.url) {
                    return null;
                }
                return data;
            }"""
            )
            # Return early if evaluation returned null
            if not article_data:
                return None

            # Handle relative URLs
            if not article_data["url"].startswith("http"):
                article_data["url"] = (
                    "https://www.koreaherald.com" + article_data["url"]
                )

            # Check for duplicate URLs
            if article_data["url"] in self.seen_urls:
                return None
            self.seen_urls.add(article_data["url"])

            # Convert date format from "2021.10.05 18:42" to "2021-10-05"
            try:
                if article_data["date"]:
                    # Split at space to remove time portion and split date by dots
                    date_part = article_data["date"].split()[0]
                    year, month, day = date_part.split(".")
                    # Format as YYYY-MM-DD
                    article_data["date"] = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                else:
                    # If no date is found, use current date
                    article_data["date"] = datetime.now().strftime("%Y-%m-%d")
            except Exception as e:
                print(f"Date parsing error: {str(e)}")
                article_data["date"] = datetime.now().strftime("%Y-%m-%d")

            # Ensure content exists
            if not article_data["content"]:
                article_data["content"] = article_data["title"]

            # Add celebrity ID
            article_data["celebrity"] = self.celebrity_id

            # Add to raw articles list
            self.raw_articles.append(article_data)
            return article_data
        except Exception as e:
            print(f"Parse error for article: {str(e)}")
            return None

    async def crawl_korea_herald(self):
        """Crawl articles from Korea Herald"""
        print(f"Starting Korea Herald crawl for {self.celebrity['name_eng']}...")
        articles = []
        current_page = 1
        empty_pages = 0
        max_empty_pages = 3
        keyword = self.celebrity["name_eng"].replace(" ", "+")
        base_url = f"https://www.koreaherald.com/search/detail?q={keyword}&stype=NEWS"

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()

            try:
                while empty_pages < max_empty_pages:
                    page_url = (
                        base_url
                        if current_page == 1
                        else f"{base_url}&page={current_page}"
                    )
                    print(f"Processing KH page {current_page}")

                    try:
                        await page.goto(page_url, wait_until="networkidle")
                        await page.wait_for_selector(".news_list", timeout=10000)
                    except Exception as e:
                        print(f"Page load error: {str(e)}")
                        empty_pages += 1
                        continue

                    article_elements = await page.query_selector_all(".news_list li")
                    if not article_elements:
                        empty_pages += 1
                        current_page += 1
                        continue

                    for article in article_elements:
                        article_data = await self.parse_koreaherald_article(article)
                        if article_data:
                            articles.append(article_data)

                    print(
                        f"Found {len(article_elements)} articles on page {current_page}"
                    )
                    current_page += 1
                    await asyncio.sleep(2)

            finally:
                await context.close()
                await browser.close()

        return articles

    async def parse_yonhap_article(self, article) -> Optional[Dict]:
        """Parse article data from Yonhap News based on specific DOM structure"""
        try:
            # Use evaluate to get all needed data in one JS call for better performance
            article_data = await article.evaluate(
                """(article) => {
                // 1. Get URL from figure > a
                const figureLink = article.querySelector('figure > a');
                const url = figureLink ? figureLink.href : null;
                
                // 2. Get image URL from figure > a > img
                const img = figureLink ? figureLink.querySelector('img') : null;
                const thumbnail = img ? img.src : '';
                
                // 3. Get title from div.txt-con > h2.tit > a
                const titleLink = article.querySelector('div.txt-con > h2.tit > a');
                const title = titleLink ? titleLink.textContent.trim() : null;
                
                // 4. Get content from span.lead
                const leadSpan = article.querySelector('span.lead');
                const content = leadSpan ? leadSpan.textContent.trim() : '';
                
                // 5. Get date from span.date.datefm-EN01
                const dateSpan = article.querySelector('span.date.datefm-EN01');
                const date = dateSpan ? dateSpan.textContent.trim() : null;
                
                return {
                    url,
                    thumbnail,
                    title,
                    content,
                    date
                };
            }"""
            )

            if not article_data or not article_data["url"] or not article_data["title"]:
                return None

            # Format the date
            # Input format example: "15:46 Sep. 25"
            try:
                # Extract year from URL (AEN[YYYY]) or use current year
                year = None
                if "AEN" in article_data["url"]:
                    year = article_data["url"].split("AEN")[1][:4]
                if not year:
                    year = str(datetime.now().year)

                # Parse the date string
                date_parts = article_data["date"].split()
                # Remove any trailing periods from month abbreviation
                month = date_parts[1].replace(".", "").strip()
                day = date_parts[2].strip()

                # Convert to datetime and format
                date_str = f"{month} {day} {year}"
                formatted_date = datetime.strptime(date_str, "%b %d %Y").strftime(
                    "%Y-%m-%d"
                )
            except Exception as e:
                print(f"Date parsing error: {e}")
                formatted_date = datetime.now().strftime("%Y-%m-%d")

            return {
                "url": article_data["url"],
                "title": article_data["title"],
                "content": article_data["content"],
                "thumbnail": article_data["thumbnail"],
                "date": formatted_date,
                "source": "Yonhap News",
                "celebrity": self.celebrity_id,
            }

        except Exception as e:
            print(f"Error parsing Yonhap article: {str(e)}")
            return None

    async def crawl_yonhap(self):
        """Crawl articles from Yonhap News with improved page loading strategy"""
        print(f"Starting Yonhap crawl for {self.celebrity['name_eng']}...")
        articles = []
        current_page = 1
        max_pages = 50

        # Keep original case and use %20 for spaces
        keyword = self.celebrity["name_eng"].replace(" ", "%20")
        base_url = f"https://en.yna.co.kr/search/index?query={keyword}&ctype=A&lang=EN"

        async with async_playwright() as playwright:
            # Launch browser with more realistic settings
            browser = await playwright.chromium.launch(
                headless=True,
            )
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            )

            # Add longer timeout and more realistic page settings
            page = await context.new_page()
            page.set_default_timeout(30000)  # 30 seconds timeout

            try:
                while current_page <= max_pages:
                    page_url = (
                        f"{base_url}&page_no={current_page}"
                        if current_page > 1
                        else base_url
                    )
                    print(page_url)
                    print(f"Processing Yonhap page {current_page}")

                    try:
                        # More robust page loading strategy
                        await page.goto(page_url, wait_until="domcontentloaded")

                        # Wait for initial load
                        print("Waiting for initial page load...")
                        await page.wait_for_selector(
                            ".smain-list-type01", timeout=20000
                        )

                        # Add a small delay to allow dynamic content to load
                        await page.wait_for_timeout(2000)

                        # Check if we can find the article elements
                        print("Checking for articles...")
                        article_elements = await page.query_selector_all("li article")

                        if not article_elements:
                            # Try one more time with network idle
                            print("No articles found, waiting for network idle...")
                            await page.wait_for_load_state("networkidle")
                            await page.wait_for_timeout(2000)
                            article_elements = await page.query_selector_all(
                                "li article"
                            )

                        print(f"Found {len(article_elements)} article elements")

                        if not article_elements:
                            print("No articles found on this page after retries")
                            break

                        articles_processed = 0
                        for article in article_elements:
                            article_data = await self.parse_yonhap_article(article)
                            if article_data:
                                articles.append(article_data)
                                articles_processed += 1

                        print(
                            f"Successfully processed {articles_processed} articles on page {current_page}"
                        )

                        if articles_processed == 0:
                            break

                        # Add a delay between pages
                        await page.wait_for_timeout(2000)
                        current_page += 1

                    except Exception as e:
                        print(f"Error processing page {current_page}: {str(e)}")
                        # Log the current page state for debugging
                        try:
                            content = await page.content()
                            print(f"Page HTML preview: {content[:500]}...")
                        except:
                            pass
                        break

            finally:
                await context.close()
                await browser.close()

        print(f"Completed Yonhap crawl with {len(articles)} articles found")
        return articles

    async def parse_joongang_article(self, article) -> Optional[Dict]:
        """Parse article data from JoongAng Daily"""
        try:
            # Use evaluate to get all needed data in one JS call
            article_data = await article.evaluate(
                """(article) => {
                // Get URL and title
                const link = article.querySelector('.media');
                if (!link) return null;
                
                const url = link.href;
                const title = article.querySelector('.mid-article-title3')?.textContent.trim();
                const date = article.querySelector('.media-date')?.textContent.trim();
                const content = article.querySelector('.mid-article-content3')?.textContent.trim();
                const thumbnail = article.querySelector('img')?.src || '';
                
                if (!url || !title || !date || !content) {
                    return null;
                }
                
                return {
                    url,
                    title,
                    date,
                    content,
                    thumbnail
                };
            }"""
            )

            if not article_data:
                return None

            # Additional processing or validation if needed
            return {
                "title": article_data["title"],
                "url": article_data["url"],
                "date": article_data["date"],
                "content": article_data["content"],
                "thumbnail": article_data["thumbnail"],
                "source": "JoongAng Daily",
                "celebrity": self.celebrity_id,
            }

        except Exception as e:
            print(f"Error parsing JoongAng article: {str(e)}")
            return None

    async def crawl_joongang(self):
        """Crawl articles from JoongAng Daily with real-time relevance checking"""
        print(f"Starting JoongAng crawl for {self.celebrity['name_eng']}...")
        articles = []
        irrelevant_streak = 0  # Track consecutive irrelevant articles
        max_irrelevant_streak = (
            3  # Stop after this many consecutive irrelevant articles
        )

        keyword = self.celebrity["name_eng"].replace(" ", "%2520")
        base_url = (
            f"https://koreajoongangdaily.joins.com/section/searchResult/{keyword}?"
        )
        print(f"Using URL: {base_url}")

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            page = await context.new_page()

            try:
                # Initial page load
                await page.goto(base_url, wait_until="domcontentloaded", timeout=60000)
                await page.wait_for_selector(".mid-article3", timeout=20000)
                await page.wait_for_timeout(3000)

                while True:
                    # Get current set of articles
                    current_articles = await page.query_selector_all("div.mid-article3")
                    current_count = len(current_articles)

                    # Process only new articles
                    start_idx = len(articles)
                    for idx in range(start_idx, current_count):
                        try:
                            article = current_articles[idx]

                            # Extract article data
                            article_data = await article.evaluate(
                                """(article) => {
                                const link = article.querySelector('a.media');
                                const img = article.querySelector('span.img-mask-wrap img');
                                const title = article.querySelector('.mid-article-title3');
                                const content = article.querySelector('.mid-article-content3');
                                const dateSpan = article.querySelector('.media-date span:last-child');
                                
                                if (!link || !title) return null;
                                
                                return {
                                    url: link.href,
                                    title: title.textContent.trim(),
                                    content: content ? content.textContent.trim() : title.textContent.trim(),
                                    thumbnail: img ? img.src : '',
                                    date: dateSpan ? dateSpan.textContent.trim() : ''
                                };
                            }"""
                            )

                            if not article_data:
                                continue

                            # Check for duplicate URL
                            if article_data["url"] in {a["url"] for a in articles}:
                                continue

                            # Add source and celebrity info
                            full_article = {
                                **article_data,
                                "source": "JoongAng Daily",
                                "celebrity": self.celebrity_id,
                            }

                            # Check relevance immediately using Claude
                            prompt = self.create_relevance_prompt(full_article)
                            response = await asyncio.to_thread(
                                self.client.messages.create,
                                model=self.model,
                                max_tokens=1000,
                                messages=[{"role": "user", "content": prompt}],
                                temperature=0.3,
                            )

                            if not response.content:
                                print(f"No response from Claude for article {idx + 1}")
                                continue

                            relevance_score = self.extract_relevance_score(
                                response.content[0].text
                            )
                            relevance_reason = self.extract_relevance_reason(
                                response.content[0].text
                            )

                            print(
                                f"Article {idx + 1} relevance score: {relevance_score}"
                            )

                            if relevance_score >= 3.0:
                                # Article is relevant
                                full_article["relevance_score"] = relevance_score
                                full_article["relevance_reason"] = relevance_reason
                                articles.append(full_article)
                                irrelevant_streak = 0
                                print(
                                    f"Added relevant article: {full_article['title'][:50]}..."
                                )
                            else:
                                # Article is not relevant
                                irrelevant_streak += 1
                                print(
                                    f"Skipped irrelevant article (streak: {irrelevant_streak})"
                                )

                                if irrelevant_streak >= max_irrelevant_streak:
                                    print(
                                        f"Stopping crawl after {irrelevant_streak} consecutive irrelevant articles"
                                    )
                                    return articles

                        except Exception as e:
                            print(f"Error processing article {idx + 1}: {str(e)}")
                            continue

                    # Try to load more articles if we haven't hit our relevance threshold
                    try:
                        more_button = await page.query_selector(".btn-more")
                        if not more_button or not await more_button.is_visible():
                            print("No more articles to load")
                            break

                        await more_button.click()
                        print("Clicked 'Load More' button")
                        await page.wait_for_timeout(2000)

                        # Verify new articles were loaded
                        new_count = len(
                            await page.query_selector_all("div.mid-article3")
                        )
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

        print(f"Successfully extracted {len(articles)} relevant articles from JoongAng")
        return articles

    async def crawl_websites(self):
        """Crawl articles from multiple websites with improved error handling"""
        articles = []
        seen_urls = set()

        crawlers = [
            ("Korea Herald", self.crawl_korea_herald),
            ("Yonhap", self.crawl_yonhap),
            ("JoongAng", self.crawl_joongang),
        ]

        for source, crawler in crawlers:
            try:
                async with self.rate_limiter:
                    source_articles = await crawler()

                    # Validate and deduplicate articles
                    valid_articles = []
                    for article in source_articles:
                        if (
                            article
                            and self.validate_article(article)
                            and article["url"] not in seen_urls
                        ):
                            seen_urls.add(article["url"])
                            valid_articles.append(article)

                    articles.extend(valid_articles)
                    print(
                        f"Successfully crawled {len(valid_articles)} articles from {source}"
                    )

            except Exception as e:
                print(f"Error crawling {source}: {str(e)}")
                continue

        return articles

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

            # Convert score to float and check if it's above threshold
            score_str = score_line.replace("SCORE:", "").strip()
            score = float(score_str)
            return (
                score >= 3.0
            )  # Articles with score 3 or higher are considered relevant
        except Exception as e:
            print(f"Error checking article relevance: {str(e)}")
            return False

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

    # def filter_recent_articles(self, df: pd.DataFrame, days: int = 30) -> pd.DataFrame:
    #     """
    #     Filter recent articles with validation for YYYY-MM-DD format
    #     Args:
    #         df (pd.DataFrame): DataFrame containing articles with 'date' column
    #         days (int): Number of days to look back from current date
    #     Returns:
    #         pd.DataFrame: Filtered DataFrame containing only recent articles
    #     """
    #     if df.empty:
    #         print("No articles to filter")
    #         return df

    #     try:
    #         # Convert string dates to datetime objects with consistent timezone handling
    #         df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')

    #         # Create cutoff date in the same format
    #         cutoff_date = pd.Timestamp.now().normalize() - pd.Timedelta(days=days)

    #         # Filter and sort
    #         recent_df = df[df['date'] >= cutoff_date].copy()
    #         recent_df = recent_df.sort_values('date', ascending=False)

    #         # Convert dates to string format just once before saving
    #         recent_df['date'] = recent_df['date'].dt.strftime('%Y-%m-%d')

    #         # Save filtered results
    #         output_file = self.output_dir / f'{self.celebrity_id}_recent_articles.csv'
    #         recent_df.to_csv(output_file, index=False)

    #         return recent_df

    #     except Exception as e:
    #         print(f"Error filtering articles: {str(e)}")
    #         return pd.DataFrame()

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

    async def upload_to_firebase(self, df: pd.DataFrame):
        """Upload to Firebase with improved batching and error handling"""
        if df.empty:
            print("No data to upload")
            return

        BATCH_SIZE = 500  # Firebase limitation

        for start_idx in range(0, len(df), BATCH_SIZE):
            batch = self.db.batch()
            batch_df = df.iloc[start_idx : start_idx + BATCH_SIZE]

            try:
                for _, row in batch_df.iterrows():
                    # Validate required fields
                    required_fields = ["title", "content", "url", "date"]
                    if not all(
                        field in row and pd.notna(row[field])
                        for field in required_fields
                    ):
                        print(
                            f"Skipping row due to missing required fields: {row['url']}"
                        )
                        continue

                    doc_id = hashlib.md5(row["url"].encode()).hexdigest()
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
                    }

                    batch.set(doc_ref, doc_data)

                # Commit batch with retry using synchronous operations
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        # Run the synchronous commit in a thread pool to avoid blocking
                        await asyncio.to_thread(batch.commit)
                        print(
                            f"Successfully uploaded batch {start_idx//BATCH_SIZE + 1}"
                        )
                        break
                    except Exception as e:
                        if attempt == max_retries - 1:
                            print(
                                f"Failed to upload batch after {max_retries} attempts: {str(e)}"
                            )
                        else:
                            await asyncio.sleep(2**attempt)  # Exponential backoff

            except Exception as e:
                print(f"Error processing batch: {str(e)}")
                continue

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
        Enhanced relevance prompt that considers celebrity's sex and occupation
        """
        occupations_str = ", ".join(self.celebrity['occupation'])
        return f"""Analyze this article's relevance to {self.celebrity['name_eng']}, who is a {self.celebrity['sex']} {self.celebrity['primary_occupation']} (occupations: {occupations_str}).

Article: {article['title']}
Content: {article['content']}

Evaluation criteria:
1. Does the article specifically mention {self.celebrity['name_eng']} or {self.celebrity['name_kr']}?
2. Is the article's focus related to their work as a {occupations_str}?
3. Is this about the correct person, considering their sex and occupation?
4. Does the context match what would be expected for a {self.celebrity['primary_occupation']}?

Return exactly:
SCORE: (1-5, where 5 is most relevant)
REASON: (brief explanation)"""

    def create_headline_prompt(self, article: Dict) -> str:
        """
        Enhanced headline prompt that incorporates occupation
        """
        return f"""Create a headline and subheading for this article about {self.celebrity['name_eng']}, a {self.celebrity['primary_occupation']}.
Content: {article['content']}

Requirements:
- Include "{self.celebrity['name_eng']}" in both the headline and subheading
- Make the headline compelling and attention-grabbing
- Make the subheading provide additional context
- Keep the celebrity's name natural in the text, not forced
- Consider their role as a {self.celebrity['primary_occupation']} in the framing

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


async def main():
    try:
        celebrity = {
            "name_eng": "Kim Soo-hyun",
            "name_kr": "김수현",
            "sex": "Male",
            "occupation": ["Actor", "Model"],
            "primary_occupation": "Actor",
        }
        processor = NewsProcessor(celebrity)

        # Step 1: Crawl websites with validation
        articles = await processor.crawl_websites()
        if not articles:
            raise ValueError("No articles found")

        # Step 2: Analyze relevance
        relevant_df = await processor.analyze_relevance(articles)
        if relevant_df.empty:
            raise ValueError("No relevant articles found")

        # Steps 3 & 4: Generate headlines and categorize
        # Note: We removed the filter_recent_articles step
        headlines_df = await processor.generate_headlines(relevant_df)
        final_df = await processor.categorize_articles(headlines_df)

        # Step 5: Upload to Firebase
        await processor.upload_to_firebase(final_df)

    except Exception as e:
        print(f"Error in main process: {str(e)}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
