import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
from typing import List
import asyncio
from openai import OpenAI
from openai import AsyncOpenAI

class NewsManager:
    def __init__(self):
        self.db = self.setup_firebase()
        self.setup_deepseek()
        
    def setup_deepseek(self):
        """Initialize DeepSeek API client using the ASYNCHRONOUS client"""
        load_dotenv()
        api_key = os.getenv('DEEPSEEK_API_KEY')
        
        if not api_key:
            raise ValueError("DEEPSEEK_API_KEY not found in environment variables")
        
        # UPDATED: Instantiate AsyncOpenAI for use with 'await'
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )
        self.model = "deepseek-chat"
        
        print("✓ DeepSeek ASYNC client initialized successfully")
        
    def setup_firebase(self):
        """Initialize Firebase with environment variables and proper error handling"""
        load_dotenv()
        
        try:
            config_path = os.getenv('FIREBASE_CONFIG_PATH')
            database_url = os.getenv('FIREBASE_DEFAULT_DATABASE_URL')
            
            if not config_path:
                raise ValueError("FIREBASE_CONFIG_PATH not found in environment variables")
            if not database_url:
                raise ValueError("FIREBASE_DATABASE_URL not found in environment variables")
            if not os.path.exists(config_path):
                raise FileNotFoundError(f"Service account key not found at: {config_path}")
            
            try:
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
                db = firestore.client()
                print("Firestore client connected successfully")
                return db
            except Exception as e:
                print(f"Failed to get Firestore client: {e}")
                raise
                
        except Exception as e:
            print(f"Failed to initialize Firebase: {e}")
            raise

    async def close(self):
        """Properly close any resources"""
        try:
            if hasattr(self.client, 'close'):
                await self.client.close()
        except Exception as e:
            print(f"Warning: Error while closing DeepSeek client: {e}")
    
    
    # Add the fetch methods above
    def fetch_single_field(self, field_name):
        """Fetch a single specific field from all documents in the articles collection"""
        try:
            articles_ref = self.db.collection('articles')
            docs = articles_ref.stream()
            
            results = []
            for doc in docs:
                data = doc.to_dict()
                # Only extract the requested field if it exists
                if field_name in data:
                    results.append(data[field_name])
            
            return results, len(results)
        
        except Exception as e:
            print(f"Error fetching field '{field_name}' from articles: {e}")
            raise
    
    def fetch_multiple_fields(self, field_names, celebrity_name=None):
        """Fetch specific fields from all documents in the news collection
        If celebrity_name is provided, filter by that name, otherwise return all documents"""
        try:
            news_ref = self.db.collection('articles')
            
            # If celebrity_name is provided, filter by it, otherwise get all documents
            if celebrity_name:
                docs = news_ref.where('celebrity', '==', celebrity_name).stream()
            else:
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

    def migrate_timeline_data(self, figure_id_to_test: str = None):
        """
        Performs a one-time data migration to restructure curated_timeline documents.
        This revised script handles the nested data structure where event groups are
        located inside arrays within sub-category fields.
        """
        print("Starting REVISED timeline data migration script...")

        try:
            # 1. Get the figure(s) to process
            figures_ref = self.db.collection('selected-figures')
            if figure_id_to_test:
                print(f"--- RUNNING IN TEST MODE FOR FIGURE: {figure_id_to_test} ---")
                figures_stream = [figures_ref.document(figure_id_to_test).get()]
                if not figures_stream[0].exists:
                    print(f"Error: Test figure with ID '{figure_id_to_test}' not found.")
                    return
            else:
                print("--- RUNNING IN FULL MIGRATION MODE ---")
                figures_stream = figures_ref.stream()

            # 2. Loop through each figure
            for figure_doc in figures_stream:
                figure_id = figure_doc.id
                print(f"\n--- Processing Figure: {figure_id} ---")

                # 3. Fetch all article summaries for this figure to create a lookup map
                summary_docs = figure_doc.reference.collection('article-summaries').stream()
                summaries_map = {doc.id: doc.to_dict().get('event_contents', {}) for doc in summary_docs}
                if not summaries_map:
                    print("No article-summaries found. Cannot perform migration. Skipping.")
                    continue
                print(f"Created a lookup map with {len(summaries_map)} article summaries.")

                # 4. Process each main category document in the 'curated-timeline' subcollection
                timeline_docs = figure_doc.reference.collection('curated-timeline').stream()
                for main_cat_doc in timeline_docs:
                    print(f"  - Processing Main Category: {main_cat_doc.id}")
                    main_cat_data = main_cat_doc.to_dict()
                    updated_main_cat_data = {}
                    has_changes = False

                    # 5. Loop through each sub-category field (e.g., "Film & TV")
                    for sub_cat_name, event_group_array in main_cat_data.items():
                        if not isinstance(event_group_array, list):
                            updated_main_cat_data[sub_cat_name] = event_group_array # Keep non-array fields as is
                            continue

                        print(f"    - Processing Sub-Category: {sub_cat_name}")
                        new_event_group_array = []

                        # 6. Loop through each event group in the sub-category's array
                        for event_group in event_group_array:
                            original_points = event_group.get('timeline_points', [])
                            original_sources = event_group.get('sources', [])

                            if not original_points or not original_sources:
                                new_event_group_array.append(event_group) # No changes, add as is
                                continue
                            
                            has_changes = True # Mark that we need to update this document
                            new_timeline_points = []
                            
                            for point in original_points:
                                found_source_ids = set()
                                for source in original_sources:
                                    source_id = source.get('id')
                                    if not source_id: continue
                                    
                                    summary = summaries_map.get(source_id)
                                    if summary:
                                        for content_desc in summary.values():
                                            if content_desc == point.get('description'):
                                                found_source_ids.add(source_id)
                                                break
                                
                                new_timeline_points.append({
                                    'date': point.get('date'),
                                    'description': point.get('description'),
                                    'sourceIds': list(found_source_ids)
                                })
                            
                            # Create the new event group, keeping other potential fields
                            new_event_group = {**event_group, 'timeline_points': new_timeline_points}
                            del new_event_group['sources'] # Delete the old sources field
                            new_event_group_array.append(new_event_group)

                        updated_main_cat_data[sub_cat_name] = new_event_group_array

                    # 7. Update the main category document in Firestore if changes were made
                    if has_changes:
                        print(f"    -> Updating document '{main_cat_doc.id}' with new structure.")
                        main_cat_doc.reference.update(updated_main_cat_data)
                    else:
                        print(f"    -> No changes needed for document '{main_cat_doc.id}'.")

                print(f"Successfully processed data for {figure_id}.")
            
            print("\n✅ Migration completed successfully!")

        except Exception as e:
            print(f"\n❌ An error occurred during migration: {e}")
            raise
        
news_manager = NewsManager()