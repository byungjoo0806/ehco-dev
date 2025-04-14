import asyncio
from datetime import datetime, timedelta
import pandas as pd
from typing import List, Dict, Optional, Set
import os
import firebase_admin
from firebase_admin import credentials, firestore
from playwright.async_api import async_playwright
import hashlib
from dotenv import load_dotenv
from pathlib import Path
import random
from dataclasses import dataclass
import time
from openai import OpenAI
from aiolimiter import AsyncLimiter
import logging
from google.api_core.retry import Retry
from google.api_core import exceptions
import asyncio


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
        self.setup_deepseek()
        self.db = self.setup_firebase()
        self.rate_limiter = AsyncLimiter(
            max_rate=40,        # 40 requests
            time_period=60.0    # per 60 seconds (must be float)
        )
        self.last_request_time = 0  # Tracks the last API call timestamp
        self.BATCH_SIZE = 15  # New class variable for batch size
        
    async def call_api(self, prompt: str) -> Optional[str]:
        """Wrapper for DeepSeek API calls with rate limiting and retries."""
        async with self.rate_limiter:
            try:
                # Enforce minimum 1-second gap between requests
                now = time.time()
                if now - self.last_request_time < 1.0:
                    await asyncio.sleep(1.0 - (now - self.last_request_time))
                
                self.last_request_time = time.time()
                
                response = await asyncio.to_thread(
                    self.client.chat.completions.create,
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=1000
                )
                
                if not response or not hasattr(response, 'choices') or not response.choices:
                    logging.error("Invalid API response structure - missing choices")
                    return None
                    
                if not hasattr(response.choices[0], 'message') or not hasattr(response.choices[0].message, 'content'):
                    logging.error("Invalid API response structure - missing message content")
                    return None
                
                return response.choices[0].message.content
            
            except Exception as e:
                # Get response info if available
                response_info = {
                    'type': type(response).__name__ if 'response' in locals() else 'No response',
                    'attrs': dir(response) if 'response' in locals() else None,
                    'error': str(e)
                }
                
                logging.error("API call failed with details:", extra={'response_info': response_info})
                
                # For debugging during development
                print(f"\nDEBUG - API Error Details:")
                print(f"Error Type: {type(e).__name__}")
                print(f"Response Object Type: {response_info['type']}")
                if response_info['attrs']:
                    print("Available Attributes:", ", ".join(response_info['attrs']))
                
                return None

    def normalize_url(self, url: str) -> str:
        """Standardizes URLs for deduplication."""
        url = url.lower().strip()
        # Remove common variations
        url = url.replace("https://", "").replace("http://", "")
        url = url.rstrip("/")
        return url

    def setup_deepseek(self):
        """Initialize DeepSeek API client using OpenAI-compatible SDK"""
        load_dotenv()
        api_key = os.getenv('DEEPSEEK_API_KEY')  # Make sure to set this in your .env
        
        if not api_key:
            raise ValueError("DEEPSEEK_API_KEY not found in environment variables")
        
        # Initialize DeepSeek client (OpenAI-compatible)
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"  # DeepSeek's API endpoint
        )
        self.model = "deepseek-chat"  # or "deepseek-v3" if available
        
        print("✓ DeepSeek client initialized successfully")

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
            
            # Normalize URL before checking duplicates
            normalized_url = self.normalize_url(article_data["url"])
            if normalized_url in self.seen_urls:
                return None
            self.seen_urls.add(normalized_url)

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
        """Crawl articles from Korea Herald with improved error handling and retry logic"""
        print(f"Starting Korea Herald crawl for {self.celebrity['name_eng']}...")
        articles = []
        current_page = 1
        empty_pages = 0
        max_empty_pages = 3
        max_retries = 3
        keyword = self.celebrity["name_eng"].replace(" ", "+")
        base_url = f"https://www.koreaherald.com/search/detail?q={keyword}&stype=NEWS"

        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            )

            try:
                while empty_pages < max_empty_pages:
                    page = await context.new_page()
                    page_url = (
                        base_url
                        if current_page == 1
                        else f"{base_url}&page={current_page}"
                    )
                    print(f"Processing KH page {current_page}")

                    # Implement retry logic for page loading
                    for attempt in range(max_retries):
                        try:
                            # Use a shorter initial timeout
                            await page.goto(page_url, timeout=15000)

                            # Wait for content with progressive timeouts
                            try:
                                await page.wait_for_selector(".news_list", timeout=5000)
                            except:
                                # If quick load fails, try waiting longer
                                await page.wait_for_selector(
                                    ".news_list", timeout=20000
                                )

                            # Add small delay for content to stabilize
                            await page.wait_for_timeout(1000)
                            break

                        except Exception as e:
                            print(f"Attempt {attempt + 1} failed: {str(e)}")
                            if attempt < max_retries - 1:
                                # Exponential backoff between retries
                                wait_time = (2**attempt) + random.uniform(1, 3)
                                print(
                                    f"Waiting {wait_time:.2f} seconds before retry..."
                                )
                                await asyncio.sleep(wait_time)
                                continue
                            else:
                                print(
                                    f"Failed to load page {current_page} after {max_retries} attempts"
                                )
                                empty_pages += 1
                                break

                    try:
                        article_elements = await page.query_selector_all(
                            ".news_list li"
                        )
                        if not article_elements:
                            empty_pages += 1
                            await page.close()
                            current_page += 1
                            continue

                        for article in article_elements:
                            article_data = await self.parse_koreaherald_article(article)
                            if article_data:
                                articles.append(article_data)

                        print(
                            f"Found {len(article_elements)} articles on page {current_page}"
                        )

                        # Add random delay between pages to avoid rate limiting
                        await asyncio.sleep(random.uniform(2, 4))
                        current_page += 1

                    finally:
                        await page.close()  # Close page after processing

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
            
            # Normalize URL before checking duplicates
            normalized_url = self.normalize_url(article_data["url"])
            if normalized_url in self.seen_urls:
                return None
            self.seen_urls.add(normalized_url)

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
            
            # Normalize URL before checking duplicates
            normalized_url = self.normalize_url(article_data["url"])
            if normalized_url in self.seen_urls:
                return None
            self.seen_urls.add(normalized_url)

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

                            # Check relevance immediately using Deepseek
                            prompt = self.create_relevance_prompt(full_article)
                            response = await self.call_api(prompt)
                            if not response:
                                print(f"Skipping article due to API error")
                                continue
                            
                            print(f"API Response Type: {type(response)}")  # Should be <class 'openai.types.chat.ChatCompletion'>

                            if not response:
                                print(f"No response from Deepseek for article {idx + 1}")
                                continue

                            try:
                                relevance_score = self.extract_relevance_score(response)
                                relevance_reason = self.extract_relevance_reason(response)
                            except Exception as e:
                                print(f"Failed to parse response for article {idx + 1}: {str(e)}")
                                print(f"Response content: {response[:200]}...")  # Print first 200 chars for debugging
                                continue

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
        crawlers = [
            self.crawl_korea_herald(),
            self.crawl_yonhap(),
            self.crawl_joongang()
        ]
        results = await asyncio.gather(*crawlers, return_exceptions=True)
        return [article for sublist in results if not isinstance(sublist, Exception) for article in sublist]

    def is_article_relevant(self, response_text: str) -> bool:
        """Determine if an article is relevant based on Deepseek's response"""
        if not response_text:
            return False
        
        try:
            # Extract score from response
            score_line = next(
                (line for line in response_text.split("\n") if line.startswith("SCORE:")),
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

    def extract_relevance_score(self, response_text: str) -> float:
        """Extract the relevance score from Deepseek's response"""
        if not response_text:
            return 0.0
        try:
            score_line = next(
                (line for line in response_text.split("\n") if line.startswith("SCORE:")),
                None,
            )
            if not score_line:
                return 0.0
            score_str = score_line.replace("SCORE:", "").strip()
            return float(score_str)
        except Exception as e:
            print(f"Error extracting relevance score: {str(e)}")
            return 0.0

    def extract_relevance_reason(self, response_text: str) -> str:
        """Extract the relevance reason from Deepseek's response"""
        if not response_text:
            return ""
        
        try:
            reason_line = next(
                (line for line in response_text.split("\n") if line.startswith("REASON:")),
                None,
            )
            if not reason_line:
                return ""
            return reason_line.replace("REASON:", "").strip()
        except Exception as e:
            print(f"Error extracting relevance reason: {str(e)}")
            return ""

    def extract_headline_data(self, response_text: str) -> Dict[str, str]:
        """Extract headline and subheading from Deepseek's response"""
        if not response_text:
            return {"headline": "", "subheading": ""}
        
        try:
            lines = response_text.split("\n")
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

    def extract_category_data(self, response_text: str) -> Dict[str, str]:
        """Extracts and validates category data against allowed categories."""
        if not response_text:
            return {"category": "", "subcategory": "", "category_reason": ""}
        
        try:
            lines = response_text.split("\n")
            category = next(
                (line.replace("CATEGORY:", "").strip() 
                for line in lines if line.startswith("CATEGORY:")),
                ""
            )
            subcategory = next(
                (line.replace("SUBCATEGORY:", "").strip() 
                for line in lines if line.startswith("SUBCATEGORY:")),
                ""
            )
            reason = next(
                (line.replace("REASON:", "").strip() 
                for line in lines if line.startswith("REASON:")),
                ""
            )

            # Validation against allowed categories
            allowed_categories = ["Music", "Acting", "Promotion", "Social", "Controversy"]
            allowed_subcategories = {
                "Music": ["Album Release", "Collaboration", "Performance", "Tour/concert", "Music Awards"],
                "Acting": ["Drama/Series", "Film", "OTT", "Film/TV/drama Awards", "Variety show"],
                "Promotion": ["Fan meeting", "Media appearance", "Social media", "Interviews", "Brand activities"],
                "Social" : ["Donation", "Helath/diet", "Daily fasion", "Airport fashion", "Family", "Friends/companion", "Marriage/relationship", "Pets", "Company/representation", "Political stance", "Social Recognition", "Real estate"],
                "Controversy" : ["Plagiarism", "Romance", "Political Controversy"]
            }

            # Validate category
            if category not in allowed_categories:
                category = "General"
                reason = f"Invalid category, defaulted to General. Original: {category}"

            # Validate subcategory
            if category in allowed_subcategories:
                if subcategory not in allowed_subcategories[category]:
                    subcategory = "General"
                    reason = f"Invalid subcategory for {category}, defaulted to General. Original: {subcategory}"

            return {
                "category": category,
                "subcategory": subcategory,
                "category_reason": reason
            }

        except Exception as e:
            print(f"Error extracting category data: {str(e)}")
            return {
                "category": "General",
                "subcategory": "General",
                "category_reason": f"Error: {str(e)}"
            }

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
                responses = await self.batch_deepseek_call(prompts)  # Fixed here

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
        """Generate headlines and subheadings using Deepseek API (Step 5)"""
        articles_with_headlines = []

        for batch in self.batch_articles(df.to_dict("records"), self.BATCH_SIZE):
            print(
                f"Processing batch of {len(batch)} articles for headline generation..."
            )
            prompts = [self.create_headline_prompt(article) for article in batch]
            responses = await self.batch_deepseek_call(prompts)  # Fixed here

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
        categorized_articles = []
        for batch in self.batch_articles(df.to_dict("records"), self.BATCH_SIZE):
            print(
                f"Processing batch of {len(batch)} articles for categorization..."
            )
            prompts = [self.create_category_prompt(article) for article in batch]
            responses = await self.batch_deepseek_call(prompts)

            for article, response in zip(batch, responses):
                if response:
                    # This now uses the validated version
                    category_data = self.extract_category_data(response)  
                    categorized_articles.append({**article, **category_data})

        return pd.DataFrame(categorized_articles)

    async def upload_to_firebase(self, df: pd.DataFrame):
        """Upload to Firebase with improved batching and error handling"""
        # Create retry policy
        retry = Retry(
            initial=1.0,          # First retry after 1 second
            maximum=10.0,         # Maximum retry delay
            multiplier=2.0,       # Exponential backoff multiplier
            deadline=30.0,        # Total time limit for retries
        )

        for start_idx in range(0, len(df), 500):
            batch_size = min(500, len(df) - start_idx)
            print(f"📤 Uploading batch {start_idx}-{start_idx+batch_size} of {len(df)}")
            
            batch = self.db.batch()
            batch_df = df.iloc[start_idx : start_idx + batch_size]

            for _, row in batch_df.iterrows():
                doc_ref = self.db.collection("news-test").document(
                    hashlib.md5(row["url"].encode()).hexdigest()
                )
                batch.set(doc_ref, {
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
                })

            try:
                # Correct approach for async Firestore
                await asyncio.get_event_loop().run_in_executor(
                    None,  # Uses default ThreadPoolExecutor
                    lambda: retry(batch.commit)()
                )
            except exceptions.RetryError as e:
                print(f"❌ Failed batch after retries: {str(e)}")
            except Exception as e:
                print(f"❌ Non-retriable error: {str(e)}")
            else:
                print(f"✅ Successfully uploaded {batch_size} documents")

    # Helper methods
    def batch_articles(self, articles: List[Dict], batch_size: int):
        """Yield batches of articles"""
        for i in range(0, len(articles), batch_size):
            yield articles[i : i + batch_size]

    async def batch_deepseek_call(self, prompts: List[str]) -> List[Optional[str]]:
        """Process prompts in parallel using the rate-limited call_api with comprehensive error handling."""
        async def process_prompt(prompt: str) -> Optional[str]:
            try:
                async with self.rate_limiter:
                    # Enforce minimum 1-second gap between requests
                    now = time.time()
                    if now - self.last_request_time < 1.0:
                        await asyncio.sleep(1.0 - (now - self.last_request_time))
                    
                    self.last_request_time = time.time()
                    
                    return await self.call_api(prompt)
                    
            except Exception as e:
                logging.error(f"Error processing prompt: {str(e)}")
                return None

        # Process all prompts with error handling
        tasks = []
        for prompt in prompts:
            # Add small random delay (0-0.5s) between task creation to avoid burst
            await asyncio.sleep(random.uniform(0, 0.5))
            tasks.append(process_prompt(prompt))
        
        try:
            # Use asyncio.gather with return_exceptions to capture all results
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results and handle exceptions
            processed_results = []
            for result in results:
                if isinstance(result, Exception):
                    logging.error(f"API call failed: {str(result)}")
                    processed_results.append(None)
                else:
                    processed_results.append(result)
            
            return processed_results
            
        except Exception as e:
            logging.error(f"Batch processing failed: {str(e)}")
            return [None] * len(prompts)

    # Prompt creation methods
    def create_relevance_prompt(self, article: Dict) -> str:
        """
        Relevance prompt that considers celebrity's sex and occupations
        """
        occupations_str = ", ".join(self.celebrity["occupation"])
        return f"""Analyze this article's relevance to {self.celebrity['name_eng']}, who is a {self.celebrity['sex']} {occupations_str}.

    Article: {article['title']}
    Content: {article['content']}

    Evaluation criteria:
    1. Does the article specifically mention {self.celebrity['name_eng']} or {self.celebrity['name_kr']}?
    2. Is the article's focus related to their work as {occupations_str}?
    3. Is this about the correct person, considering their sex and occupation?
    4. Does the context match what would be expected for {occupations_str}?

    Return exactly:
    SCORE: (1-5, where 5 is most relevant)
    REASON: (brief explanation)"""

    def create_headline_prompt(self, article: Dict) -> str:
        """
        Enhanced headline prompt that incorporates occupation
        """
        occupations_str = ", ".join(self.celebrity["occupation"])
        return f"""Create a headline and subheading for this article about {self.celebrity['name_eng']}, a {occupations_str}.
Content: {article['content']}

Requirements:
- Include "{self.celebrity['name_eng']}" in both the headline and subheading
- Make the headline compelling and attention-grabbing
- Make the subheading provide additional context
- Keep the celebrity's name natural in the text, not forced
- Consider their role as a {occupations_str} in the framing

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
            "occupation": ["Actor", "Model", "Singer"],
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
