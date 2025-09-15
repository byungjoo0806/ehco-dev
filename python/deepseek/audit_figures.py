import asyncio
import pytz
from datetime import datetime

# This script still needs the class from your original file to reuse its logic.
from predefined_public_figure_extractor import PredefinedPublicFigureExtractor

# --- MODIFICATION ---
# Instead of initializing Firebase here, we import the 'db' instance
# from your setup file. This assumes the variable is named 'db'.
try:
    from setup_firebase_deepseek import news_manager
    # Now, create a 'db' variable by accessing the .db attribute from the manager.
    db = news_manager.db
    print("Successfully imported Firestore 'db' instance from the shared NewsManager.")
except ImportError:
    print("--- ERROR: Could not import 'news_manager' from setup_firebase_deepseek.py ---")
    print("Please ensure the file exists and contains an instance named 'news_manager'.")
    db = None


def normalize_name_for_doc_id(name):
    """Creates a Firestore document ID from a name, matching your existing logic."""
    return name.lower().replace(" ", "").replace("-", "").replace(".", "")


async def audit_and_create_missing_figures():
    """
    Audits the 'selected-figures' collection against the master CSV file
    and creates profiles for any missing public figures.
    """
    # --- MODIFICATION ---
    # We now assume 'db' is successfully imported from your setup file.
    if not db:
        print(
            "Exiting script because the Firestore database instance is not available."
        )
        return

    print("\nStarting audit of 'selected-figures' against the master CSV...")

    # Step 1: Load all public figures from the CSV.
    try:
        # Note: Your PredefinedPublicFigureExtractor itself likely initializes the DeepSeek client
        # via its parent classes, so everything should work seamlessly.
        extractor = PredefinedPublicFigureExtractor(
            csv_filepath="k_celebrities_master.csv"
        )
        all_csv_names = extractor.predefined_names
        if not all_csv_names:
            print(
                "Could not load any names from the CSV file. Please check the file path and format."
            )
            return
    except Exception as e:
        print(f"Failed to initialize PredefinedPublicFigureExtractor: {e}")
        return

    # Step 2: Get all existing document IDs from the 'selected-figures' collection.
    print(
        f"Fetching existing figure IDs from Firestore collection 'selected-figures'..."
    )
    try:
        figures_ref = db.collection("selected-figures")
        existing_doc_ids = {doc.id for doc in figures_ref.select([]).stream()}
        print(f"Found {len(existing_doc_ids)} existing figure profiles in Firestore.")
    except Exception as e:
        print(f"Error fetching from Firestore: {e}")
        return

    # Step 3: Compare the list from the CSV against existing Firestore documents.
    missing_figures = []
    for name in all_csv_names:
        expected_doc_id = normalize_name_for_doc_id(name)
        if expected_doc_id not in existing_doc_ids:
            missing_figures.append(name)

    if not missing_figures:
        print(
            "\n✅ Audit complete. No missing public figures found. Your database is up to date!"
        )
        await extractor.news_manager.close()
        return

    print(
        f"\nAudit found {len(missing_figures)} missing public figure(s). Starting creation process..."
    )
    print(f"Missing figures: {', '.join(missing_figures)}")

    # Step 4: For each missing figure, perform research and create their profile.
    for i, figure_name in enumerate(missing_figures):
        print(
            f"\n--- Processing missing figure {i+1}/{len(missing_figures)}: {figure_name} ---"
        )
        try:
            print(f"Researching details for '{figure_name}'...")
            public_figure_info = await extractor.research_public_figure(figure_name)

            new_figure_data = {
                "name": figure_name,
                "sources": [],
                "lastUpdated": datetime.now(pytz.timezone("Asia/Seoul")).strftime(
                    "%Y-%m-%d"
                ),
                **public_figure_info,
            }

            doc_id = normalize_name_for_doc_id(figure_name)
            doc_ref = db.collection("selected-figures").document(doc_id)
            doc_ref.set(new_figure_data)
            print(
                f"✅ Successfully created new profile for '{figure_name}' with doc ID '{doc_id}'."
            )

        except Exception as e:
            print(f"‼️ Failed to process and create profile for '{figure_name}': {e}")

    await extractor.news_manager.close()
    print("\n=== Audit and creation process complete. ===")


if __name__ == "__main__":
    asyncio.run(audit_and_create_missing_figures())
