import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
from typing import List
import asyncio
from openai import OpenAI

class NewsManager:
    def __init__(self):
        self.db = self.setup_firebase()
        self.setup_deepseek()
        
    # setup deepseek
    def setup_deepseek(self):
        """Initialize DeepSeek API client using OpenAI-compatible SDK"""
        load_dotenv()
        api_key = os.getenv('DEEPSEEK_API_KEY')  # Make sure to set this in your .env
        
        if not api_key:
            raise ValueError("DEEPSEEK_API_KEY not found in environment variables")
        
        # Initialize DeepSeek client (OpenAI-compatible)
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"  # DeepSeek's API endpoint
        )
        self.model = "deepseek-chat"  # or "deepseek-v3" if available
        
        print("✓ DeepSeek client initialized successfully")
        
    
    # Your existing setup_firebase method here
    def setup_firebase(self):
        """Initialize Firebase with environment variables and proper error handling"""
        # Load environment variables
        load_dotenv()
        
        try:
            # Get configuration from environment variables
            config_path = os.getenv('FIREBASE_CONFIG_PATH')
            database_url = os.getenv('FIREBASE_DEFAULT_DATABASE_URL')
            
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
                    config_path
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

    # end connections to firebase and anthropic
    async def close(self):
        """Properly close any resources"""
        try:
            if hasattr(self.client, 'close'):
                if asyncio.iscoroutinefunction(self.client.close):
                    await self.client.close()
                else:
                    self.client.close()
        except Exception as e:
            print(f"Warning: Error while closing DeepSeek client: {e}")