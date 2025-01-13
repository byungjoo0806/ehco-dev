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

class YonhapNewsCrawler:
    def __init__(self, celebrity: Dict[str, str]):
        """Initialize crawler with celebrity information"""
        self.celebrity = celebrity
        self.keyword = celebrity['name_eng'].replace(" ", "+").replace("-", "+").lower()
        self.base_url = f'https://en.yna.co.kr/search/index?query={self.keyword}&ctype=A&lang=EN'
        self.processed_articles = []
        self.raw_articles = []
        self.seen_urls = set()
        
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
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        self.driver = webdriver.Chrome(options=options)
        self.driver.set_page_load_timeout(60)

    def parse_article(self, article) -> Optional[Dict]:
        """Parse article data from webpage"""
        try:
            print("\nAttempting to parse article...")
            
            # Get URL and title
            try:
                link = article.find_element(By.CSS_SELECTOR, "h2.tit a, figure a")
                url = link.get_attribute('href')
                title = link.text.strip() or link.find_element(By.CSS_SELECTOR, "img").get_attribute('alt')
            except NoSuchElementException:
                print("Failed to find title/link element")
                return None
            
            if url.startswith('//'):
                url = 'https:' + url

            if not url or not title or url in self.seen_urls:
                return None
            
            self.seen_urls.add(url)
            print(f"Found title: {title}")
            
            # Get thumbnail
            try:
                img = article.find_element(By.CSS_SELECTOR, "img.col-w, figure img")
                thumbnail = img.get_attribute('src')
                if thumbnail and thumbnail.startswith('//'):
                    thumbnail = 'https:' + thumbnail
                print(f"Found thumbnail: {thumbnail}")
            except NoSuchElementException:
                print("No thumbnail found")
                thumbnail = ""
            
            # Get content
            try:
                content = article.text.strip()
                print(f"Found content preview: {content[:100]}...")
            except NoSuchElementException:
                print("No content preview found")
                content = ""

            # Get date with year from URL
            try:
                year = url.split("AEN")[1][:4] if "AEN" in url else str(datetime.now().year)
                date = article.find_element(By.CSS_SELECTOR, "span.date").text.strip()
                date_parts = date.split()
                month = date_parts[1].replace('.', '').strip()
                day = date_parts[2].strip()
                formatted_date = f"{year}-{datetime.strptime(month, '%b').month:02d}-{int(day):02d}"
                print(f"Found date: {formatted_date}")
            except Exception as e:
                print(f"Date parsing error: {e}")
                formatted_date = datetime.now().strftime('%Y-%m-%d')

            raw_data = {
                'title': title,
                'url': url,
                'date': formatted_date,
                'content': content,
                'thumbnail': thumbnail,
                'celebrity': self.celebrity_id
            }
            
            self.raw_articles.append(raw_data)
            print(f"Successfully parsed article: {title}")
            return raw_data
            
        except Exception as e:
            print(f"Error parsing article: {str(e)}")
            return None

    def save_to_firebase(self, article_data: Dict) -> bool:
        """Process and save article to Firebase"""
        try:
            analyzed_data = self.analyzer.analyze_article({
                'title': article_data['title'],
                'content': article_data['content']
            })
            
            if not analyzed_data:
                print(f"Article filtered out: {article_data['title'][:100]}")
                return False
            
            doc_data = {
                'title': article_data['title'],
                'content': article_data['content'],
                'url': article_data['url'],
                'thumbnail': article_data.get('thumbnail', ''),
                'source': 'Yonhap News',
                'date': datetime.strptime(article_data['date'], '%Y-%m-%d').timestamp() * 1000,
                'formatted_date': article_data['date'],
                'celebrity': self.celebrity_id,
                'mainCategory': analyzed_data['mainCategory'],
                'topicHeader': '',
                'contextLine': '',
                'relatedArticles': [],
                'isMainArticle': True,
                'created_at': datetime.now().timestamp() * 1000
            }
            
            self.processed_articles.append(doc_data)
            
            doc_ref = self.db.collection('news').document()
            doc_ref.set(doc_data)
            
            print(f"Saved article: {doc_data['title'][:50]}... as {analyzed_data['mainCategory']}")
            return True
            
        except Exception as e:
            print(f"Error saving to Firebase: {str(e)}")
            return False

    def save_backup_files(self):
        """Save backup files"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        backup_dir = "python/backup"
        os.makedirs(backup_dir, exist_ok=True)
        
        if self.raw_articles:
            raw_filename = f'{backup_dir}/raw_yonhap_{self.celebrity_id}_{timestamp}.csv'
            pd.DataFrame(self.raw_articles).to_csv(raw_filename, index=False, encoding='utf-8-sig')
            print(f"Raw backup saved to: {raw_filename}")
        
        if self.processed_articles:
            processed_filename = f'{backup_dir}/processed_yonhap_{self.celebrity_id}_{timestamp}.csv'
            pd.DataFrame(self.processed_articles).to_csv(processed_filename, index=False, encoding='utf-8-sig')
            print(f"Processed backup saved to: {processed_filename}")

    def crawl(self):
        """Main crawling function"""
        print(f"Starting crawl for {self.celebrity['name_eng']} (ID: {self.celebrity_id})...")
        page = 1
        total_articles_seen = 0
        successful_saves = 0
        
        while page <= 50:  # Max 50 pages
            print(f"\nProcessing page {page}...")
            url = f'{self.base_url}&page_no={page}' if page > 1 else self.base_url
            print(f"Accessing URL: {url}")
            
            try:
                self.driver.get(url)
                time.sleep(5)
                
                # Get current articles
                articles = self.driver.find_elements(By.CSS_SELECTOR, "li article")
                if not articles:
                    print("No articles found on this page")
                    break

                current_page_count = len(articles)
                print(f"Found {current_page_count} articles on page {page}")
                
                # Process articles
                articles_processed = 0
                for article in articles:
                    article_data = self.parse_article(article)
                    if article_data and self.save_to_firebase(article_data):
                        successful_saves += 1
                        articles_processed += 1

                total_articles_seen += current_page_count
                print(f"Processed {articles_processed} articles from page {page}")
                
                if articles_processed == 0:
                    break
                    
                page += 1
                time.sleep(2)

            except Exception as e:
                print(f"Error processing page {page}: {str(e)}")
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
                    crawler = YonhapNewsCrawler(celebrity)
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
        
        print("\nWaiting 30 seconds before next celebrity...")
        time.sleep(30)

if __name__ == "__main__":
    main()