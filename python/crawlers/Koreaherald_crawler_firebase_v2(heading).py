from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import firebase_admin
from firebase_admin import credentials, firestore
from langchain_ollama import OllamaLLM
import pandas as pd
from datetime import datetime
import time
from typing import Dict, List, Optional
import os
import hashlib
from anthropic import Anthropic
from dotenv import load_dotenv
from playwright.async_api import async_playwright
import asyncio

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

class NewsAnalyzer:
    def __init__(self, celebrity_name: str, korean_name: str):
        print(f"Initializing analyzer for {celebrity_name}...")
        
        # Load environment variables
        load_dotenv()
        
        try:
            # Get API key from environment variable
            api_key = os.getenv('ANTHROPIC_API_KEY')
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
                
            self.client = Anthropic(api_key=api_key)
            # Add model name as a class constant
            self.model = "claude-3-5-sonnet-20241022"
            self.total_tokens = 0
            print(f"Successfully connected to Anthropic API using {self.model}")
        except Exception as e:
            print(f"Error connecting to Anthropic API: {str(e)}")
            raise

        self.celebrity_name = celebrity_name
        self.korean_name = korean_name
        
    def _call_claude(self, prompt: str, retries: int = 3, max_tokens: int = 1000) -> str:
        """Helper method to call Claude API with retry logic and error handling"""
        print("\n=== CLAUDE API CALL ===")
        
        for attempt in range(retries):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=max_tokens,
                    messages=[{
                        "role": "user",
                        "content": prompt
                    }],
                    temperature=0.3  # Add lower temperature for more consistent responses
                )
                if not response.content:
                    raise ValueError("Empty response from Claude API")
                
                # Track token usage
                input_tokens = response.usage.input_tokens
                output_tokens = response.usage.output_tokens
                total_tokens = input_tokens + output_tokens
                self.total_tokens += total_tokens
                
                # Log token usage for this call
                print(f"Token Usage for this call:")
                print(f"- Input tokens: {input_tokens}")
                print(f"- Output tokens: {output_tokens}")
                print(f"- Total tokens: {total_tokens}")
                print(f"Cumulative total tokens: {self.total_tokens}")
                
                result = response.content[0].text

                print("=== END API CALL ===\n")
                return result
            
            except Exception as e:
                if attempt == retries - 1:
                    print(f"Failed to get response after {retries} attempts: {e}")
                    raise
                wait_time = min(2 ** attempt, 32)  # Cap maximum wait time
                print(f"Attempt {attempt + 1} failed, retrying after {wait_time}s delay... Error: {str(e)}")
                time.sleep(wait_time)
                
    def get_token_usage(self) -> dict:
        """Return the current token usage statistics"""
        return {
            "total_tokens": self.total_tokens
        }

    def analyze_article(self, article_data: Dict) -> Optional[Dict]:
        """Enhanced article analysis using Claude API"""
        title = article_data.get('title', '')
        content = article_data.get('content', '')
        
        if not title or not content:
            print("Empty title or content, skipping...")
            return None
        
        try:
            # Analyze involvement level with new prompt
            involvement_prompt = f"""You are an expert K-entertainment analyst focusing on {self.celebrity_name} ({self.korean_name}).

Analyze this article and determine {self.celebrity_name}'s involvement level:

Article Title: {title}
Article Content: {content}

INVOLVEMENT LEVELS:
LEVEL 1 - PRIMARY FOCUS
- {self.celebrity_name} is the main subject
- Direct actions or statements by {self.celebrity_name}
- News specifically about {self.celebrity_name}
Example: "{self.celebrity_name} confirms new drama role"

LEVEL 2 - SIGNIFICANT MENTION
- {self.celebrity_name} is a key figure in a larger event
- {self.celebrity_name}'s actions affect the story
- Notable participation by {self.celebrity_name}
Example: "Top stars including {self.celebrity_name} attend award show"

LEVEL 3 - RELEVANT REFERENCE
- {self.celebrity_name} mentioned in context
- Indirect involvement by {self.celebrity_name}
- {self.celebrity_name} referenced as example
Example: "Industry changes affect stars like {self.celebrity_name}"

LEVEL 4 - PERIPHERAL MENTION
- Brief mention of {self.celebrity_name}
- {self.celebrity_name} listed among many
- No significant role by {self.celebrity_name}
Example: "Multiple celebrities spotted at event"

Return EXACTLY in this format:
LEVEL: (number 1-4)
REASON: (brief explanation)
TOPIC: (main subject)
POINTS: (key information about {self.celebrity_name})"""

            analysis_result = self._call_claude(involvement_prompt).strip()
            
            # Parse results and continue with the same logic as before...
            lines = analysis_result.split('\n')
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

            # Determine relevance based on level
            is_relevant = level is not None and level <= 3
            
            if not is_relevant:
                print(f"Article not relevant enough (Level {level}): {title[:50]}...")
                return None

            # Updated category prompt
            category_prompt = f"""As a K-entertainment expert, categorize this Level {level} article about {self.celebrity_name}.

Article Title: {title}
Article Content: {content}
Topic: {topic}
{self.celebrity_name}'s Role: {points}

Based on {self.celebrity_name}'s Level {level} involvement, categorize into ONE of:

A. Is {self.celebrity_name} involved in ACTING here?
   - Acting in drama/series/film
   - Discussing character/role
   - Receiving acting awards
   - Production involvement
   → If YES, category MUST be "Acting"

B. Is {self.celebrity_name} involved in MUSIC here?
   - Music release/performance
   - Concert/tour activity
   - Music collaboration
   - Music award/recognition
   → If YES, category MUST be "Music"

C. Is {self.celebrity_name} involved in PROMOTION here?
   - Brand endorsement
   - Commercial/advertisement
   - Media appearance
   - Public event participation
   → If YES, category MUST be "Promotion"

D. Is {self.celebrity_name} involved in SOCIAL matters here?
   - Personal life/relationships
   - Charity/social causes
   - Daily activities
   - Non-work public appearance
   → If YES, category MUST be "Social"

E. Is {self.celebrity_name} involved in CONTROVERSY here?
   - Direct involvement in dispute
   - Legal/political issues
   - Public criticism
   - Industry conflict
   → If YES, category MUST be "Controversy"

Return in format:
CATEGORY: (exact category name)
REASON: (explanation focusing on {self.celebrity_name}'s role)"""

            category_result = self._call_claude(category_prompt).strip()
            
            # Parse category result
            category = None
            category_reason = None
            for line in category_result.split('\n'):
                if line.startswith('CATEGORY:'):
                    category = line.split(':')[1].strip()
                elif line.startswith('REASON:'):
                    category_reason = line.split(':')[1].strip()

            # If initial categorization fails, try again with more focused analysis
            if category not in {"Acting", "Music", "Promotion", "Social", "Controversy"}:
                print(f"Initial category '{category}' invalid, performing detailed analysis...")
                
                detailed_prompt = f"""As a K-entertainment expert, we need to categorize this article about {self.celebrity_name}.
                We already know their involvement is Level {level}, meaning this is a relevant article.

                Article Title: {title}
                Article Content: {content}
                Topic: {topic}
                Involvement Points: {points}

                Let's analyze which category fits best by checking each possibility:

                A. ACTING Category Indicators:
                   - Acting in drama/series/film
                   - Discussing character/role
                   - Receiving acting awards
                   - Production involvement
                   - Drama/film related events
                   - Acting career decisions

                B. MUSIC Category Indicators:
                   - Music release/performance
                   - Concert/tour activity
                   - Music collaboration
                   - Music award/recognition
                   - Album/song production
                   - Music show appearances

                C. PROMOTION Category Indicators:
                   - Brand endorsement
                   - Commercial/advertisement
                   - Media appearance
                   - Public event participation
                   - Brand ambassador activities
                   - Interview/photoshoot

                D. SOCIAL Category Indicators:
                   - Personal life/relationships
                   - Charity/social causes
                   - Daily activities
                   - Non-work public appearance
                   - Fan interactions
                   - Personal social media

                E. CONTROVERSY Category Indicators:
                   - Direct involvement in dispute
                   - Legal/political issues
                   - Public criticism
                   - Industry conflict
                   - Negative press
                   - Public apologies/statements

                Steps:
                1. What specific activities/events is {self.celebrity_name} involved in here?
                2. Which category's indicators BEST match these activities?
                3. Even if not a perfect match, which category is MOST appropriate?

                Rules:
                - This article IS relevant to {self.celebrity_name} (Level {level} involvement)
                - It MUST fit into one of our categories
                - Choose the BEST FIT category, even if not perfect
                - Consider the primary focus of the article

                Return ONLY:
                CATEGORY: (must be Acting/Music/Promotion/Social/Controversy)
                JUSTIFICATION: (explain why this category fits best)"""

                retry_result = self._call_claude(detailed_prompt).strip()
                
                # Parse retry result
                for line in retry_result.split('\n'):
                    if line.startswith('CATEGORY:'):
                        category = line.split(':')[1].strip()
                        break
                    elif line.startswith('JUSTIFICATION:'):
                        category_reason = line.split(':')[1].strip()
                
                # Final validation
                if category not in {"Acting", "Music", "Promotion", "Social", "Controversy"}:
                    print(f"Still unable to categorize after detailed analysis, using most general category")
                    category = "Social"
                    category_reason = f"General category assigned after detailed analysis of Level {level} involvement"

            # Generate headline with new prompt
            headline_prompt = f"""Create a headline for this Level {level} {category} news about {self.celebrity_name}.

Article Content: {content}
Topic: {topic}
Category: {category}
Involvement: Level {level}

Requirements:
1. Must start with "{self.celebrity_name}"
2. Maximum 8 words
3. Match involvement level {level}
4. Reflect {category} category
5. Be specific and factual

Return ONLY the headline text."""

            headline = self._call_claude(headline_prompt).strip()
            if not headline:
                headline = title

            # Generate subheading with new prompt
            subheading_prompt = f"""Create a subheading for this {category} news about {self.celebrity_name}.

Main Topic: {topic}
Category: {category}
Key Points: {points}
Involvement: Level {level}

Requirements:
1. Must begin with "{self.celebrity_name}"
2. One clear sentence
3. Add new context not in headline
4. Match {category} category focus
5. Appropriate for Level {level}

Return ONLY the subheading text."""

            subheading = self._call_claude(subheading_prompt).strip()
            if not subheading:
                subheading = content[:100] + "..."

            final_result = {
                'mainCategory': category,
                'headline': headline,
                'subheading': subheading,
                'involvement_level': level,
                'title': title,
                'content': content,
                'analysis_reason': reason,
                'category_reason': category_reason,
                **article_data
            }
            
            print(final_result)
            return final_result
                
        except Exception as e:
            print(f"Error in analysis: {str(e)}")
            print(f"Error context: Title: {title[:100]}")
            return None

