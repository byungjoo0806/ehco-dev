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
import json
import gc

class LLMConnectionError(Exception):
    pass

class LLMTimeoutError(Exception):
    pass

class LLMManager:
    def __init__(self, model_name="llama3.2:latest", max_retries=3, timeout=30):
        self.model_name = model_name
        self.max_retries = max_retries
        self.timeout = timeout
        self.llm = None
    
    def initialize_connection(self):
        for attempt in range(self.max_retries):
            try:
                gc.collect()
                self.llm = OllamaLLM(
                    model=self.model_name,
                    timeout=self.timeout
                )
                print("Successfully connected to Ollama")
                return self.llm
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise Exception(f"Failed to connect to Ollama after {self.max_retries} attempts: {str(e)}")
                time.sleep(2 ** attempt)  # Exponential backoff

class NewsAnalyzer:
    def __init__(self, celebrity_name: str, korean_name: str):
        print(f"Initializing analyzer for {celebrity_name}...")       
            
        self.celebrity_name = celebrity_name
        self.korean_name = korean_name
        self.llm_manager = LLMManager()
        self.categories = {
            'Music': ['Album Release', 'Collaboration', 'Performance', 'Tour/concert', 'Music Awards'],
            'Acting': ['Drama/series', 'Film', 'OTT', 'Film/TV/drama Awards', 'Variety show'],
            'Promotion': ['Fan meeting', 'Media appearance', 'Social media', 'Interviews', 'Brand activities'],
            'Social': ['Donation', 'Health/diet', 'Daily fashion', 'Airport fashion', 'Family', 'Friends/companion',
                      'Marriage/relationship', 'Pets', 'Company/representation', 'Political stance', 'Social Recognition', 'Real estate'],
            'Controversy': ['Plagiarism', 'Romance', 'Political Controversy']
        }

    def _create_analysis_prompt(self, article_data: Dict) -> str:
        categories_str = "\n".join([
            f"- {cat}: {', '.join(subs)}" for cat, subs in self.categories.items()
        ])
        
        return f"""
        TASK: Analyze this article for {self.celebrity_name} ({self.korean_name}) content.
    
        IMPORTANT: Return ONLY a valid Python dictionary. Use simple key-value pairs. Use all single quotes.
        
        STEP 1: Check if {self.celebrity_name} is mentioned.
        
        If {self.celebrity_name} is NOT mentioned, return exactly:
        {{
            'main_category': 'None',
            'sub_category': 'None',
            'heading': f'No {self.celebrity_name} Content',
            'subheading': f'Article does not mention {self.celebrity_name}'
        }}
        
        STEP 2: If {self.celebrity_name} IS mentioned:
        
        1. Choose ONE category and subcategory from:
        {categories_str}
        
        2. Create heading that MUST:
        - Include {self.celebrity_name}
        - Describe one main action
        - Use active voice
        - Be specific and factual
        - NOT use words like "star," "singer," "actress"
        
        3. Create subheading that MUST:
        - Include {self.celebrity_name}
        - Add new information
        - Include context
        - Use simple language
        
        PYTHON DICTIONARY FORMAT RULES:
        1. Use single quotes for string values
        2. No punctuation (periods commas) inside text values
        3. Text values must not end with punctuation
        4. Keys must be simple strings
        5. Return dictionary in single-line format
        
        Article text:
        {article_data['content']}
        """


    def analyze_article(self, article_data: Dict) -> Optional[Dict]:
        def clean_dictionary_string(dict_string: str) -> str:
            # Remove extra curly brackets at start/end
            dict_string = dict_string.strip()
            while dict_string.startswith('{{'):
                dict_string = dict_string[1:]
            while dict_string.endswith('}}'):
                dict_string = dict_string[:-1]

            # Fix quote issues and spacing
            dict_string = (dict_string
                .replace('"', "'")  # Remove consecutive single quotes
                .replace(",' ", ",'")  # Fix spacing after commas
                .replace(' ,', ',')   # Fix spacing before commas
                .replace("','", "', '")  # Add proper spacing between values
            )

            # Ensure proper dictionary structure
            if not dict_string.startswith('{'):
                dict_string = '{' + dict_string
            if not dict_string.endswith('}'):
                dict_string = dict_string + '}'

            return dict_string

        for attempt in range (3):
            try:
                # Reinitialize connection for each article
                llm = None
                llm = self.llm_manager.initialize_connection()
                response = llm.invoke(self._create_analysis_prompt(article_data))
                
                dict_string = response[response.find('{'):response.rfind('}')+1]
                # print(dict_string)

                # Apply cleaning
                # First, find and replace any nested double quotes with single quotes
                dict_string = dict_string.replace('"', "'")

                # Then wrap the dictionary keys and values with double quotes
                dict_string = dict_string.replace("{'", '{"')
                dict_string = dict_string.replace("':", '":')
                dict_string = dict_string.replace("': ", '": ')
                dict_string = dict_string.replace(", '", ', "')
                dict_string = dict_string.replace("'}", '"}')
                print(dict_string)

                # Use eval() to safely convert string to dictionary
                result = eval(dict_string)
                
                # Validate it's a dictionary
                if not isinstance(result, dict):
                    raise ValueError("Result is not a dictionary")

                # Additional validation
                required_fields = ['main_category', 'sub_category', 'heading', 'subheading']
                if not all(field in result for field in required_fields):
                    return None

                return {
                    'mainCategory': result['main_category'].strip('.,'),
                    'subCategory': result['sub_category'].strip('.,'),
                    'heading': result['heading'].strip('.,'),
                    'subheading': result['subheading'].strip('.,')
                }
            except LLMTimeoutError:
                print(f"Timeout on attempt {attempt + 1}")
                time.sleep(2 ** attempt)
            except LLMConnectionError:
                print(f"Connection error on attempt {attempt + 1}")
                self.llm_manager = LLMManager()  # Reinitialize manager

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
        try:
            # Initialize with specific database
            cred = credentials.Certificate(
                '/Users/byungjoopark/Desktop/Coding/ehco-dev/firebase/config/serviceAccountKey.json')
            firebase_admin.initialize_app(cred, {
                'databaseURL': 'https://crawling-test-1.firebaseio.com'
            })
            self.db = firestore.Client.from_service_account_json(
                '/Users/byungjoopark/Desktop/Coding/ehco-dev/firebase/config/serviceAccountKey.json',
                database='crawling-test-1'
            )
        except ValueError as e:
            if "The default Firebase app already exists" in str(e):
                # If app is already initialized, just get the client with specific database
                self.db = firestore.Client.from_service_account_json(
                    '/Users/byungjoopark/Desktop/Coding/ehco-dev/firebase/config/serviceAccountKey.json',
                    database='crawling-test-1'
                )
            else:
                raise e
            
        # Initialize Selenium
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
        def generate_doc_id(url: str) -> str:
            return hashlib.md5(url.encode()).hexdigest()

        try:
            doc_id = generate_doc_id(article_data['url'])
            doc_ref = self.db.collection('news').document(doc_id)
            doc = doc_ref.get()

            if doc.exists:
                print(f"Article already exists: {article_data['title'][:50]}...")
                return False

            analyzed_data = self.analyzer.analyze_article({
                'title': article_data['title'],
                'content': article_data['content']
            })

            if not analyzed_data:
                print(f"Article filtered out: {article_data['title'][:100]}")
                return False

            # Simplified date parsing - extract only the date part
            try:
                # Split the date string and take only the date part before any space
                date_only = article_data['date'].split()[0]  # This will get '2023.11.12' from '2023.11.12 14:06'
                article_date = datetime.strptime(date_only, '%Y.%m.%d')
            except ValueError as e:
                print(f"Error parsing date {article_data['date']}: {str(e)}")
                article_date = datetime.now()

            doc_data = {
                'title': article_data['title'],
                'content': article_data['content'],
                'url': article_data['url'],
                'thumbnail': article_data.get('thumbnail', ''),
                'source': 'Yonhap News',
                'date': article_date,
                'celebrity': self.celebrity_id,
                'mainCategory': analyzed_data['mainCategory'],
                'subCategory': analyzed_data['subCategory'],
                'heading': analyzed_data['heading'],
                'subheading': analyzed_data['subheading'],
                'contextLine': '',
                'relatedArticles': [],
                'isMainArticle': True,
                'created_at': firestore.SERVER_TIMESTAMP
            }

            self.processed_articles.append(doc_data)
            doc_ref.set(doc_data)

            print(f"Saved article: {doc_data['title'][:50]}... as {analyzed_data['mainCategory']}")
            return True

        except Exception as e:
            print(f"Error saving to Firebase: {str(e)}")
            return False

    def save_backup_files(self):
        """Save backup files with change tracking"""
        backup_dir = "python/backup"
        os.makedirs(backup_dir, exist_ok=True)
    
        def compare_and_save(new_data, file_path, type_label):
            # Convert new data to DataFrame
            new_df = pd.DataFrame(new_data)
            new_df['status'] = 'CURRENT'
    
            # Check if file exists
            file_exists = os.path.exists(file_path)
            
            if file_exists:
                try:
                    existing_df = pd.read_csv(file_path, encoding='utf-8-sig')
                    print(f"Loaded existing {type_label} backup file")
                    
                    # Mark entries that exist in old but not in new (deleted)
                    deleted_mask = ~existing_df['url'].isin(new_df['url'])
                    deleted_entries = existing_df[deleted_mask].copy()
                    
                    if not deleted_entries.empty:
                        deleted_entries['status'] = 'DELETED'
                        combined_df = pd.concat([new_df, deleted_entries], ignore_index=True)
                        print(f"Found {len(deleted_entries)} deleted entries in {type_label} file")
                    else:
                        combined_df = new_df
                        print(f"No deleted entries found in {type_label} file")
                    
                    # Sort by date to maintain chronological order
                    combined_df['date'] = pd.to_datetime(combined_df['date'])
                    combined_df = combined_df.sort_values('date', ascending=False)
                except Exception as e:
                    print(f"Error reading existing file: {str(e)}")
                    combined_df = new_df
            else:
                print(f"Creating new {type_label} file")
                combined_df = new_df
    
            # Save the combined data
            combined_df.to_csv(file_path, index=False, encoding='utf-8-sig')
            print(f"{type_label} backup saved to: {file_path}")
    
            return combined_df
    
        if self.raw_articles:
            raw_filename = f'{backup_dir}/raw_koreaherald_{self.celebrity_id}.csv'
            raw_df = compare_and_save(self.raw_articles, raw_filename, "raw")
    
        if self.processed_articles:
            processed_filename = f'{backup_dir}/processed_koreaherald_{self.celebrity_id}.csv'
            processed_df = compare_and_save(self.processed_articles, processed_filename, "processed")

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
        {"name_eng": "IU", "name_kr": "아이유"}
    ]
    
    for celebrity in celebrities:
        try:
            print(f"\n{'='*50}")
            print(f"Starting crawl for {celebrity['name_eng']}")
            print(f"{'='*50}\n")
            
            max_retries = 3
            crawler = None
            
            for attempt in range(max_retries):
                try:
                    crawler = KoreaHeraldCrawler(celebrity)
                    crawler.crawl()
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        print(f"Failed to crawl for {celebrity['name_eng']} after {max_retries} attempts")
                        print(f"Error: {str(e)}")
                    else:
                        print(f"Attempt {attempt + 1} failed, retrying...")
                        time.sleep(5)
            
            # Save backup files outside the retry loop
            if crawler and (crawler.raw_articles or crawler.processed_articles):
                try:
                    crawler.save_backup_files()
                except Exception as e:
                    print(f"Error saving backup files: {str(e)}")
                    # Don't retry for backup errors
            
        except Exception as e:
            print(f"Error processing {celebrity['name_eng']}: {str(e)}")
            continue
        
        print("\nWaiting 30 seconds before processing next celebrity...")
        time.sleep(30)

if __name__ == "__main__":
    main()