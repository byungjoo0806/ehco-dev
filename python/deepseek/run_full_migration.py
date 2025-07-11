import asyncio
import argparse
import sys
from google.cloud.firestore_v1.base_query import FieldFilter

# Import classes from your individual scripts
from backfill_processed_article_marker import BackfillProcessor
from find_company_urls import CompanyUrlFinder
from migration import CurationEngine
from compact_overview import CompactOverview
from compact_event_summaries_descriptions import DataUpdater
from setup_firebase_deepseek import NewsManager

# Define the curated timeline collection name globally for consistency
CURATED_TIMELINE_COLLECTION = "curated-timeline"

async def process_single_figure_workflow(figure_id: str):
    """
    Encapsulates the entire migration process for a single figure.
    This function assumes the 'curated-timeline' existence check has already passed.
    """
    print(f"\n\n--- Starting Full Migration Process for Figure: {figure_id} ---")

    try:
        # Phase 1: Pre-Migration Steps
        print(f"\n=== Phase 1: Pre-Migration (Backfill Markers & Find Company URLs) for {figure_id} ===")

        print(f"\n--- Running BackfillProcessedArticleMarker for {figure_id} ---")
        backfill_processor = BackfillProcessor(figure_id=figure_id)
        backfill_processor.run_backfill()

        await asyncio.sleep(2) # Small delay

        print(f"\n--- Running CompanyUrlFinder for {figure_id} ---")
        company_url_finder = CompanyUrlFinder()
        await company_url_finder.find_and_update_urls(figure_id_to_test=figure_id)
        await company_url_finder.manager.close()

        # Phase 2: Main Migration Step
        # This phase is now only reached if curated-timeline does NOT exist
        print(f"\n\n=== Phase 2: Main Migration (Curate Timeline) for {figure_id} ===")
        print(f"\n--- Running CurationEngine (Initial Migration) for {figure_id} ---")
        curation_engine = CurationEngine(figure_id=figure_id)
        await curation_engine.run_initial_migration()
        await curation_engine.news_manager.close()

        await asyncio.sleep(5) # Larger delay after major AI processing

        # Phase 3: Post-Migration Steps
        print(f"\n\n=== Phase 3: Post-Migration (Compact Overview & Event Summaries) for {figure_id} ===")

        print(f"\n--- Running CompactOverview for {figure_id} ---")
        compact_overview_runner = CompactOverview()
        await compact_overview_runner.compact_figure_overview(figure_id=figure_id)
        await compact_overview_runner.manager.close()

        await asyncio.sleep(2)

        print(f"\n--- Running CompactEventSummariesDescriptions for {figure_id} ---")
        data_updater = DataUpdater(figure_id=figure_id)
        await data_updater.run_update()
        await data_updater.news_manager.close()

        print(f"\n✅ Full Migration Process Completed Successfully for Figure: {figure_id} ✅")

    except Exception as e:
        print(f"\n❌ An error occurred during the overall migration process for {figure_id}: {e}")
        # Log the error, but continue to the next figure if processing all.

async def main():
    parser = argparse.ArgumentParser(
        description="Runs the full migration process for a specific figure or all figures."
    )
    parser.add_argument(
        "--figure_id",
        type=str,
        help="Optional: The ID of a single figure to process (e.g., 'newjeans'). If not provided, all figures will be processed."
    )
    args = parser.parse_args()

    manager = NewsManager() # Initialize NewsManager once for fetching figure IDs and subcollection checks
    db = manager.db

    try:
        if args.figure_id:
            # Specific figure processing logic
            figure_id_to_process = args.figure_id
            print(f"Running full migration for specified figure: {figure_id_to_process}")
            
            figure_doc_ref = db.collection('selected-figures').document(figure_id_to_process)
            
            # Check for existing curated-timeline subcollection early
            try:
                first_doc_in_timeline = next(figure_doc_ref.collection(CURATED_TIMELINE_COLLECTION).stream(), None)
                if first_doc_in_timeline:
                    print(f"\n--- SKIPPING Full Migration for {figure_id_to_process}: 'curated-timeline' subcollection already exists and contains data. ---")
                    print("This figure is assumed to be already migrated and will be skipped entirely.")
                else:
                    await process_single_figure_workflow(figure_id_to_process)
            except Exception as e:
                print(f"Error checking for 'curated-timeline' or processing figure {figure_id_to_process}: {e}")

        else:
            # All figures processing logic
            print("--- Starting Full Migration Process for ALL Figures in 'selected-figures' collection ---")
            
            figure_ids = []
            try:
                print("Fetching all figure IDs from 'selected-figures' collection...")
                figures_ref = db.collection('selected-figures')
                docs = figures_ref.stream()
                for doc in docs:
                    figure_ids.append(doc.id)
                print(f"Found {len(figure_ids)} figures to process.")
            except Exception as e:
                print(f"Error fetching figure IDs: {e}")
                sys.exit(1) # Exit if we can't even get the list of figures

            if not figure_ids:
                print("No figures found to process. Exiting.")
                return

            for figure_id in figure_ids:
                figure_doc_ref = db.collection('selected-figures').document(figure_id)
                
                # Check for existing curated-timeline subcollection early for each figure
                try:
                    first_doc_in_timeline = next(figure_doc_ref.collection(CURATED_TIMELINE_COLLECTION).stream(), None)
                    if first_doc_in_timeline:
                        print(f"\n--- SKIPPING Full Migration for {figure_id}: 'curated-timeline' subcollection already exists and contains data. ---")
                        print("This figure is assumed to be already migrated and will be skipped entirely.")
                        continue # Skip to the next figure
                    else:
                        # Only run workflow if curated-timeline does not exist
                        await process_single_figure_workflow(figure_id)
                        await asyncio.sleep(10) # Adjust this delay as needed, especially for many figures/heavy AI usage
                except Exception as e:
                    print(f"Error checking for 'curated-timeline' or processing figure {figure_id}: {e}")
                    # Continue to the next figure even if one fails
            
            print("\n\n--- ALL FIGURE MIGRATIONS COMPLETED (Check logs above for individual figure status) ---")

    except Exception as e:
        print(f"\n❌ An unexpected error occurred in main execution: {e}")
    finally:
        await manager.close() # Ensure manager connection is closed at the end of main

if __name__ == "__main__":
    asyncio.run(main())