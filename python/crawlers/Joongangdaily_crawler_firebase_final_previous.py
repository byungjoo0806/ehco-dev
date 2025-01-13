from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
from datetime import datetime
import os
import time

class JoongAngCrawler:
    def __init__(self, celebrity):
        """
        Initialize crawler with celebrity information
        celebrity: dict with keys 'name_eng', 'name_kr'
        """
        self.celebrity = celebrity
        self.keyword = celebrity['name_eng']
        self.base_url = f'https://koreajoongangdaily.joins.com/section/searchResult/{self.keyword}?searchFlag=1'
        self.articles = []
        self.seen_urls = set()
        
        # Initialize Firebase
        try:
            self.db = firestore.client()
        except:
            cred = credentials.Certificate('/Users/ryujunhyoung/Desktop/EHCO/firebase/config/serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
        
        # Initialize Selenium driver
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        self.driver = webdriver.Chrome(options=options)

    def save_to_firebase(self, article_data):
        """Save article to Firebase using hierarchical structure"""
        try:
            # Try both date formats
            try:
                # Try the new format (YYYY-MM-DD)
                date_obj = datetime.strptime(article_data['date'], '%Y-%m-%d')
            except ValueError:
                # Try the old format (MMM. DD, YYYY)
                date_obj = datetime.strptime(article_data['date'], '%b. %d, %Y')
                
            doc_id = f"joongang_{date_obj.strftime('%Y%m%d')}_{int(time.time()*1000)}"
            
            # Create the document path: celebrities/{celebrity_id}/news/{article_id}
            celebrity_id = self.celebrity['name_eng'].lower().replace(' ', '')
            doc_ref = self.db.collection('celebrities').document(celebrity_id).collection('news').document(doc_id)
            
            # Add metadata to article data
            article_data.update({
                'celebrity': self.celebrity['name_eng'],
                'celebrity_kr': self.celebrity['name_kr'],
                'created_at': firestore.SERVER_TIMESTAMP,
                'source': 'joongang',
                'formatted_date': date_obj.strftime('%Y-%m-%d')  # Store standardized date format
            })
            
            # Save to Firebase
            doc_ref.set(article_data)
            print(f"Saved article: {article_data['title'][:50]}...")
            
            return True
        except Exception as e:
            print(f"Error saving to Firebase: {e}")
            return False

    def parse_article(self, article):
        """Parse article from webpage"""
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
            snippet = article.find_element(By.CLASS_NAME, 'mid-article-content3').text.strip()
            
            try:
                thumbnail = article.find_element(By.TAG_NAME, 'img').get_attribute('src')
            except NoSuchElementException:
                thumbnail = ''

            return {
                'title': title,
                'url': url,
                'date': date,
                'snippet': snippet,
                'thumbnail': thumbnail
            }
        except Exception as e:
            print(f"Error parsing article: {e}")
            return None

    def crawl(self):
        """Main crawling function"""
        print(f"Starting crawl for {self.celebrity['name_eng']}...")
        self.driver.get(self.base_url)
        
        # Wait for initial articles
        try:
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, 'mid-article3'))
            )
        except TimeoutException:
            print("No articles found")
            self.driver.quit()
            return
        
        successful_saves = 0
        
        while True:
            # Get current articles
            articles = self.driver.find_elements(By.CLASS_NAME, 'mid-article3')
            initial_count = len(self.articles)
            
            # Parse and save articles
            for article in articles:
                article_data = self.parse_article(article)
                if article_data:
                    if self.save_to_firebase(article_data):
                        self.articles.append(article_data)
                        successful_saves += 1
            
            # Check if we got any new articles
            if len(self.articles) == initial_count:
                break
                
            # Try to click "More" button
            try:
                more_button = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.CLASS_NAME, 'service-more-btn'))
                )
                self.driver.execute_script("arguments[0].click();", more_button)
                time.sleep(1)
            except TimeoutException:
                print("No more articles to load")
                break
            
            print(f"Found {len(self.articles)} articles so far...")

        self.driver.quit()
        print(f"Crawl completed. Successfully saved {successful_saves} articles")
        
        # Save backup CSV if we have articles
        if self.articles:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'joongang_{self.celebrity["name_eng"].lower().replace(" ", "")}_{timestamp}.csv'
            pd.DataFrame(self.articles).to_csv(filename, index=False, encoding='utf-8-sig')
            print(f"Backup CSV saved to: {filename}")

def main():
    # Celebrity configurations
    celebrities = [
        {"name_eng": "IU", "name_kr": "아이유"},
        {"name_eng": "Kim Soo Hyun", "name_kr": "김수현"},
        {"name_eng": "Han So Hee", "name_kr": "한소희"}
    ]
    
    # Crawl for each celebrity
    for celebrity in celebrities:
        crawler = JoongAngCrawler(celebrity)
        crawler.crawl()

if __name__ == "__main__":
    main()