class KoreaHeraldCrawler:
    def __init__(self, celebrity: Dict[str, str]):
        self.celebrity = celebrity
        self.keyword = celebrity['name_eng'].replace(" ", "+")
        self.base_url = f"https://www.koreaherald.com/search/detail?q={self.keyword}&stype=NEWS"
        self.processed_articles = []
        self.raw_articles = []
        self.seen_urls = set()
        
        self.celebrity_id = celebrity['name_eng'].lower().replace(" ", "").replace("-", "")
        self.analyzer = NewsAnalyzer(celebrity['name_eng'], celebrity['name_kr'])
        
        # Initialize Firebase
        self.db = initialize_firebase()

    async def parse_article(self, article) -> Optional[Dict]:
        try:
            # Using evaluate to get element properties
            article_data = await article.evaluate("""(article) => {
                const link = article.querySelector('a');
                const title = article.querySelector('.news_title');
                const date = article.querySelector('.date');
                const img = article.querySelector('.news_img img');
                const content = article.querySelector('.news_text');
                
                return {
                    url: link ? link.href : '',
                    title: title ? title.textContent.trim() : '',
                    date: date ? date.textContent.trim() : '',
                    thumbnail: img ? img.src : '',
                    content: content ? content.textContent.trim() : ''
                };
            }""")
            
            if not article_data['url']:
                return None
                
            # Handle relative URLs
            if not article_data['url'].startswith('http'):
                article_data['url'] = 'https://www.koreaherald.com' + article_data['url']
            
            if article_data['url'] in self.seen_urls:
                return None
            self.seen_urls.add(article_data['url'])
            
            # If content is empty, use title
            if not article_data['content']:
                article_data['content'] = article_data['title']
            
            article_data['celebrity'] = self.celebrity_id
            self.raw_articles.append(article_data)
            return article_data
            
        except Exception as e:
            print(f"Parse error: {str(e)}")
            return None

    def save_to_firebase(self, article_data: Dict) -> bool:
        def generate_doc_id(url: str) -> str:
            return hashlib.md5(url.encode()).hexdigest()
        
        try:
            doc_id = generate_doc_id(article_data['url'])
            doc_ref = self.db.collection('news').document(doc_id)
            doc = doc_ref.get()

            if doc.exists:
                print(f"Article already exists: {article_data['title'][:50]}...")
                return False
            
            date_str = article_data['date'].strip()
            if not date_str:
                return False
            
            try:
                date_obj = datetime.strptime(date_str, '%Y.%m.%d %H:%M')
            except ValueError:
                try:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                except:
                    return False
            
            analyzed_data = self.analyzer.analyze_article({
                'title': article_data['title'],
                'content': article_data['content']
            })
            
            if not analyzed_data:
                return False
            
            doc_data = {
                'title': article_data['title'],
                'content': article_data['content'],
                'url': article_data['url'],
                'thumbnail': article_data.get('thumbnail', ''),
                'source': 'Korea Herald',
                'date': firestore.SERVER_TIMESTAMP,
                'formatted_date': date_obj.strftime('%Y-%m-%d'),
                'celebrity': self.celebrity_id,
                'mainCategory': analyzed_data['mainCategory'],
                'headline': analyzed_data.get('headline', article_data['title']),
                'subheading': analyzed_data.get('subheading', ''),
                'involvement_level': analyzed_data.get('involvement_level', 4),
                'analysis_reason': analyzed_data.get('analysis_reason', ''),
                'category_reason': analyzed_data.get('category_reason', ''),
                'created_at': firestore.SERVER_TIMESTAMP
            }
            
            self.processed_articles.append(doc_data)
            doc_ref.set(doc_data)
            
            print(f"Saved: {doc_data['headline'][:50]}... (Level {doc_data['involvement_level']}, {analyzed_data['mainCategory']})")
            return True
            
        except Exception as e:
            print(f"Save error: {str(e)}")
            return False

    def save_backup_files(self):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_dir = "python/backup"
        os.makedirs(backup_dir, exist_ok=True)
        
        if self.raw_articles:
            raw_filename = f'{backup_dir}/raw_koreaherald_{self.celebrity_id}_{timestamp}.csv'
            pd.DataFrame(self.raw_articles).to_csv(raw_filename, index=False, encoding='utf-8-sig')
            print(f"Raw backup: {raw_filename}")
        
        if self.processed_articles:
            processed_filename = f'{backup_dir}/processed_koreaherald_{self.celebrity_id}_{timestamp}.csv'
            pd.DataFrame(self.processed_articles).to_csv(processed_filename, index=False, encoding='utf-8-sig')
            print(f"Processed backup: {processed_filename}")

    async def crawl(self):
        print(f"Starting crawl for {self.celebrity['name_eng']}...")
        current_page = 1
        empty_pages = 0
        max_empty_pages = 3
        articles_processed = 0
        
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()
            
            try:
                while empty_pages < max_empty_pages:
                    page_url = self.base_url if current_page == 1 else f"{self.base_url}&page={current_page}"
                    print(f"\nProcessing page {current_page}")
                    
                    try:
                        # Navigate to page and wait for content
                        await page.goto(page_url, wait_until='networkidle')
                        await page.wait_for_selector('.news_list', timeout=10000)
                    except Exception as e:
                        print(f"Page load error: {str(e)}")
                        empty_pages += 1
                        continue

                    # Get all articles on the page
                    articles = await page.query_selector_all('.news_list li')
                    if not articles:
                        empty_pages += 1
                        current_page += 1
                        continue
                        
                    articles_found = 0
                    for article in articles:
                        article_data = await self.parse_article(article)
                        if article_data and self.save_to_firebase(article_data):
                            articles_found += 1
                            articles_processed += 1
                            
                            # Print token usage after each article
                            token_stats = self.analyzer.get_token_usage()
                            print(f"\nToken usage after {articles_processed} articles:")
                            print(f"Total tokens used so far: {token_stats['total_tokens']}")
                            print(f"Average tokens per article: {token_stats['total_tokens'] / articles_processed:.2f}")
                            
                    if articles_found == 0:
                        empty_pages += 1
                    else:
                        empty_pages = 0
                        
                    print(f"Found {articles_found} articles on page {current_page}")
                    current_page += 1
                    await asyncio.sleep(2)  # Using asyncio.sleep instead of time.sleep

            finally:
                # Clean up Playwright resources
                await context.close()
                await browser.close()
        
        print(f"\nCrawl completed for {self.celebrity_id}")
        print(f"Raw articles: {len(self.raw_articles)}")
        print(f"Processed articles: {len(self.processed_articles)}")
        
        self.save_backup_files()

