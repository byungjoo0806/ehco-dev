from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, firestore
import requests
import json

class ArticleOrganizer:
    def __init__(self):
        try:
            self.db = firestore.client()
        except Exception as e:
            cred = credentials.Certificate('/Users/ryujunhyoung/Desktop/EHCO/firebase/config/serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("Connected to Firebase")

    def identify_topic_groups(self, articles):
        """Use Ollama to identify topics and group articles"""
        try:
            print(f"\nAnalyzing {len(articles)} articles for grouping...")
            
            sorted_articles = sorted(articles, key=lambda x: x.get('formatted_date', ''), reverse=True)
            
            articles_text = "\n".join([
                f"Title: {article.get('title', '')}\nDate: {article.get('formatted_date', '')}\nContent: {article.get('content', '')}\nID: {article.get('id', '')}\n"
                for article in sorted_articles
            ])

            prompt = f"""You are a news editor responsible for grouping related articles.

Task: Analyze these articles about {sorted_articles[0].get('celebrity', '')} and group them by their core topics or stories.

Guidelines:
1. Group articles that are about the SAME NEWS STORY or CLOSELY RELATED DEVELOPMENTS of a story
2. Main article should be the most recent and comprehensive article about the topic
3. Only group articles that are DIRECTLY related (same event, story, or immediate follow-ups)
4. DO NOT group articles just because they mention similar themes
5. Each article should only belong to one group
6. Articles about different events, even if in the same category, should NOT be grouped

Examples of what should be grouped:
- An initial news report and its follow-up stories
- Different aspects of the same event
- Direct cause and effect stories
- Official announcement and related developments

Examples of what should NOT be grouped:
- Articles that just mention similar topics
- Stories that are thematically similar but about different events
- Articles that only share the same category but aren't about the same story

Return ONLY valid JSON in this format:
{{
    "article_groups": [
        {{
            "main_article_id": "ID of the most recent/comprehensive article",
            "related_article_ids": ["IDs of directly related articles"]
        }}
    ]
}}

Articles to analyze:
{articles_text}"""

            print("Sending request to Ollama...")
            response = requests.post(
                'http://localhost:11434/api/generate', 
                json={
                    'model': 'llama3.2',
                    'prompt': prompt,
                    'stream': False
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                print("Received response from Ollama")
                try:
                    # Debug: Print raw response
                    print("Raw Ollama response:", result['response'])
                    
                    response_text = result['response']
                    json_start = response_text.find('{')
                    json_end = response_text.rfind('}') + 1
                    if json_start >= 0 and json_end > json_start:
                        json_str = response_text[json_start:json_end]
                        # Debug: Print extracted JSON string
                        print("Extracted JSON string:", json_str)
                        
                        groups_data = json.loads(json_str)
                        # Validate groups
                        if 'article_groups' in groups_data:
                            valid_groups = []
                            for group in groups_data['article_groups']:
                                # Verify all referenced articles exist
                                main_id = group.get('main_article_id')
                                related_ids = group.get('related_article_ids', [])
                                
                                # Check if all IDs are valid
                                all_ids = set([main_id] + related_ids)
                                existing_ids = set(article['id'] for article in sorted_articles)
                                
                                if all_ids.issubset(existing_ids):
                                    valid_groups.append(group)
                                else:
                                    print(f"Skipping group with invalid article IDs: {all_ids - existing_ids}")
                            
                            return {"article_groups": valid_groups}
                        else:
                            print("No article_groups found in parsed data")
                            return {"article_groups": []}
                    else:
                        print("No valid JSON found in response")
                        return {"article_groups": []}
                        
                except json.JSONDecodeError as e:
                    print(f"Error parsing Ollama response: {e}")
                    print(f"Problematic JSON string: {json_str}")
                    return {"article_groups": []}
            else:
                print(f"Error from Ollama API: {response.status_code}")
                print(f"Response content: {response.text}")
                return {"article_groups": []}
                
        except Exception as e:
            print(f"Error in identify_topic_groups: {str(e)}")
            print(f"Full error details: {e.__class__.__name__}: {str(e)}")
            return {"article_groups": []}

    def update_article_groups(self, groups):
        """Update Firebase with article groupings"""
        try:
            batch = self.db.batch()
            group_count = 0
            
            print("\nStarting article group updates...")
            print(f"Total groups to process: {len(groups.get('article_groups', []))}")
            
            for group in groups.get('article_groups', []):
                try:
                    main_id = group.get('main_article_id')
                    related_ids = group.get('related_article_ids', [])
                    
                    # Debug prints
                    print(f"\nProcessing group {group_count + 1}:")
                    print(f"Main ID: {main_id}")
                    print(f"Related IDs: {related_ids}")

                    # Verify documents exist before updating
                    main_ref = self.db.collection('news').document(main_id)
                    main_doc = main_ref.get()
                    
                    if not main_doc.exists:
                        print(f"Warning: Main article {main_id} not found in Firestore")
                        continue

                    print(f"Found main article - Title: {main_doc.get('title')}")
                    
                    # Update main article
                    update_data = {
                        'isMainArticle': True,
                        'relatedArticles': related_ids,
                        'mainArticleId': None  # Main articles don't have a mainArticleId
                    }
                    
                    print(f"Updating main article with data: {update_data}")
                    batch.update(main_ref, update_data)
                    
                    # Update related articles
                    for article_id in related_ids:
                        if article_id != main_id:
                            related_ref = self.db.collection('news').document(article_id)
                            related_doc = related_ref.get()
                            
                            if not related_doc.exists:
                                print(f"Warning: Related article {article_id} not found in Firestore")
                                continue
                                
                            print(f"Found related article - Title: {related_doc.get('title')}")
                            
                            related_update = {
                                'isMainArticle': False,
                                'relatedArticles': related_ids,
                                'mainArticleId': main_id
                            }
                            print(f"Updating related article {article_id} with data: {related_update}")
                            batch.update(related_ref, related_update)
                    
                    group_count += 1
                        
                except Exception as e:
                    print(f"Error processing group: {str(e)}")
                    print(f"Full error details: {e.__class__.__name__}: {str(e)}")
                    continue
                
            if group_count > 0:
                print(f"\nCommitting {group_count} groups to Firebase...")
                batch.commit()
                print("Successfully committed updates to Firebase")
            else:
                print("\nNo groups to commit to Firebase")
                
        except Exception as e:
            print(f"Error in update_article_groups: {str(e)}")
            print(f"Full error details: {e.__class__.__name__}: {str(e)}")

    def organize_articles(self, celebrity: str):
        """Organize articles into topic groups with headers"""
        try:
            # Get articles from the last 6 months
            six_months_ago = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
            print(f"\nProcessing articles for {celebrity} from {six_months_ago}")
            
            # First get all articles for this celebrity
            articles_query = self.db.collection('news')\
                .where('celebrity', '==', celebrity.lower())\
                .get()
            
            # Convert to list and filter by date
            articles_data = []
            for doc in articles_query:
                data = doc.to_dict()
                data['id'] = doc.id
                if data.get('formatted_date', '') >= six_months_ago:
                    articles_data.append(data)
                    print(f"Found: {data.get('title', '')} ({data.get('formatted_date', '')})")
            
            print(f"Total articles found: {len(articles_data)}")
            
            if len(articles_data) < 2:
                print("Not enough articles to create groups")
                return

            # Identify and create groups
            groups = self.identify_topic_groups(articles_data)
            
            # Update Firebase if groups were found
            if groups.get('article_groups'):
                self.update_article_groups(groups)
            else:
                print("No topic groups identified")
                    
        except Exception as e:
            print(f"Error organizing articles for {celebrity}: {str(e)}")
            print(f"Full error details: {e.__class__.__name__}: {str(e)}")

def main():
    try:
        organizer = ArticleOrganizer()
        celebrities = ['iu', 'kimsoohyun', 'hansohee']
        
        for celebrity in celebrities:
            print(f"\n{'='*50}")
            print(f"Organizing articles for {celebrity}...")
            organizer.organize_articles(celebrity)
            print(f"Completed organizing for {celebrity}")
            print(f"{'='*50}\n")
    except Exception as e:
        print(f"Error in main: {str(e)}")
        print(f"Full error details: {e.__class__.__name__}: {str(e)}")

if __name__ == "__main__":
    main()