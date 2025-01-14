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
        
        try:
            self.db = firestore.client()
        except:
            cred = credentials.Certificate('/Users/ryujunhyoung/Desktop/EHCO/firebase/config/serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
        
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        self.driver = webdriver.Chrome(options=options)

    def parse_article(self, article) -> Optional[Dict]:
        try:
            link = article.find_element(By.TAG_NAME, 'a')
            url = link.get_attribute('href')
            if not url.startswith('http'):
                url = 'https://www.koreaherald.com' + url
            
            if url in self.seen_urls:
                return None
            self.seen_urls.add(url)
            
            title = article.find_element(By.CLASS_NAME, 'news_title').text.strip()
            date = article.find_element(By.CLASS_NAME, 'date').text.strip()
            
            try:
                img = article.find_element(By.CSS_SELECTOR, '.news_img img')
                thumbnail = img.get_attribute('src')
            except:
                thumbnail = ''

            try:
                content = article.find_element(By.CLASS_NAME, 'news_text').text.strip()
            except:
                content = title

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
            print(f"Parse error: {str(e)}")
            return None

    def save_to_firebase(self, article_data: Dict) -> bool:
        try:
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
                'created_at': firestore.SERVER_TIMESTAMP
            }
            
            self.processed_articles.append(doc_data)
            
            doc_ref = self.db.collection('news').document()
            doc_ref.set(doc_data)
            
            print(f"Saved: {doc_data['title'][:50]}... ({analyzed_data['mainCategory']})")
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

    def crawl(self):
        print(f"Starting crawl for {self.celebrity['name_eng']}...")
        current_page = 1
        empty_pages = 0
        max_empty_pages = 3
        
        while empty_pages < max_empty_pages:
            page_url = self.base_url if current_page == 1 else f"{self.base_url}&page={current_page}"
            print(f"\nProcessing page {current_page}")
            
            try:
                self.driver.get(page_url)
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CLASS_NAME, 'news_list'))
                )
            except TimeoutException:
                empty_pages += 1
                continue

            articles = self.driver.find_elements(By.CSS_SELECTOR, '.news_list li')
            if not articles:
                empty_pages += 1
                current_page += 1
                continue
                
            articles_found = 0
            for article in articles:
                article_data = self.parse_article(article)
                if article_data and self.save_to_firebase(article_data):
                    articles_found += 1
                    
            if articles_found == 0:
                empty_pages += 1
            else:
                empty_pages = 0
                
            print(f"Found {articles_found} articles on page {current_page}")
            current_page += 1
            time.sleep(2)

        self.driver.quit()
        print(f"\nCrawl completed for {self.celebrity_id}")
        print(f"Raw articles: {len(self.raw_articles)}")
        print(f"Processed articles: {len(self.processed_articles)}")
        
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
            print(f"Starting: {celebrity['name_eng']}")
            
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    crawler = KoreaHeraldCrawler(celebrity)
                    crawler.crawl()
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        print(f"Failed after {max_retries} attempts: {str(e)}")
                    else:
                        print(f"Attempt {attempt + 1} failed, retrying...")
                        time.sleep(5)
            
            print(f"Completed: {celebrity['name_eng']}")
            
        except Exception as e:
            print(f"Error: {str(e)}")
            continue
        
        print("\nWaiting 30 seconds...")
        time.sleep(30)

if __name__ == "__main__":
    main()