# content_manager.py

import asyncio
from datetime import datetime
from typing import List, Dict
from collections import defaultdict

class ContentGenerationManager:
    def __init__(self, news_manager):
        self.news_manager = news_manager
        self.batch_size = 20
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