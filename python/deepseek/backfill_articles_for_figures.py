import asyncio
import argparse

# We will reuse your existing extractor and its powerful methods
from predefined_public_figure_extractor import PredefinedPublicFigureExtractor
from setup_firebase_deepseek import news_manager


async def backfill_articles_for_figures(target_figure_names, article_id=None):
    """
    Scans articles to find mentions of specific public figures and generates summaries.
    If article_id is provided, it only scans that single article.

    Args:
        target_figure_names (list): A list of public figure names to process.
        article_id (str, optional): The ID of a single article to process. Defaults to None.
    """
    if not target_figure_names:
        print("No target figure names provided. Exiting.")
        return

    print(f"Starting backfill process for {len(target_figure_names)} figure(s):")
    print(f" -> {', '.join(target_figure_names)}")

    try:
        extractor = PredefinedPublicFigureExtractor()
        db = news_manager.db

        # --- MODIFICATION: Conditionally fetch articles ---
        articles = []
        if article_id:
            print(f"\nTargeting single article with ID: {article_id}")
            doc_ref = db.collection("newsArticles").document(article_id).get()
            if doc_ref.exists:
                articles.append({"id": doc_ref.id, "data": doc_ref.to_dict()})
                print("Successfully fetched the article.")
            else:
                print(f"--- WARNING: Article with ID '{article_id}' not found. ---")
        else:
            print("\nFetching all articles from 'newsArticles' collection...")
            articles_ref = db.collection("newsArticles").stream()
            articles = [{"id": doc.id, "data": doc.to_dict()} for doc in articles_ref]

        if not articles:
            print("No articles found to process.")
            return

        print(f"Found {len(articles)} article(s) to scan.")

        # The rest of the logic remains the same
        total_summaries_created = 0
        for i, article in enumerate(articles):
            article_id = article["id"]
            article_data = article.get("data", {})
            body = article_data.get("body", "")

            if not body:
                continue

            print(
                f"\n--- Scanning article {i+1}/{len(articles)} (ID: {article_id}) ---"
            )

            extractor.predefined_names = target_figure_names
            mentioned_figures = await extractor._find_mentioned_figures(body)

            if not mentioned_figures:
                print(f"No target figures found in this article.")
                continue

            print(f"Found mentions of: {', '.join(mentioned_figures)}")
            for figure_name in mentioned_figures:
                await extractor.process_single_figure_mention(
                    public_figure_name=figure_name,
                    article_id=article_id,
                    article_data=article_data,
                )
                total_summaries_created += 1

        print(
            f"\n✅ Backfill complete. Created {total_summaries_created} new article summaries."
        )

    except Exception as e:
        print(f"An error occurred during the backfill process: {e}")
    finally:
        if "extractor" in locals() and hasattr(extractor, "news_manager"):
            await extractor.news_manager.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backfill article summaries for specific public figures."
    )
    parser.add_argument(
        "names", nargs="+", help="The exact names of the public figures to process."
    )
    # --- MODIFICATION: Add optional argument for article_id ---
    parser.add_argument(
        "--article-id",
        type=str,
        default=None,
        help="The specific ID of a single article to process.",
    )
    args = parser.parse_args()

    # --- MODIFICATION: Pass the new argument to the function ---
    asyncio.run(backfill_articles_for_figures(args.names, args.article_id))
