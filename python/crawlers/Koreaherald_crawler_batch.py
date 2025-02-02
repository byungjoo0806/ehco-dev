from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
from datetime import datetime
import time
import os
import hashlib
from anthropic import Anthropic
from dotenv import load_dotenv
from playwright.async_api import async_playwright
import asyncio
from typing import List, Dict, Optional
import random

def initialize_firebase():
    """Initialize Firebase with environment variables and proper error handling"""
    # Load environment variables
    load_dotenv()
    
    try:
        # Get configuration from environment variables
        config_path = os.getenv('FIREBASE_CONFIG_PATH')
        database_url = os.getenv('FIREBASE_DATABASE_URL')
        
        if not config_path:
            raise ValueError("FIREBASE_CONFIG_PATH not found in environment variables")
        if not database_url:
            raise ValueError("FIREBASE_DATABASE_URL not found in environment variables")
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Service account key not found at: {config_path}")
        
        try:
            # Try to initialize with specific database
            cred = credentials.Certificate(config_path)
            firebase_admin.initialize_app(cred, {
                'databaseURL': database_url
            })
            print("Firebase initialized successfully with specific database")
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

class BatchNewsAnalyzer:
    def __init__(self, celebrity_name: str, korean_name: str):
        print(f"Initializing batch analyzer for {celebrity_name}...")
        
        # Load environment variables
        load_dotenv()
        
        try:
            # Get API key from environment variable
            api_key = os.getenv('ANTHROPIC_API_KEY')
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
                
            self.client = Anthropic(api_key=api_key)
            self.model = "claude-3-5-sonnet-20241022"
            self.total_tokens = 0
            print(f"Successfully connected to Anthropic API using {self.model}")
        except Exception as e:
            print(f"Error connecting to Anthropic API: {str(e)}")
            raise

        self.celebrity_name = celebrity_name
        self.korean_name = korean_name
        self.batch_size = 5  # Number of articles to analyze in one batch
        
    async def _call_claude_batch(self, prompts: List[str], max_retries: int = 3) -> List[Optional[str]]:
        """Make batch API calls to Claude with improved error handling and rate limiting"""
        print(f"\n=== BATCH CLAUDE API CALL ({len(prompts)} prompts) ===")
        
        # Add rate limiting
        rate_limit = asyncio.Semaphore(3)  # Limit concurrent requests
        
        async def process_single_prompt(prompt: str, attempt: int = 0) -> Optional[str]:
            async with rate_limit:
                try:
                    # Run the synchronous API call in a thread pool
                    response = await asyncio.to_thread(
                        self.client.messages.create,
                        model=self.model,
                        max_tokens=1000,
                        messages=[{
                            "role": "user",
                            "content": prompt
                        }],
                        temperature=0.3
                    )
                    
                    if not response.content:
                        raise ValueError("Empty response from Claude API")
                    
                    # Track token usage
                    self.total_tokens += (response.usage.input_tokens + response.usage.output_tokens)
                    return response.content[0].text
                    
                except Exception as e:
                    if attempt >= max_retries - 1:
                        print(f"Failed after {max_retries} attempts for prompt: {prompt[:100]}...")
                        print(f"Error: {str(e)}")
                        return None
                        
                    # Exponential backoff with jitter
                    wait_time = min(2 ** attempt + random.uniform(0, 1), 32)
                    print(f"Attempt {attempt + 1} failed, retrying after {wait_time:.2f}s... Error: {str(e)}")
                    await asyncio.sleep(wait_time)
                    return await process_single_prompt(prompt, attempt + 1)

        # Process prompts concurrently
        tasks = [process_single_prompt(prompt) for prompt in prompts]
        results = await asyncio.gather(*tasks)
        
        # Log success rate
        success_count = sum(1 for r in results if r is not None)
        print(f"Batch success rate: {success_count}/{len(prompts)} ({success_count/len(prompts)*100:.1f}%)")
        print(f"Total tokens used: {self.total_tokens}")
        print("=== END BATCH API CALL ===\n")
        
        return results

    async def analyze_articles_batch(self, articles: List[Dict]) -> List[Optional[Dict]]:
        """Analyze multiple articles in batches"""
        if not articles:
            return []

        # Prepare involvement prompts for all articles
        involvement_prompts = []
        for article in articles:
            title = article.get('title', '')
            content = article.get('content', '')
            
            if not title or not content:
                continue
                
            prompt = f"""You are an expert K-entertainment analyst focusing on {self.celebrity_name} ({self.korean_name}).

Analyze this article and determine {self.celebrity_name}'s involvement level:

Article Title: {title}
Article Content: {content}

INVOLVEMENT LEVELS:
LEVEL 1 - PRIMARY FOCUS: {self.celebrity_name} is main subject
LEVEL 2 - SIGNIFICANT MENTION: Key figure in larger event
LEVEL 3 - RELEVANT REFERENCE: Mentioned in context
LEVEL 4 - PERIPHERAL MENTION: Brief/listed mention

Return EXACTLY in this format:
LEVEL: (number 1-4)
REASON: (brief explanation)
TOPIC: (main subject)
POINTS: (key information about {self.celebrity_name})"""
            
            involvement_prompts.append(prompt)

        # Process involvement prompts in batches
        involvement_results = await self._call_claude_batch(involvement_prompts)
        
        # Process category and headlines for relevant articles
        analyzed_articles = []
        
        for idx, (article, involvement_result) in enumerate(zip(articles, involvement_results)):
            if not involvement_result:
                continue
                
            # Parse involvement results
            lines = involvement_result.split('\n')
            level = None
            topic = None
            points = None
            reason = None
            
            for line in lines:
                if line.startswith('LEVEL:'):
                    try:
                        level = int(line.split(':')[1].strip())
                    except:
                        continue
                elif line.startswith('TOPIC:'):
                    topic = line.split(':')[1].strip()
                elif line.startswith('POINTS:'):
                    points = line.split(':')[1].strip()
                elif line.startswith('REASON:'):
                    reason = line.split(':')[1].strip()

            # Skip if not relevant enough
            if not level or level > 3:
                continue

            # Prepare prompts for category and headlines
            category_prompt = f"""As a K-entertainment expert, categorize this Level {level} article about {self.celebrity_name}.
Article Title: {article['title']}
Article Content: {article['content']}
Topic: {topic}
{self.celebrity_name}'s Role: {points}

Choose ONE category: Acting, Music, Promotion, Social, or Controversy
Return EXACTLY:
CATEGORY: (category name)
REASON: (explanation)"""

            headline_prompt = f"""Create a headline and subheading for Level {level} news about {self.celebrity_name}.
Content: {article['content']}
Topic: {topic}

Return EXACTLY:
HEADLINE: (start with "{self.celebrity_name}", max 8 words)
SUBHEADING: (one clear sentence with new context)"""

            # Process category and headline prompts
            results = await self._call_claude_batch([category_prompt, headline_prompt])
            if len(results) != 2:
                continue
                
            category_result, headline_result = results
            
            # Parse category
            category = None
            category_reason = None
            for line in category_result.split('\n'):
                if line.startswith('CATEGORY:'):
                    category = line.split(':')[1].strip()
                elif line.startswith('REASON:'):
                    category_reason = line.split(':')[1].strip()
                    
            if category not in {"Acting", "Music", "Promotion", "Social", "Controversy"}:
                category = "Social"
                category_reason = f"General category assigned after analysis"

            # Parse headline and subheading
            headline = article['title']
            subheading = article['content'][:100] + "..."
            
            for line in headline_result.split('\n'):
                if line.startswith('HEADLINE:'):
                    headline = line.split(':')[1].strip()
                elif line.startswith('SUBHEADING:'):
                    subheading = line.split(':')[1].strip()

            analyzed_articles.append({
                'mainCategory': category,
                'headline': headline,
                'subheading': subheading,
                'involvement_level': level,
                'title': article['title'],
                'content': article['content'],
                'analysis_reason': reason,
                'category_reason': category_reason,
                **article
            })

        return analyzed_articles

