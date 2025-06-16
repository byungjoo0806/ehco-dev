# restructuring_curated_timeline.py

from setup_firebase_deepseek import NewsManager

def main():
    """Initializes the manager and runs the migration."""
    print("Initializing NewsManager to connect to Firebase...")
    manager = NewsManager()

    # --- CHOOSE WHICH MIGRATION TO RUN ---

    # === OPTION 1: TEST RUN (Highly Recommended First) ===
    # Provide the ID of a single public figure to test the script safely.
    test_figure_id = 'iu(leejieun)' # Replace with a real ID from your DB for testing
    print(f"Starting TEST migration for figure: {test_figure_id}")
    manager.migrate_timeline_data(figure_id_to_test=test_figure_id)


    # === OPTION 2: FULL RUN (Run this only after testing) ===
    # This will migrate all documents in your database.
    # print("Starting FULL migration for all figures. This may take a while...")
    # manager.migrate_timeline_data()


if __name__ == "__main__":
    main()