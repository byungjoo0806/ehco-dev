# run_backfill.py (Corrected Logic)

import argparse
import asyncio
from firebase_admin import firestore
from setup_firebase_deepseek import NewsManager # Imports your existing setup class

def _execute_query_batch(db, query, flag_to_set, dry_run):
    """
    Helper function to execute a query and update documents in batches.
    This contains the core logic for finding and updating documents.
    """
    print("-" * 60)
    if dry_run:
        print(f"DRY RUN: Finding articles to mark with 'public_figures_processed: {flag_to_set}'...")
    else:
        print(f"LIVE RUN: Finding and updating articles to 'public_figures_processed: {flag_to_set}'...")

    docs_stream = query.stream()
    batch = db.batch()
    update_count = 0

    for doc in docs_stream:
        update_count += 1
        print(f"  - Target document ID: {doc.id}")

        if not dry_run:
            doc_ref = db.collection("newsArticles").document(doc.id)
            batch.update(doc_ref, {"public_figures_processed": flag_to_set})

            # Firestore batches have a 500 operation limit. Commit every 400.
            if update_count > 0 and update_count % 400 == 0:
                print(f"  ...committing batch of 400 updates...")
                batch.commit()
                batch = db.batch() # Start a new batch

    if not dry_run and update_count > 0 and (update_count % 400 != 0):
        print(f"  ...committing final batch of {update_count % 400} updates...")
        batch.commit()

    print(f"✓ Found {update_count} articles for this part of the query.")
    print("-" * 60)
    return update_count

async def run_backfill_task(cutoff_id, dry_run):
    """
    Main task runner that uses the NewsManager to connect and then performs
    the backfill logic based on the cutoff ID.
    """
    manager = None
    try:
        # 1. Initialize connections using your existing NewsManager class
        manager = NewsManager()
        db = manager.db # Get the connected Firestore client from the manager

        if dry_run:
            print("\n=== STARTING BACKFILL IN DRY RUN MODE (REVERSED LOGIC) ===")
            print("No changes will be written to the database.")
        else:
            print("\n=== STARTING BACKFILL IN LIVE MODE (REVERSED LOGIC) ===")
            print("!!! THIS WILL WRITE CHANGES TO THE DATABASE !!!")

        collection_ref = db.collection("newsArticles")

        # 2. Query 1: Mark as PROCESSED (True) - CORRECTED LOGIC
        # Finds the cutoff document and all documents OLDER than it.
        processed_query = collection_ref.where(filter=firestore.FieldFilter("contentID", "<=", cutoff_id))
        processed_count = _execute_query_batch(db, processed_query, True, dry_run)

        # 3. Query 2: Mark as UNPROCESSED (False) - CORRECTED LOGIC
        # Finds all documents NEWER than the cutoff document.
        unprocessed_query = collection_ref.where(filter=firestore.FieldFilter("contentID", ">", cutoff_id))
        unprocessed_count = _execute_query_batch(db, unprocessed_query, False, dry_run)

        # 4. Final Summary
        print("\n=== BACKFILL SUMMARY ===")
        print(f"Mode: {'DRY RUN' if dry_run else 'LIVE RUN'}")
        print(f"Cutoff Document ID (Newest Processed): {cutoff_id}")
        print(f"Documents to be marked as PROCESSED (True): {processed_count}")
        print(f"Documents to be marked as UNPROCESSED (False): {unprocessed_count}")
        print("========================\n")

    except Exception as e:
        print(f"\n❌ An error occurred during the backfill task: {e}")
    finally:
        # 5. Cleanly close connections
        if manager:
            await manager.close()
            print("Manager resources closed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Uses NewsManager to backfill 'public_figures_processed' flag in Firestore.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "cutoff_id",
        help="The document ID of the NEWEST article that has already been processed."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run the script without writing any data to Firestore. Use this first to verify."
    )
    args = parser.parse_args()

    # Run the main asynchronous task
    asyncio.run(run_backfill_task(args.cutoff_id, args.dry_run))