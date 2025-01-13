from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC 
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import pandas as pd
from datetime import datetime
import time

class KoreaHeraldCrawler:
   def __init__(self, celebrity):
       self.celebrity = celebrity
       self.articles = []
       self.seen_urls = set()
       
       options = webdriver.ChromeOptions()
       options.add_argument('--headless')
       self.driver = webdriver.Chrome(options=options)

   def parse_article(self, article):
       try:
           link = article.find_element(By.TAG_NAME, 'a')
           url = 'https://www.koreaherald.com' + link.get_attribute('href')
           
           if url in self.seen_urls:
               return None
           self.seen_urls.add(url)
           
           title = article.find_element(By.CLASS_NAME, 'news_title').text.strip()
           date = article.find_element(By.CLASS_NAME, 'date').text.strip()
           
           try:
               img_div = article.find_element(By.CLASS_NAME, 'news_img')
               thumbnail = img_div.find_element(By.TAG_NAME, 'img').get_attribute('src')
           except NoSuchElementException:
               thumbnail = ''

           try:
               snippet = article.find_element(By.CLASS_NAME, 'news_text').text.strip()
           except NoSuchElementException:
               snippet = ''

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
       print(f"Starting crawl for {self.celebrity['name_eng']}...")
       current_page = 1
       
       while True:
           if current_page == 1:
               page_url = f"https://www.koreaherald.com/search/detail?q={self.celebrity['name_eng']}&stype=NEWS"
           else:
               page_url = f"https://www.koreaherald.com/search/detail?page={current_page}&q={self.celebrity['name_eng']}&stype=NEWS&sort=&pageTop=true#pagetop"
               
           print(f"\nProcessing page {current_page}...")
           print(f"URL: {page_url}")
           
           try:
               self.driver.get(page_url)
               WebDriverWait(self.driver, 10).until(
                   EC.presence_of_element_located((By.CLASS_NAME, 'news_list'))
               )
           except TimeoutException:
               print("Page load failed")
               break

           articles = self.driver.find_elements(By.CSS_SELECTOR, '.news_list li')
           if not articles:
               print("No articles found on page")
               break
               
           articles_found = 0
           for article in articles:
               article_data = self.parse_article(article)
               if article_data:
                   self.articles.append(article_data)
                   articles_found += 1
                   print(f"Found article: {article_data['title'][:50]}...")
                   
           if articles_found == 0:
               print("No new articles found")
               break
               
           print(f"Found {articles_found} articles on page {current_page}")
           print(f"Total articles so far: {len(self.articles)}")
           
           current_page += 1
           time.sleep(2)  # Increased delay between pages

       self.driver.quit()
       print(f"\nCrawl completed. Total articles found: {len(self.articles)}")
       
       if self.articles:
           timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
           filename = f'koreaherald_{self.celebrity["name_eng"].lower().replace(" ", "")}_{timestamp}.csv'
           df = pd.DataFrame(self.articles)
           df.to_csv(filename, index=False, encoding='utf-8-sig')
           print(f"Results saved to: {filename}")
           return df
       return pd.DataFrame()

def main():
   celebrities = [
       {"name_eng": "IU", "name_kr": "아이유"},
       {"name_eng": "Kim Soo-hyun", "name_kr": "김수현"},
       {"name_eng": "Han So-hee", "name_kr": "한소희"}
   ]
   
   for celebrity in celebrities:
       crawler = KoreaHeraldCrawler(celebrity)
       crawler.crawl()
       print("\n" + "="*50 + "\n")

if __name__ == "__main__":
   main()