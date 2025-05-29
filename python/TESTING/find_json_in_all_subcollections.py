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


def find_json_like_strings_in_all_docs_subcollections(
    db, collection_name, subcollection_name, field_name
):
    """
    Iterate through all documents in a collection, check their subcollections,
    and find documents where a specific field appears to contain JSON-like content.

    Args:
        db: Firestore database client
        collection_name: Name of the top-level collection
        subcollection_name: Name of the subcollection to check in each document
        field_name: Name of the field that might contain JSON-like content

    Returns:
        A dictionary mapping parent document IDs to lists of subcollection document IDs with JSON-like content
    """
    try:
        # Get reference to the top-level collection
        collection_ref = db.collection(collection_name)

        # Fetch all documents in the top-level collection
        parent_docs = collection_ref.stream()

        # Dictionary to store results
        results = {}
        total_problematic_docs = 0
        total_parent_docs_checked = 0
        total_subcollection_docs_checked = 0

        # Iterate through each parent document
        for parent_doc in parent_docs:
            parent_id = parent_doc.id
            total_parent_docs_checked += 1

            # Print progress
            print(f"Checking parent document {parent_id}...")

            # Get reference to the subcollection
            subcollection_ref = collection_ref.document(parent_id).collection(
                subcollection_name
            )

            # Check if the subcollection exists by fetching a single document
            subcollection_docs = list(subcollection_ref.limit(1).stream())
            if not subcollection_docs:
                print(
                    f"  - No '{subcollection_name}' subcollection found for document {parent_id}"
                )
                continue

            # Fetch all documents in the subcollection
            subcollection_docs = subcollection_ref.stream()

            # Find documents with JSON-like content in the specified field
            problematic_docs = []

            for doc in subcollection_docs:
                total_subcollection_docs_checked += 1
                data = doc.to_dict()

                # Check if the field exists and looks like JSON
                if field_name in data and looks_like_json_object(data[field_name]):
                    problematic_docs.append(doc.id)
                    total_problematic_docs += 1
                    print(
                        f"  * Found problematic document: Parent ID: {parent_id} | Subdocument ID: {doc.id}"
                    )

                    # Print a preview of the problematic field
                    preview = (
                        str(data[field_name])[:150] + "..."
                        if len(str(data[field_name])) > 150
                        else str(data[field_name])
                    )
                    print(f"    Preview: {preview}\n")

            # Add to results if there are any problematic documents
            if problematic_docs:
                results[parent_id] = problematic_docs
                print(
                    f"  - Found {len(problematic_docs)} problematic documents in '{subcollection_name}' subcollection"
                )
            else:
                print(
                    f"  - No problematic documents found in '{subcollection_name}' subcollection"
                )

        print(f"\nSummary:")
        print(
            f"- Checked {total_parent_docs_checked} parent documents in '{collection_name}'"
        )
        print(
            f"- Examined {total_subcollection_docs_checked} subdocuments in '{subcollection_name}' subcollections"
        )
        print(
            f"- Found {total_problematic_docs} documents with JSON-like content in field '{field_name}'"
        )
        print(
            f"- These problematic documents are distributed across {len(results)} parent documents"
        )

        return results

    except Exception as e:
        print(f"Error finding documents with JSON-like content: {e}")
        raise


def main():
    # Check if correct number of arguments is provided
    if len(sys.argv) < 4:
        print(
            "Usage: python find_json_in_all_subcollections.py <collection_name> <subcollection_name> <field_name>"
        )
        print(
            "Example: python find_json_in_all_subcollections.py articles events summary"
        )
        sys.exit(1)

    collection_name = sys.argv[1]
    subcollection_name = sys.argv[2]
    field_name = sys.argv[3]

    # Initialize Firebase
    db = setup_firebase()

    # Get and print document IDs with JSON-like content
    print(
        f"\nSearching for JSON-like content in field '{field_name}' across all '{collection_name}/{subcollection_name}' documents...\n"
    )
    problematic_docs = find_json_like_strings_in_all_docs_subcollections(
        db, collection_name, subcollection_name, field_name
    )

    # Print a detailed summary of results
    if problematic_docs:
        print("\nDetailed results by parent document:")
        for parent_id, subdocs in problematic_docs.items():
            print(
                f"- Parent document '{parent_id}' has {len(subdocs)} problematic subdocuments:"
            )
            for subdoc_id in subdocs:
                print(f"  * {subdoc_id}")

        print(
            "\nTo fix these documents, you can use the parent document IDs and subdocument IDs in your code."
        )
    else:
        print(
            f"\nNo problematic documents found in any '{collection_name}/{subcollection_name}' subdocuments."
        )


if __name__ == "__main__":
    main()