class BatchKoreaHeraldCrawler:
    def __init__(self, celebrity: Dict[str, str]):
        self.celebrity = celebrity
        self.keyword = celebrity['name_eng'].replace(" ", "+")
        self.base_url = f"https://www.koreaherald.com/search/detail?q={self.keyword}&stype=NEWS"
        self.processed_articles = []
        self.raw_articles = []
        self.seen_urls = set()
        
        self.celebrity_id = celebrity['name_eng'].lower().replace(" ", "").replace("-", "")
        self.analyzer = BatchNewsAnalyzer(celebrity['name_eng'], celebrity['name_kr'])
        
        # Initialize Firebase
        self.db = initialize_firebase()
        
    async def parse_article(self, article) -> Optional[Dict]:
        try:
            # Using evaluate to get element properties with improved validation
            article_data = await article.evaluate("""(article) => {
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
            }""")

            # Return early if evaluation returned null
            if not article_data:
                return None

            # Handle relative URLs
            if not article_data['url'].startswith('http'):
                article_data['url'] = 'https://www.koreaherald.com' + article_data['url']

            # Check for duplicate URLs
            if article_data['url'] in self.seen_urls:
                return None
            self.seen_urls.add(article_data['url'])

            # Ensure content exists
            if not article_data['content']:
                article_data['content'] = article_data['title']

            # Add celebrity ID
            article_data['celebrity'] = self.celebrity_id

            # Add to raw articles list
            self.raw_articles.append(article_data)

            return article_data

        except Exception as e:
            print(f"Parse error for article: {str(e)}")
            return None
        
    async def save_to_firebase_batch(self, articles: List[Dict]) -> None:
        """Save multiple articles to Firebase in batch with proper sync/async handling"""
        batch = self.db.batch()
        saved_count = 0
        failed_count = 0
        batch_size = 400  # Firestore batch limit is 500
        
        def commit_batch(current_batch):
            """Synchronous batch commit operation"""
            try:
                current_batch.commit()
                return True
            except Exception as e:
                print(f"Batch commit failed: {str(e)}")
                return False
        
        for idx, article in enumerate(articles):
            try:
                doc_id = hashlib.md5(article['url'].encode()).hexdigest()
                doc_ref = self.db.collection('news').document(doc_id)
                
                # Skip if document exists - make this synchronous
                doc_snapshot = doc_ref.get()
                if doc_snapshot.exists:
                    continue
                
                # Validate and parse date
                date_str = article.get('date', '').strip()
                if not date_str:
                    failed_count += 1
                    continue
                    
                try:
                    date_obj = datetime.strptime(date_str, '%Y.%m.%d %H:%M')
                except ValueError:
                    try:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                    except ValueError:
                        failed_count += 1
                        continue
                
                doc_data = {
                    'title': article.get('title', ''),
                    'content': article.get('content', ''),
                    'url': article['url'],
                    'thumbnail': article.get('thumbnail', ''),
                    'source': 'Korea Herald',
                    'date': firestore.SERVER_TIMESTAMP,
                    'formatted_date': date_obj.strftime('%Y-%m-%d'),
                    'celebrity': self.celebrity_id,
                    'mainCategory': article.get('mainCategory', 'Social'),
                    'headline': article.get('headline', article.get('title', '')),
                    'subheading': article.get('subheading', ''),
                    'involvement_level': article.get('involvement_level', 4),
                    'analysis_reason': article.get('analysis_reason', ''),
                    'category_reason': article.get('category_reason', ''),
                    'created_at': firestore.SERVER_TIMESTAMP
                }
                
                batch.set(doc_ref, doc_data)
                saved_count += 1
                
                # Commit batch when size limit is reached
                if saved_count % batch_size == 0:
                    success = commit_batch(batch)
                    if not success:
                        failed_count += batch_size
                    batch = self.db.batch()
                    
            except Exception as e:
                failed_count += 1
                print(f"Error processing article {idx}: {str(e)}")
                continue
        
        # Commit remaining documents
        if saved_count % batch_size > 0:
            success = commit_batch(batch)
            if not success:
                failed_count += saved_count % batch_size
                
        print(f"Batch save complete:")
        print(f"- Successfully saved: {saved_count - failed_count}")
        print(f"- Failed: {failed_count}")
        print(f"- Total processed: {len(articles)}")

    async def crawl(self):
        print(f"Starting batch crawl for {self.celebrity['name_eng']}...")
        current_page = 1
        empty_pages = 0
        max_empty_pages = 3
        batch_articles = []
        
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()
            
            try:
                while empty_pages < max_empty_pages:
                    page_url = self.base_url if current_page == 1 else f"{self.base_url}&page={current_page}"
                    print(f"\nProcessing page {current_page}")
                    
                    try:
                        await page.goto(page_url, wait_until='networkidle')
                        await page.wait_for_selector('.news_list', timeout=10000)
                    except Exception as e:
                        print(f"Page load error: {str(e)}")
                        empty_pages += 1
                        continue

                    articles = await page.query_selector_all('.news_list li')
                    if not articles:
                        empty_pages += 1
                        current_page += 1
                        continue
                        
                    # Process articles in parallel
                    article_tasks = [self.parse_article(article) for article in articles]
                    article_results = await asyncio.gather(*article_tasks)
                    
                    valid_articles = [a for a in article_results if a]
                    if not valid_articles:
                        empty_pages += 1
                    else:
                        empty_pages = 0
                        batch_articles.extend(valid_articles)
                        
                        # Process in batches of 5
                        if len(batch_articles) >= 5:
                            analyzed_batch = await self.analyzer.analyze_articles_batch(batch_articles[:5])
                            if analyzed_batch:
                                await self.save_to_firebase_batch(analyzed_batch)
                                # Track processed articles
                                self.processed_articles.extend(analyzed_batch)
                            batch_articles = batch_articles[5:]
                    
                    print(f"Found {len(valid_articles)} articles on page {current_page}")
                    current_page += 1
                    await asyncio.sleep(2)
                    
                # Process remaining articles
                if batch_articles:
                    analyzed_batch = await self.analyzer.analyze_articles_batch(batch_articles)
                    if analyzed_batch:
                        await self.save_to_firebase_batch(analyzed_batch)
                        # Track remaining processed articles
                        self.processed_articles.extend(analyzed_batch)

            finally:
                await context.close()
                await browser.close()
        
        print(f"\nBatch crawl completed for {self.celebrity_id}")
        print(f"Raw articles: {len(self.raw_articles)}")
        print(f"Processed articles: {len(self.processed_articles)}")
        
        self.save_backup_files()

