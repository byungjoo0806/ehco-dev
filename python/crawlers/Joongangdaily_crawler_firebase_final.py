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

class NewsAnalyzer:
    def __init__(self, celebrity_name: str, korean_name: str):
        print(f"Initializing analyzer for {celebrity_name}...")
        
        # Initialize Ollama
        try:
            self.llm = OllamaLLM(model="llama3.2:latest")
            print("Successfully connected to Ollama")
        except Exception as e:
            print(f"Error connecting to Ollama: {str(e)}")
            raise

        self.celebrity_name = celebrity_name
        self.korean_name = korean_name

    def analyze_article(self, article_data: Dict) -> Optional[Dict]:
        """Analyze article relevance and category with improved reliability"""
        title = article_data.get('title', '')
        content = article_data.get('content', '')
        
        if not title or not content:
            print("Empty title or content, skipping...")
            return None
            
        relevance_prompt = f"""
        Task: Determine if this article is primarily about or significantly mentions {self.celebrity_name} ({self.korean_name}).
        
        Article Title: {title}
        Article Content: {content}

        Analyze relevance based on these criteria:
        1. Direct mention of {self.celebrity_name} or {self.korean_name}
        2. Discussion of their work, projects, or activities
        3. Quotes or statements from the celebrity
        4. Events or news directly involving them
        5. References to their career or personal life

        Return ONLY 'true' or 'false':"""
        
        try:
            is_relevant = self.llm.invoke(relevance_prompt).strip().lower() == 'true'
            
            if not is_relevant:
                print(f"Article not relevant enough: {title[:50]}...")
                return None

            category_prompt = f"""
            Task: Categorize this article about {self.celebrity_name} into ONE main category.

            Article Title: {title}
            Article Content: {content}

            Categories:
            1. Music: songs, albums, concerts, music shows, collaborations
            2. Acting: dramas, movies, TV shows, OTT content, awards
            3. Promotion: advertisements, interviews, events, brand activities
            4. Social: personal life, relationships, daily activities, charity
            5. Controversy: issues, disputes, conflicts

            Return ONLY ONE category name (Music/Acting/Promotion/Social/Controversy).
            Category:"""
            
            category = self.llm.invoke(category_prompt).strip()
            
            valid_categories = {"Music", "Acting", "Promotion", "Social", "Controversy"}
            if category not in valid_categories:
                print(f"Invalid category '{category}', defaulting to Social")
                category = "Social"
            
            print(f"Categorized '{title[:50]}...' as {category}")
            
            return {
                'mainCategory': category,
                **article_data
            }
            
        except Exception as e:
            print(f"Error in analysis: {str(e)}")
            print(f"Error context: Title: {title[:100]}\nError: {str(e)}")
            return None

