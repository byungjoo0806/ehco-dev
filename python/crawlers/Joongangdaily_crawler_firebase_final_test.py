# File: python/crawlers/Joongangdaily_crawler_firebase_final.py

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
from typing import Dict, List, Optional, Tuple
import os

class NewsAnalyzer:
    def __init__(self, celebrity_name: str, korean_name: str):
        print(f"Initializing analyzer for {celebrity_name}...")
        
        self.categories = {
            "Music": ["album", "concert", "song", "musical", "performance", "awards", "chart"],
            "Acting": ["drama", "film", "movie", "series", "show", "cast", "role"],
            "Promotion": ["advertisement", "campaign", "endorsement", "brand", "commercial"],
            "Social": ["personal", "dating", "relationship", "lifestyle", "social media", "charity"],
            "Controversy": ["issue", "dispute", "controversy", "scandal", "conflict"]
        }
        
        try:
            self.llm = OllamaLLM(model="llama3.2:latest")
            print("Successfully connected to Ollama")
        except Exception as e:
            print(f"Error connecting to Ollama: {str(e)}")
            raise

        self.celebrity_name = celebrity_name
        self.korean_name = korean_name

    def analyze_article(self, article_data: Dict) -> Tuple[Optional[Dict], Optional[Dict]]:
        # Quick name check
        if (self.celebrity_name.lower() not in article_data['title'].lower() and 
            self.korean_name not in article_data['title'] and 
            self.celebrity_name.lower() not in article_data['content'].lower() and 
            self.korean_name not in article_data['content']):
            return None, None

        try:
            # Get main category first
            category_prompt = f"""
            Categorize this article about {self.celebrity_name} into exactly one of these categories:
            - Music (songs, albums, concerts, music shows)
            - Acting (dramas, movies, TV appearances)
            - Promotion (advertising, endorsements, interviews)
            - Social (personal life, social media, public appearances)
            - Controversy (any issues or disputes)

            Article:
            Title: {article_data['title']}
            Content: {article_data['content'][:500]}

            Return only one category name:
            """
            
            main_category = self.llm.invoke(category_prompt).strip()
            
            # Get subcategory for CSV backup
            subcategory_prompt = f"""
            For this article about {self.celebrity_name}, provide specific details about the type of {main_category}.
            
            Article:
            Title: {article_data['title']}
            Content: {article_data['content'][:500]}

            Return a brief phrase (2-3 words max) describing the specific type of {main_category}:
            """
            
            subcategory = self.llm.invoke(subcategory_prompt).strip()
            
            # Normalize main category
            category_map = {
                'music': 'Music',
                'acting': 'Acting',
                'promotion': 'Promotion',
                'social': 'Social',
                'controversy': 'Controversy'
            }
            
            main_category = next((v for k, v in category_map.items() 
                                if k in main_category.lower()), 'Social')
            
            # Prepare both Firebase and CSV data
            firebase_data = {
                'mainCategory': main_category,
                **article_data
            }
            
            csv_data = {
                **firebase_data,
                'subCategory': subcategory
            }
            
            return firebase_data, csv_data
            
        except Exception as e:
            print(f"Error in analysis: {e}")
            # Fallback to basic categorization
            if self.celebrity_name.lower() in article_data['title'].lower() or self.korean_name in article_data['title']:
                basic_data = {
                    'mainCategory': 'Social',
                    **article_data
                }
                return basic_data, basic_data
            return None, None

