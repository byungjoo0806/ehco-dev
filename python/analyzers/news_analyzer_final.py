# File: python/analyzers/news_analyzer_final.py

from langchain_ollama import OllamaLLM
import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import json
from typing import Dict, List
import time
from datetime import datetime

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

        # Initialize Firebase
        try:
            self.db = firestore.client()
        except:
            cred = credentials.Certificate('/Users/ryujunhyoung/EHCO/firebase/config/serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("Successfully connected to Firebase")

        self.celebrity_name = celebrity_name
        self.korean_name = korean_name
        
        # Categories remain the same...
        self.categories = {
            "Music": [...],  # Your existing categories
            "Acting": [...],
            "Promotion": [...],
            "Social": [...],
            "Controversy": [...]
        }

    def upload_batch_to_firebase(self, articles: List[Dict], batch_size: int = 500):
        """Upload a batch of articles to Firebase"""
        batch = self.db.batch()
        count = 0
        total = 0

        for article in articles:
            # Create new document reference
            doc_ref = self.db.collection('news').document()
            
            # Add server timestamp
            article['timestamp'] = firestore.SERVER_TIMESTAMP
            
            # Add to batch
            batch.set(doc_ref, article)
            count += 1
            total += 1
            
            # If batch is full, commit it
            if count >= batch_size:
                print(f"Committing batch {total-count+1} to {total}...")
                batch.commit()
                batch = self.db.batch()
                count = 0
                time.sleep(1)  # Prevent rate limiting

        # Commit any remaining documents
        if count > 0:
            print(f"Committing final batch {total-count+1} to {total}...")
            batch.commit()

        print(f"Successfully uploaded {total} articles to Firebase")

    def process_csv(self, input_file: str):
        """Process articles and upload directly to Firebase"""
        try:
            print(f"Reading articles from {input_file}")
            df = pd.read_csv(input_file)
            processed_articles = []
            
            total = len(df)
            successful = 0
            current_batch = []
            
            for idx, article in df.iterrows():
                print(f"\nProcessing article {idx + 1}/{total}")
                try:
                    result = self.analyze_article(dict(article))
                    if result:
                        current_batch.append(result)
                        successful += 1
                        print(f"Categorized as: {result['MainCategory']}/{result['SubCategory']}")
                        
                        # Upload in batches of 100 while processing
                        if len(current_batch) >= 100:
                            self.upload_batch_to_firebase(current_batch)
                            current_batch = []
                            
                except Exception as e:
                    print(f"Error processing article {idx + 1}: {str(e)}")
                    continue
            
            # Upload any remaining articles
            if current_batch:
                self.upload_batch_to_firebase(current_batch)
            
            print(f"\nProcessed and uploaded successfully: {successful} of {total} articles")
            
        except Exception as e:
            print(f"Error processing CSV: {str(e)}")

def main():
    try:
        analyzer = NewsAnalyzer("IU", "아이유")
        analyzer.process_csv("joongang_iu_20250102_142203.csv")
    except Exception as e:
        print(f"Error in main: {str(e)}")

if __name__ == "__main__":
    main()