class EnhancedJoongAngCrawler:
    def __init__(self, celebrity: Dict[str, str]):
        """Initialize crawler with celebrity information"""
        self.celebrity = celebrity
        self.keyword = celebrity['name_eng'].replace(" ", "+").replace("-", "+")
        self.base_url = f'https://koreajoongangdaily.joins.com/section/searchResult/{self.keyword}?searchFlag=1'
        self.processed_articles = []
        self.raw_articles = []
        self.seen_urls = set()
        
        # Format celebrity ID for Firebase
        self.celebrity_id = celebrity['name_eng'].lower().replace(" ", "").replace("-", "")
        
        self.analyzer = NewsAnalyzer(celebrity['name_eng'], celebrity['name_kr'])
        
        # Initialize Firebase
        try:
            self.db = firestore.client()
        except:
            cred = credentials.Certificate('/Users/ryujunhyoung/Desktop/EHCO/firebase/config/serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("Successfully connected to Firebase")
        
        # Initialize Selenium
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        self.driver = webdriver.Chrome(options=options)

    def parse_article(self, article) -> Optional[Dict]:
        """Parse article data from webpage with improved error handling"""
        try:
            link = article.find_element(By.CLASS_NAME, 'media')
            url = link.get_attribute('href')
            
            if url in self.seen_urls:
                return None
            
            self.seen_urls.add(url)
            
            title = article.find_element(By.CLASS_NAME, 'mid-article-title3').text.strip()
            date = article.find_element(By.CLASS_NAME, 'media-date').text.strip()
            content = article.find_element(By.CLASS_NAME, 'mid-article-content3').text.strip()
            
            try:
                thumbnail = article.find_element(By.TAG_NAME, 'img').get_attribute('src')
            except NoSuchElementException:
                thumbnail = ''

            raw_data = {
                'title': title,
                'url': url,
                'date': date,
                'content': content,
                'thumbnail': thumbnail,
                'celebrity': self.celebrity_id
            }
            self.raw_articles.append(raw_data)

            return raw_data
            
        except Exception as e:
            print(f"Error parsing article: {str(e)}")
            return None

    def save_to_firebase(self, article_data: Dict) -> bool:
        """Process and save article to Firebase with enhanced error handling"""
        try:
            date_str = article_data['date'].strip()
            if not date_str:
                print(f"Empty date string for article: {article_data['title'][:50]}...")
                return False
                
            try:
                try:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                except ValueError:
                    date_obj = datetime.strptime(date_str, '%b. %d, %Y')
            except ValueError:
                print(f"Unable to parse date: {date_str}")
                return False
            
            analyzed_data = self.analyzer.analyze_article({
                'title': article_data['title'],
                'content': article_data['content']
            })
            
            if not analyzed_data:
                print(f"Article filtered out: {article_data['title'][:100]}")
                return False
            
            # Prepare document data with correct celebrity ID
            doc_data = {
                'title': article_data['title'],
                'content': article_data['content'],
                'url': article_data['url'],
                'thumbnail': article_data.get('thumbnail', ''),
                'source': 'Korea JoongAng Daily',
                'date': firestore.SERVER_TIMESTAMP,
                'formatted_date': date_obj.strftime('%Y-%m-%d'),
                'celebrity': self.celebrity_id,
                'mainCategory': analyzed_data['mainCategory'],
                'created_at': firestore.SERVER_TIMESTAMP
            }
            
            # Save processed article for backup
            self.processed_articles.append(doc_data)
            
            # Save to Firebase
            doc_ref = self.db.collection('news').document()
            doc_ref.set(doc_data)
            
            print(f"Saved article for {self.celebrity_id}: {doc_data['title'][:50]}... as {analyzed_data['mainCategory']}")
            return True
            
        except Exception as e:
            print(f"Error saving to Firebase: {str(e)}")
            return False

    def save_backup_files(self):
        """Save both raw and processed data backups"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        backup_dir = "python/backup"
        os.makedirs(backup_dir, exist_ok=True)
        
        if self.raw_articles:
            raw_filename = f'{backup_dir}/raw_{self.celebrity_id}_{timestamp}.csv'
            pd.DataFrame(self.raw_articles).to_csv(raw_filename, index=False, encoding='utf-8-sig')
            print(f"Raw data backup saved to: {raw_filename}")
        
        if self.processed_articles:
            processed_filename = f'{backup_dir}/processed_{self.celebrity_id}_{timestamp}.csv'
            pd.DataFrame(self.processed_articles).to_csv(processed_filename, index=False, encoding='utf-8-sig')
            print(f"Processed data backup saved to: {processed_filename}")

    def crawl(self):
        """Main crawling function with proper end-of-results detection"""
        print(f"Starting crawl for {self.celebrity['name_eng']} (ID: {self.celebrity_id})...")
        self.driver.get(self.base_url)
        
        try:
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, 'mid-article3'))
            )
        except TimeoutException:
            print("No articles found in search results")
            self.driver.quit()
            return
        
        successful_saves = 0
        page_number = 1
        total_articles_seen = 0
        last_page_article_count = 0  # Track number of articles on the last page
        
        while True:
            print(f"\nProcessing page {page_number}...")
            
            # Get current articles on page
            articles = self.driver.find_elements(By.CLASS_NAME, 'mid-article3')
            current_article_count = len(articles)
            
            if current_article_count == last_page_article_count:
                print("No new articles loaded - reached end of search results")
                break
                
            print(f"Found {current_article_count} articles on page {page_number}")
            
            # Process articles on current page
            relevant_on_page = 0
            for article in articles[last_page_article_count:]:  # Only process new articles
                article_data = self.parse_article(article)
                if article_data and self.save_to_firebase(article_data):
                    successful_saves += 1
                    relevant_on_page += 1
            
            total_articles_seen += (current_article_count - last_page_article_count)
            print(f"Processed {relevant_on_page} relevant articles from page {page_number}")
            
            # Update last page count
            last_page_article_count = current_article_count
            
            # Try to load more articles
            try:
                more_button = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.CLASS_NAME, 'service-more-btn'))
                )
                self.driver.execute_script("arguments[0].click();", more_button)
                time.sleep(1)
                page_number += 1
            except TimeoutException:
                print("No more pages available in search results")
                break

        self.driver.quit()
        print(f"\nCrawl completed for {self.celebrity_id}:")
        print(f"- Total articles examined: {total_articles_seen}")
        print(f"- Total raw articles collected: {len(self.raw_articles)}")
        print(f"- Successfully processed and saved: {successful_saves}")
        
        self.save_backup_files()


def main():
    celebrities = [
        {"name_eng": "IU", "name_kr": "아이유"},
        {"name_eng": "Kim Soo-hyun", "name_kr": "김수현"},
        {"name_eng": "Han So-hee", "name_kr": "한소희"}
    ]
    
    for celebrity in celebrities:
        try:
            print(f"\n{'='*50}")
            print(f"Starting crawl for {celebrity['name_eng']}")
            print(f"{'='*50}\n")
            
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    crawler = EnhancedJoongAngCrawler(celebrity)
                    crawler.crawl()
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        print(f"Failed to crawl for {celebrity['name_eng']} after {max_retries} attempts")
                        print(f"Error: {str(e)}")
                    else:
                        print(f"Attempt {attempt + 1} failed, retrying...")
                        time.sleep(5)
            
            print(f"\nCompleted processing for {celebrity['name_eng']}")
            
        except Exception as e:
            print(f"Error processing {celebrity['name_eng']}: {str(e)}")
            continue
        
        print("\nWaiting 30 seconds before processing next celebrity...")
        time.sleep(30)

if __name__ == "__main__":
    main()