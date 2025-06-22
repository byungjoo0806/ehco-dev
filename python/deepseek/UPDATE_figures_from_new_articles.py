# UPDATE_figures_from_new_articles.py (Fixed)

import asyncio
import argparse
from firebase_admin import firestore
from datetime import datetime
import pytz

# Import the class from your existing, now-revised, script.
from predefined_public_figure_extractor import PredefinedPublicFigureExtractor

async def process_new_articles(extractor, limit=None):
    """
    Finds and processes only new articles, identified by the absence of
    the 'public_figures' field.
    """
    try:
        print("Searching for new articles to process (where 'public_figures' field is missing)...")
        
        # This query correctly finds documents where the field is missing.
        query = extractor.news_manager.db.collection("newsArticles").where(
            filter=firestore.FieldFilter("public_figures_processed", "==", False)
        )
        
        # Sort by document ID (contentId) to process newest articles first.
        query = query.order_by("contentID", direction=firestore.Query.DESCENDING)

        if limit:
            query = query.limit(limit)

        articles_ref = query.stream()
        articles = [{"id": doc.id, "data": doc.to_dict()} for doc in articles_ref]
        count = len(articles)

        if count == 0:
            print("No new articles found to process.")
            return

        print(f"Found {count} new articles to process.")
        
        stats = {
            "articles_processed": 0,
            "articles_with_figures": 0,
            "figure_mentions": 0,
            "summaries_created": 0
        }

        for i, article in enumerate(articles):
            article_id = article["id"]
            article_data = article.get("data", {})
            body = article_data.get("body", "")

            print(f"\nProcessing new article {i+1}/{count} (ID: {article_id})")
            stats["articles_processed"] += 1

            if not body:
                print(f"Skipping article {article_id} due to empty body.")
                # Mark as processed even if skipped, to avoid re-processing a bad article
                extractor.news_manager.db.collection("newsArticles").document(article_id).update({
                    "public_figures": [] 
                })
                continue

            # Find which predefined public figures are mentioned.
            mentioned_figures = await extractor._find_mentioned_figures(body)

            # ALWAYS mark the article as processed by setting the 'public_figures' field.
            # This prevents it from being picked up again in future runs.
            extractor.news_manager.db.collection("newsArticles").document(article_id).update({
                "public_figures": mentioned_figures,
                "public_figures_processed": True
            })
            
            if not mentioned_figures:
                print(f"No predefined figures found in article {article_id}. Marked as processed.")
                continue

            print(f"Found {len(mentioned_figures)} figures in article {article_id}: {', '.join(mentioned_figures)}")
            stats["articles_with_figures"] += 1
            stats["figure_mentions"] += len(mentioned_figures)
            
            # CORRECTED LOGIC: Loop through found figures and call the reusable helper method.
            for public_figure_name in mentioned_figures:
                # This call now contains all the complex logic, inherited from the main class.
                await extractor.process_single_figure_mention(public_figure_name, article_id, article_data)
                stats["summaries_created"] += 1


        print("\n=== New Article Processing Statistics ===")
        print(f"New articles processed: {stats['articles_processed']}")
        print(f"Articles with figures: {stats['articles_with_figures']}")
        print(f"Total figure mentions: {stats['figure_mentions']}")
        print(f"Article summaries created: {stats['summaries_created']}")
        print("=======================================\n")

    except Exception as e:
        print(f"An error occurred during new article processing: {e}")
    finally:
        await extractor.news_manager.close()


async def main():
    parser = argparse.ArgumentParser(description='Process NEW articles for public figure mentions.')
    parser.add_argument('--limit', type=int, help='Limit the number of new articles to process.')
    parser.add_argument('--csv-file', type=str, default="k_celebrities_master.csv", help='Path to CSV file with public figure data.')
    args = parser.parse_args()

    # Create the extractor instance exactly as before
    extractor = PredefinedPublicFigureExtractor(csv_filepath=args.csv_file)
    
    print("\n=== Starting New Article Update Process ===")
    await process_new_articles(extractor, limit=args.limit)
    print("=== New Article Update Process Complete ===\n")


if __name__ == "__main__":
    asyncio.run(main())