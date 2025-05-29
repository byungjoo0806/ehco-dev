import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
import sys

def setup_firebase():
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

def get_documents_missing_field_in_specific_subcollection(db, parent_collection, parent_doc_id, subcollection, field_name):
    """
    Retrieve and print document IDs from a specific parent document's subcollection where a specific field doesn't exist.
    
    Args:
        db: Firestore database client
        parent_collection: Name of the parent collection
        parent_doc_id: ID of the specific parent document
        subcollection: Name of the subcollection to query
        field_name: Name of the field that should not exist in the documents
        
    Returns:
        A list of subcollection document IDs that don't have the specified field
    """
    try:
        # Get reference to the parent document
        parent_doc_ref = db.collection(parent_collection).document(parent_doc_id)
        
        # Check if parent document exists
        if not parent_doc_ref.get().exists:
            print(f"Parent document '{parent_doc_id}' does not exist in collection '{parent_collection}'")
            return []
        
        # Get reference to the subcollection
        subcollection_ref = parent_doc_ref.collection(subcollection)
        
        # Fetch all documents in the subcollection
        subcollection_docs = subcollection_ref.stream()
        
        # Filter out documents where the field exists
        missing_field_docs = []
        
        for doc in subcollection_docs:
            data = doc.to_dict()
            # Check if the field doesn't exist in the document
            if field_name not in data:
                missing_field_docs.append(doc.id)
                print(f"Subdocument ID: {doc.id} - Missing field: {field_name}")
        
        print(f"\nFound {len(missing_field_docs)} documents in '{parent_collection}/{parent_doc_id}/{subcollection}' without the field '{field_name}'")
        return missing_field_docs
    
    except Exception as e:
        print(f"Error fetching documents without field '{field_name}': {e}")
        raise

def main():
    # Check if correct number of arguments is provided
    if len(sys.argv) < 5:
        print("Usage: python missing_fields_specific_doc.py <parent_collection> <parent_doc_id> <subcollection> <field_name>")
        print("Example: python missing_fields_specific_doc.py articles article123 comments author")
        sys.exit(1)
    
    parent_collection = sys.argv[1]
    parent_doc_id = sys.argv[2]
    subcollection = sys.argv[3]
    field_name = sys.argv[4]
    
    # Initialize Firebase
    db = setup_firebase()
    
    # Get and print document IDs without the specified field
    print(f"\nSearching for documents in '{parent_collection}/{parent_doc_id}/{subcollection}' without the field '{field_name}'...\n")
    missing_docs = get_documents_missing_field_in_specific_subcollection(db, parent_collection, parent_doc_id, subcollection, field_name)
    
    # Print a summary
    if missing_docs:
        print("\nSubdocuments missing the field:")
        for doc_id in missing_docs:
            print(f"- {doc_id}")
        print("\nTo update these documents, you can use their IDs in your code.")
    else:
        print(f"\nAll documents in '{parent_collection}/{parent_doc_id}/{subcollection}' have the field '{field_name}'")

if __name__ == "__main__":
    main()