class EnhancedJoongAngCrawler:
    def __init__(self, celebrity):
        self.celebrity = celebrity
        self.keyword = celebrity['name_eng'].replace(" ", "+")
        self.base_url = f'https://koreajoongangdaily.joins.com/section/searchResult/{self.keyword}?searchFlag=1'
        self.articles = []  # For CSV backup with subcategories
        self.seen_urls = set()
        self.analyzer = NewsAnalyzer(celebrity['name_eng'], celebrity['name_kr'])
        
        # Initialize Firebase with absolute path
        try:
            self.db = firestore.client()
        except:
            cred = credentials.Certificate('/Users/ryujunhyoung/Desktop/EHCO/firebase/config/serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
        
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        self.driver = webdriver.Chrome(options=options)

    def parse_article(self, article):
        try:
            # Get URL
            link = article.find_element(By.CLASS_NAME, 'media')
            url = link.get_attribute('href')
            
            # Skip if we've seen this URL
            if url in self.seen_urls:
                return None
            
            self.seen_urls.add(url)
            
            # Get title and other elements
            title = article.find_element(By.CLASS_NAME, 'mid-article-title3').text.strip()
            date = article.find_element(By.CLASS_NAME, 'media-date').text.strip()
            content = article.find_element(By.CLASS_NAME, 'mid-article-content3').text.strip()
            
            try:
                thumbnail = article.find_element(By.TAG_NAME, 'img').get_attribute('src')
            except NoSuchElementException:
                thumbnail = ''

            return {
                'title': title,
                'url': url,
                'date': date,
                'content': content,
                'thumbnail': thumbnail
            }
        except Exception as e:
            print(f"Error parsing article: {e}")
            return None

    def save_to_firebase(self, article_data):
        try:
            # Parse and standardize date
            date_str = article_data['date'].strip()
            if not date_str:
                print(f"Empty date string for article: {article_data['title'][:50]}...")
                return False
                
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            except ValueError:
                try:
                    date_obj = datetime.strptime(date_str, '%b. %d, %Y')
                except ValueError:
                    print(f"Unable to parse date: {date_str}")
                    return False
            
            # Analyze article
            firebase_data, csv_data = self.analyzer.analyze_article({
                'title': article_data['title'],
                'content': article_data['content']
            })
            
            if not firebase_data:
                print(f"Skipping irrelevant article: {article_data['title'][:50]}...")
                return False
            
            # Store processed article for CSV backup
            if csv_data:
                self.articles.append({
                    **csv_data,
                    'date': date_obj.strftime('%Y-%m-%d'),
                    'source': 'Korea JoongAng Daily'
                })
            
            # Save to Firebase
            doc_data = {
                'title': article_data['title'],
                'content': article_data['content'],
                'url': article_data['url'],
                'thumbnail': article_data.get('thumbnail', ''),
                'source': 'Korea JoongAng Daily',
                'date': firestore.SERVER_TIMESTAMP,
                'formatted_date': date_obj.strftime('%Y-%m-%d'),
                'celebrity': self.celebrity['name_eng'].lower().replace(" ", ""),
                'mainCategory': firebase_data['mainCategory'],
                'created_at': firestore.SERVER_TIMESTAMP
            }
            
            doc_ref = self.db.collection('news').document()
            doc_ref.set(doc_data)
            
            print(f"Saved article: {doc_data['title'][:50]}... as {firebase_data['mainCategory']}")
            return True
            
        except Exception as e:
            print(f"Error saving to Firebase: {e}")
            return False

    def crawl(self):
        print(f"Starting crawl for {self.celebrity['name_eng']}...")
        
        try:
            self.driver.get(self.base_url)
            time.sleep(3)  # Give time for initial load
            
            # Wait for initial articles with timeout
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CLASS_NAME, 'mid-article3'))
                )
            except TimeoutException:
                print("No articles found")
                return
            
            successful_saves = 0
            page_num = 1
            consecutive_irrelevant = 0  # Track consecutive irrelevant articles
            
            while True:
                print(f"\nProcessing page {page_num}...")
                
                # Set a timeout for finding articles on the page
                try:
                    articles = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_all_elements_located((By.CLASS_NAME, 'mid-article3'))
                    )
                except TimeoutException:
                    print("Could not find articles on page")
                    break
                
                found_relevant = False  # Track if we found any relevant articles on this page
                
                for article in articles:
                    article_data = self.parse_article(article)
                    if article_data:
                        # Try to save to Firebase
                        if self.save_to_firebase(article_data):
                            successful_saves += 1
                            consecutive_irrelevant = 0  # Reset counter on successful save
                            found_relevant = True
                        else:
                            consecutive_irrelevant += 1
                
                # If we didn't find any relevant articles on this page
                if not found_relevant:
                    consecutive_irrelevant += 1
                
                # Check if we should stop
                if consecutive_irrelevant >= 10:  # Stop after 10 consecutive irrelevant articles/pages
                    print(f"No relevant articles found in last {consecutive_irrelevant} attempts, moving to next celebrity...")
                    break
                    
                # Also add a maximum page limit as a safeguard
                if page_num >= 100:  # Adjust this number based on your needs
                    print("Reached maximum page limit, moving to next celebrity...")
                    break
                
                # Try to find and click "More" button
                try:
                    more_button = WebDriverWait(self.driver, 3).until(
                        EC.presence_of_element_located((By.CLASS_NAME, 'service-more-btn'))
                    )
                    if not more_button.is_displayed():
                        print("No more articles available")
                        break
                    self.driver.execute_script("arguments[0].click();", more_button)
                    time.sleep(2)  # Give time for new articles to load
                    page_num += 1
                except TimeoutException:
                    print("No more pages to load")
                    break
                except Exception as e:
                    print(f"Error clicking more button: {e}")
                    break

            print(f"Crawl completed. Successfully saved {successful_saves} articles")
            
            # Save backup CSV
            if self.articles:
                backup_dir = os.path.join(os.path.dirname(__file__), '..', 'backup')
                os.makedirs(backup_dir, exist_ok=True)
                
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = os.path.join(backup_dir, 
                                      f'processed_{self.celebrity["name_eng"].lower()}_{timestamp}.csv')
                pd.DataFrame(self.articles).to_csv(filename, index=False, encoding='utf-8-sig')
                print(f"Backup CSV saved to: {filename}")
                
        except Exception as e:
            print(f"Error during crawl: {e}")
        
        finally:
            try:
                self.driver.quit()
                print(f"Finished processing {self.celebrity['name_eng']}")
            except:
                pass

def main():
    celebrities = [
        {"name_eng": "IU", "name_kr": "아이유"},
        {"name_eng": "Kim Soo-hyun", "name_kr": "김수현"},
        {"name_eng": "Han So-hee", "name_kr": "한소희"}
    ]
    
    # Initialize Firebase once at the start
    try:
        db = firestore.client()
    except:
        cred = credentials.Certificate('/Users/ryujunhyoung/Desktop/EHCO/firebase/config/serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    
    for celebrity in celebrities:
        try:
            print(f"\nStarting crawl for {celebrity['name_eng']}...")
            crawler = EnhancedJoongAngCrawler(celebrity)
            crawler.crawl()
            print(f"Completed crawl for {celebrity['name_eng']}\n")
            time.sleep(2)  # Brief pause between celebrities
        except Exception as e:
            print(f"Error processing {celebrity['name_eng']}: {e}")

if __name__ == "__main__":
    main()