async def process_celebrity(celebrity):
    try:
        print(f"\n{'='*50}")
        print(f"Starting: {celebrity['name_eng']}")
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                crawler = KoreaHeraldCrawler(celebrity)
                await crawler.crawl()
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    print(f"Failed after {max_retries} attempts: {str(e)}")
                else:
                    print(f"Attempt {attempt + 1} failed, retrying...")
                    await asyncio.sleep(5)
        
        print(f"Completed: {celebrity['name_eng']}")
        
    except Exception as e:
        print(f"Error: {str(e)}")
    
    print("\nWaiting 30 seconds before next celebrity...")
    await asyncio.sleep(30)

# def main():
#     celebrities = [
#         {"name_eng": "Han So-hee", "name_kr": "한소희"},
#     ]
    
#     for celebrity in celebrities:
#         try:
#             print(f"\n{'='*50}")
#             print(f"Starting: {celebrity['name_eng']}")
            
#             max_retries = 3
#             for attempt in range(max_retries):
#                 try:
#                     with sync_playwright() as playwright:
#                         crawler = KoreaHeraldCrawler(celebrity)
#                         crawler.crawl()
#                     break
#                 except Exception as e:
#                     if attempt == max_retries - 1:
#                         print(f"Failed after {max_retries} attempts: {str(e)}")
#                     else:
#                         print(f"Attempt {attempt + 1} failed, retrying...")
#                         time.sleep(5)
            
#             print(f"Completed: {celebrity['name_eng']}")
            
#         except Exception as e:
#             print(f"Error: {str(e)}")
#             continue
        
#         print("\nWaiting 30 seconds before next celebrity...")
#         time.sleep(30)
        
async def main_async():
    celebrities = [
        {"name_eng": "Han So-hee", "name_kr": "한소희"},
    ]
    
    for celebrity in celebrities:
        await process_celebrity(celebrity)
        
def main():
    asyncio.run(main_async())
    

if __name__ == "__main__":
    main()