async def process_celebrity_batch(celebrity):
    try:
        print(f"\n{'='*50}")
        print(f"Starting batch processing: {celebrity['name_eng']}")
        
        max_retries = 3
        crawler = None
        
        for attempt in range(max_retries):
            try:
                crawler = BatchKoreaHeraldCrawler(celebrity)
                await crawler.crawl()
                break
            except Exception as e:
                # Check if we processed any articles despite the error
                if crawler and len(crawler.processed_articles) > 0:
                    print(f"Crawl completed with {len(crawler.processed_articles)} articles despite error: {str(e)}")
                    break  # Don't retry if we successfully processed articles
                
                if attempt == max_retries - 1:
                    print(f"Failed after {max_retries} attempts: {str(e)}")
                else:
                    print(f"Attempt {attempt + 1} failed with no articles processed, retrying...")
                    await asyncio.sleep(5)
        
        if crawler:
            print(f"Completed batch processing: {celebrity['name_eng']}")
            print(f"Total articles processed: {len(crawler.processed_articles)}")
        
    except Exception as e:
        print(f"Error in batch processing: {str(e)}")
    
    print("\nWaiting 30 seconds before next celebrity...")
    await asyncio.sleep(30)

async def main_async():
    celebrities = [
        {"name_eng": "Han So-hee", "name_kr": "한소희"},
    ]
    
    for celebrity in celebrities:
        await process_celebrity_batch(celebrity)
        
def main():
    asyncio.run(main_async())
    

if __name__ == "__main__":
    main()