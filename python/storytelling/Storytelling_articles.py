import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
from anthropic import Anthropic
import json
from datetime import datetime
from typing import List, Dict, Any
import asyncio
from collections import defaultdict

class NewsManager:
    def __init__(self):
        self.db = self.setup_firebase()
        
    # setup Anthropic
    def setup_anthropic(self):
        load_dotenv()
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
        self.client = Anthropic(api_key=api_key)
        self.model = "claude-3-7-sonnet-20250219"
    
    # Your existing setup_firebase method here
    def setup_firebase(self):
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
    
    # Add the fetch methods above
    def fetch_multiple_fields(self, field_names):
        """Fetch specific fields from all documents in the news collection"""
        try:
            news_ref = self.db.collection('news')
            docs = news_ref.stream()
            
            documents = []
            for doc in docs:
                data = doc.to_dict()
                # Create a new dict with only the requested fields
                filtered_data = {field: data.get(field) for field in field_names if field in data}
                documents.append(filtered_data)
            
            return documents, len(documents)
        
        except Exception as e:
            print(f"Error fetching fields {field_names} from news: {e}")
            raise
            
    def create_prompt(self, articles: List[Dict]) -> str:
        """Create a prompt for Claude based on a batch of articles"""
        # Group articles by subcategory
        grouped_articles = defaultdict(list)
        for article in articles:
            grouped_articles[article.get('subcategory', 'general')].append(article)
        
        prompt = """You are a professional wiki content writer. Generate objective, well-sourced content following these requirements:

1. Write in Wikipedia style
2. Maintain neutral, objective tone
3. Include source attribution for each fact
4. Present information chronologically
5. Group related information together
6. Note any conflicting information from different sources

Please analyze these articles and generate:

1. An overview paragraph with source attributions
2. Detailed chronological content with source tracking

For each article, use this format for citations: [Source URL] (YYYY.MM.DD)

Here are the articles to analyze:
"""
        
        for subcategory, subcategory_articles in grouped_articles.items():
            prompt += f"\nSubcategory: {subcategory}\n"
            for article in subcategory_articles:
                prompt += f"\nURL: {article.get('url')}"
                prompt += f"\nDate: {article.get('formatted_date')}"
                prompt += f"\nContent: {article.get('content')}\n"
                
        return prompt
            
    async def process_batch(self, batch: List[Dict]) -> Dict:
        """Process a batch of articles using Claude API"""
        prompt = self.create_prompt(batch)
        
        try:
            response = await self.news_manager.client.messages.create(
                model=self.news_manager.model,
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            return {
                'subcategory': batch[0].get('subcategory', 'general'),
                'generated_content': response.content,
                'source_articles': [article['url'] for article in batch],
                'generation_date': datetime.now().isoformat(),
                'batch_size': len(batch)
            }
        except Exception as e:
            print(f"Error processing batch: {e}")
            return None        
    
    async def generate_and_store_content(self):
        """Main method to process all articles in batches and store results"""
        try:
            # Fetch all articles
            fields_to_fetch = ['url', 'content', 'category', 'subcategory', 'formatted_date']
            articles, total = self.news_manager.fetch_multiple_fields(fields_to_fetch)
            
            # Process in batches
            batches = [articles[i:i + self.batch_size] 
                      for i in range(0, len(articles), self.batch_size)]
            
            # Process batches concurrently
            tasks = [self.process_batch(batch) for batch in batches]
            results = await asyncio.gather(*tasks)
            
            # Store results
            for result in results:
                if result:
                    await self.store_generated_content(result)
                    
            return len(results)
            
        except Exception as e:
            print(f"Error in generate_and_store_content: {e}")
            raise
        
        
class ContentGenerationManager:
    def __init__(self, news_manager):
        self.news_manager = news_manager
        self.batch_size = 5  # Number of articles to process in each batch
        self.collection_name = 'generated_content'
        
    def create_prompt(self, articles: List[Dict]) -> str:
        """Create a prompt for Claude based on a batch of articles"""
        # Group articles by subcategory
        grouped_articles = defaultdict(list)
        for article in articles:
            grouped_articles[article.get('subcategory', 'general')].append(article)
        
        prompt = """You are a professional wiki content writer. Generate objective, well-sourced content following these requirements:

1. Write in Wikipedia style
2. Maintain neutral, objective tone
3. Include source attribution for each fact
4. Present information chronologically
5. Group related information together
6. Note any conflicting information from different sources

Please analyze these articles and generate:

1. An overview paragraph with source attributions
2. Detailed chronological content with source tracking

For each article, use this format for citations: [Source URL] (YYYY.MM.DD)

Here are the articles to analyze:
"""
        
        for subcategory, subcategory_articles in grouped_articles.items():
            prompt += f"\nSubcategory: {subcategory}\n"
            for article in subcategory_articles:
                prompt += f"\nURL: {article.get('url')}"
                prompt += f"\nDate: {article.get('formatted_date')}"
                prompt += f"\nContent: {article.get('content')}\n"
                
        return prompt

    async def process_batch(self, batch: List[Dict]) -> Dict:
        """Process a batch of articles using Claude API"""
        prompt = self.create_prompt(batch)
        
        try:
            response = await self.news_manager.client.messages.create(
                model=self.news_manager.model,
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            return {
                'subcategory': batch[0].get('subcategory', 'general'),
                'generated_content': response.content,
                'source_articles': [article['url'] for article in batch],
                'generation_date': datetime.now().isoformat(),
                'batch_size': len(batch)
            }
        except Exception as e:
            print(f"Error processing batch: {e}")
            return None

    async def generate_and_store_content(self):
        """Main method to process all articles in batches and store results"""
        try:
            # Fetch all articles
            fields_to_fetch = ['url', 'content', 'category', 'subcategory', 'formatted_date']
            articles, total = self.news_manager.fetch_multiple_fields(fields_to_fetch)
            
            # Process in batches
            batches = [articles[i:i + self.batch_size] 
                      for i in range(0, len(articles), self.batch_size)]
            
            # Process batches concurrently
            tasks = [self.process_batch(batch) for batch in batches]
            results = await asyncio.gather(*tasks)
            
            # Store results
            for result in results:
                if result:
                    await self.store_generated_content(result)
                    
            return len(results)
            
        except Exception as e:
            print(f"Error in generate_and_store_content: {e}")
            raise

    async def store_generated_content(self, content: Dict):
        """Store generated content in Firestore"""
        try:
            # Create a new collection for generated content
            doc_ref = self.news_manager.db.collection(self.collection_name).document()
            
            # Store the content
            doc_ref.set({
                'subcategory': content['subcategory'],
                'content': content['generated_content'],
                'source_articles': content['source_articles'],
                'generation_date': content['generation_date'],
                'batch_size': content['batch_size']
            })
            
            # Update original articles with reference to generated content
            for source_url in content['source_articles']:
                # Query to find the original article
                docs = self.news_manager.db.collection('news').where('url', '==', source_url).stream()
                for doc in docs:
                    doc.reference.update({
                        'generated_content_ref': doc_ref.id
                    })
                    
        except Exception as e:
            print(f"Error storing generated content: {e}")
            raise 
        
    
def main():
    try:
        # Initialize the NewsManager
        news_manager = NewsManager()
        
        # Specify which fields you want to fetch
        fields_to_fetch = ['url', 'content', 'category', 'subcategory', 'formatted_date', 'celebrity']  # Example fields
        documents, total_docs = news_manager.fetch_multiple_fields(fields_to_fetch)
        
        # Print total number of documents
        print(f"\nTotal number of documents: {total_docs}")
        
        # Print the documents
        print("\nFetched documents:")
        for doc in documents:
            print(doc)
            print("===========================================")
            
    except Exception as e:
        print(f"Error in main: {e}")

if __name__ == "__main__":
    main()