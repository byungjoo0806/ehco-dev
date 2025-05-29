from setup_firebase_deepseek import NewsManager
import asyncio

async def update_existing_articles():
    """
    Update all existing articles in the database to add the processed_for_figures field.
    This is a one-time operation to initialize the field for all existing articles.
    """
    try:
        news_manager = NewsManager()
        
        print("Fetching all articles...")
        articles_ref = news_manager.db.collection("newsArticles").stream()
        
        # Keep track of processed count
        total_count = 0
        updated_count = 0
        already_processed_count = 0
        
        for doc in articles_ref:
            total_count += 1
            article_id = doc.id
            data = doc.to_dict()
            
            # Check if the article already has public_figures field
            has_public_figures = "public_figures" in data and isinstance(data["public_figures"], list)
            
            # Check if the article already has the processed flag
            already_processed = "processed_for_figures" in data
            
            if already_processed:
                already_processed_count += 1
                print(f"Article {article_id} already has processed_for_figures field, skipping...")
                continue
                
            # If the article has public_figures, mark it as already processed
            # If not, mark it as not processed so that our new processor will pick it up
            processed_status = has_public_figures
            
            # Update the article
            news_manager.db.collection("newsArticles").document(article_id).update({
                "processed_for_figures": processed_status
            })
            
            updated_count += 1
            print(f"Updated article {article_id} with processed_for_figures = {processed_status}")
            
        print(f"\nSummary:")
        print(f"Total articles: {total_count}")
        print(f"Articles already having processed_for_figures field: {already_processed_count}")
        print(f"Articles updated: {updated_count}")
        print(f"Articles marked as processed: {updated_count - (total_count - already_processed_count)}")
        print(f"Articles marked for future processing: {total_count - already_processed_count}")
        
    except Exception as e:
        print(f"Error updating existing articles: {e}")
        raise
    finally:
        # Close the connection
        await news_manager.close()


# Run the script when executed directly
if __name__ == "__main__":
    print("\n=== Updating Existing Articles ===\n")
    asyncio.run(update_existing_articles())
    print("\n=== Update Complete ===\n")