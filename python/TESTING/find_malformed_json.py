import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
import sys
import json


def setup_firebase():
    """Initialize Firebase with environment variables and proper error handling"""
    # Load environment variables
    load_dotenv()

    try:
        # Get configuration from environment variables
        config_path = os.getenv("FIREBASE_CONFIG_PATH")
        database_url = os.getenv("FIREBASE_DEFAULT_DATABASE_URL")

        if not config_path:
            raise ValueError("FIREBASE_CONFIG_PATH not found in environment variables")
        if not database_url:
            raise ValueError("FIREBASE_DATABASE_URL not found in environment variables")
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Service account key not found at: {config_path}")

        try:
            # Try to initialize with specific database
            cred = credentials.Certificate(config_path)
            firebase_admin.initialize_app(cred, {"databaseURL": database_url})
            print("Firebase initialized successfully with specific database")
        except ValueError as e:
            if "The default Firebase app already exists" in str(e):
                print("Using existing Firebase app")
            else:
                raise e

        try:
            # Get client with specific database
            db = firestore.Client.from_service_account_json(config_path)
            print("Firestore client connected successfully to specified database")
            return db
        except Exception as e:
            print(f"Failed to get Firestore client: {e}")
            raise

    except Exception as e:
        print(f"Failed to initialize Firebase: {e}")
        raise


def looks_like_json_object(text):
    """
    Check if a string looks like it's trying to be a JSON object but might be malformed.

    Args:
        text: String to check

    Returns:
        True if the string appears to be a JSON object, False otherwise
    """
    if not isinstance(text, str):
        return False

    # Trim whitespace
    text = text.strip()

    # Check if it starts with { and contains at least one "key": pattern
    if text.startswith("{") and '"' in text and ":" in text:
        # It looks like it's trying to be JSON, now check if it's valid
        try:
            json.loads(text)
            # It's valid JSON, but we're looking for malformed JSON
            return False
        except json.JSONDecodeError:
            # It looks like JSON but isn't valid - this is what we're looking for
            return True

    return False


def find_json_like_strings(
    db, collection_name, field_name, parent_doc_id=None, subcollection=None
):
    """
    Retrieve and print document IDs where a specific field appears to contain
    JSON-like content but might be malformed.

    Args:
        db: Firestore database client
        collection_name: Name of the collection to query
        field_name: Name of the field that might contain JSON-like content
        parent_doc_id: (Optional) ID of a specific parent document
        subcollection: (Optional) Name of a subcollection to check

    Returns:
        A list of document IDs with JSON-like content in the specified field
    """
    try:
        # Determine the collection reference based on whether we're checking a subcollection
        if parent_doc_id and subcollection:
            # We're checking a specific parent document's subcollection
            collection_ref = (
                db.collection(collection_name)
                .document(parent_doc_id)
                .collection(subcollection)
            )
            location_str = f"'{collection_name}/{parent_doc_id}/{subcollection}'"
        elif subcollection:
            # Error: subcollection specified but no parent_doc_id
            raise ValueError(
                "If subcollection is specified, parent_doc_id must also be specified"
            )
        else:
            # We're checking a top-level collection
            collection_ref = db.collection(collection_name)
            location_str = f"'{collection_name}'"

        # Fetch all documents in the collection
        docs = collection_ref.stream()

        # Find documents with JSON-like content in the specified field
        json_like_docs = []

        for doc in docs:
            data = doc.to_dict()

            # Check if the field exists and looks like JSON
            if field_name in data and looks_like_json_object(data[field_name]):
                json_like_docs.append(doc.id)
                print(
                    f"Document ID: {doc.id} - Contains JSON-like content in field: {field_name}"
                )

                # Print a preview of the problematic field
                preview = (
                    str(data[field_name])[:150] + "..."
                    if len(str(data[field_name])) > 150
                    else str(data[field_name])
                )
                print(f"Preview: {preview}\n")

        print(
            f"\nFound {len(json_like_docs)} documents in {location_str} with JSON-like content in field '{field_name}'"
        )
        return json_like_docs

    except Exception as e:
        print(
            f"Error finding documents with JSON-like content in field '{field_name}': {e}"
        )
        raise


def main():
    # Check arguments based on whether we're checking a subcollection
    if len(sys.argv) < 3:
        print("Usage for top-level collection:")
        print("  python find_json_like_strings.py <collection_name> <field_name>")
        print("Usage for subcollection:")
        print(
            "  python find_json_like_strings.py <collection_name> <field_name> <parent_doc_id> <subcollection>"
        )
        print("Examples:")
        print("  python find_json_like_strings.py articles summary")
        print("  python find_json_like_strings.py articles summary article123 events")
        sys.exit(1)

    collection_name = sys.argv[1]
    field_name = sys.argv[2]

    # Check if we're searching in a subcollection
    parent_doc_id = None
    subcollection = None

    if len(sys.argv) >= 5:
        parent_doc_id = sys.argv[3]
        subcollection = sys.argv[4]

    # Initialize Firebase
    db = setup_firebase()

    # Find and print document IDs with JSON-like content
    if parent_doc_id and subcollection:
        print(
            f"\nSearching for documents in '{collection_name}/{parent_doc_id}/{subcollection}' with JSON-like content in field '{field_name}'...\n"
        )
    else:
        print(
            f"\nSearching for documents in '{collection_name}' with JSON-like content in field '{field_name}'...\n"
        )

    json_like_docs = find_json_like_strings(
        db, collection_name, field_name, parent_doc_id, subcollection
    )

    # Print a summary
    if json_like_docs:
        print("\nDocuments with JSON-like content:")
        for doc_id in json_like_docs:
            print(f"- {doc_id}")
        print("\nYou can use these IDs to fix the problematic content in your code.")
    else:
        if parent_doc_id and subcollection:
            print(
                f"\nNo documents in '{collection_name}/{parent_doc_id}/{subcollection}' have JSON-like content in field '{field_name}'"
            )
        else:
            print(
                f"\nNo documents in '{collection_name}' have JSON-like content in field '{field_name}'"
            )


if __name__ == "__main__":
    main()
