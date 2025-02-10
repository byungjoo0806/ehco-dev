import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
from anthropic import Anthropic

class NewsManager:
    def __init__(self):
        self.db = self.setup_firebase()
        self.setup_anthropic()
        
    # setup Anthropic
    def setup_anthropic(self):
        load_dotenv()
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
        self.client = Anthropic(api_key=api_key)
        self.model = "claude-3-5-sonnet-20241022"
    
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
    def fetch_multiple_fields(self, field_names, celebrity_name):
        """Fetch specific fields from all documents in the news collection"""
        try:
            news_ref = self.db.collection('news')
            docs = news_ref.where('celebrity', '==', celebrity_name).stream()
            
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