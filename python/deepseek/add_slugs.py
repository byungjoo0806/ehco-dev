import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
import unicodedata
import re


def initialize_firebase():
    """
    Initializes the Firebase Admin SDK using environment variables.
    Checks if an app is already initialized to prevent errors.
    Returns a Firestore client instance.
    """
    load_dotenv()
    try:
        config_path = os.getenv("FIREBASE_CONFIG_PATH")
        database_url = os.getenv("FIREBASE_DEFAULT_DATABASE_URL")

        if not config_path:
            raise ValueError("FIREBASE_CONFIG_PATH not found in environment variables.")
        if not database_url:
            raise ValueError(
                "FIREBASE_DATABASE_URL not found in environment variables."
            )
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Service account key not found at: {config_path}")

        # Check if the default app is already initialized
        if not firebase_admin._apps:
            cred = credentials.Certificate(config_path)
            firebase_admin.initialize_app(cred, {"databaseURL": database_url})
            print("✓ Firebase initialized successfully.")
        else:
            print("✓ Using existing Firebase app.")

        db = firestore.client()
        print("✓ Firestore client connected successfully.")
        return db

    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        return None


def create_slug(text: str) -> str:
    """
    Creates a URL-friendly slug from a string, matching the JavaScript logic.
    """
    if not text:
        return ""

    # 1. Convert to lowercase
    text = text.lower()

    # 2. Normalize to separate base characters from accents (e.g., 'é' -> 'e' + '´')
    normalized_text = unicodedata.normalize("NFD", text)

    # 3. Remove the accent marks (diacritics)
    without_accents = "".join(
        c for c in normalized_text if unicodedata.category(c) != "Mn"
    )

    # 4. Remove any remaining non-alphanumeric characters
    slug = re.sub(r"[^a-z0-9]", "", without_accents)

    return slug


def run_migration(db, figure_id_to_test: str = None):
    """
    Adds a 'slug' field to documents in the 'selected-figures' collection.

    Args:
        db: The Firestore client instance.
        figure_id_to_test (str, optional): If provided, runs the script
            only on the document with this ID for testing purposes.
    """
    print("\nStarting slug migration script...")
    figures_ref = db.collection("selected-figures")
    updated_count = 0

    try:
        if figure_id_to_test:
            print(f"--- RUNNING IN TEST MODE FOR FIGURE: {figure_id_to_test} ---")
            doc_ref = figures_ref.document(figure_id_to_test)
            doc = doc_ref.get()
            if not doc.exists:
                print(f"Error: Test figure with ID '{figure_id_to_test}' not found.")
                return
            docs_to_process = [doc]
        else:
            print("--- RUNNING IN FULL MIGRATION MODE ---")
            print("Fetching all documents from 'selected-figures'...")
            docs_to_process = figures_ref.stream()

        for doc in docs_to_process:
            data = doc.to_dict()
            figure_name = data.get("name")

            if not figure_name:
                print(f"⚠️  Skipping document {doc.id}: 'name' field is missing.")
                continue

            slug = create_slug(figure_name)

            if slug:
                print(
                    f"  -> Processing '{figure_name}' ({doc.id})  ==>  slug: '{slug}'"
                )
                doc.reference.update({"slug": slug})
                updated_count += 1
            else:
                print(
                    f"⚠️  Skipping document {doc.id}: Could not generate slug for name '{figure_name}'."
                )

        print(
            f"\n✅ Migration completed successfully! Updated {updated_count} documents."
        )

    except Exception as e:
        print(f"\n❌ An error occurred during migration: {e}")
        raise


# --- SCRIPT EXECUTION ---
if __name__ == "__main__":
    db_client = initialize_firebase()

    if db_client:
        # --- STEP 1: TEST ON A SINGLE DOCUMENT FIRST (Highly Recommended) ---
        # Find a document ID with special characters (e.g., "rosé") to test.
        #
        # UNCOMMENT THE LINE BELOW TO RUN IN TEST MODE:
        # run_migration(db_client, figure_id_to_test="rosé")

        # --- STEP 2: RUN THE FULL MIGRATION ---
        # After confirming the test works, comment out the test line above
        # and uncomment the line below to run on all documents.
        #
        # UNCOMMENT THE LINE BELOW TO RUN IN FULL MODE:
        run_migration(db_client)
