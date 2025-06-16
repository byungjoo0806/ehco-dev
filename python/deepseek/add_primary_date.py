import asyncio
from datetime import datetime
from setup_firebase_deepseek import NewsManager

TARGET_FIGURE_ID = "iu(leejieun)"

def get_earliest_date(dates_array):
    """Finds the earliest date from an array of date strings."""
    if not dates_array:
        return None
    
    # The min() function works correctly on 'YYYY-MM-DD' formatted strings
    return min(dates_array)

def main():
    """
    Updates all documents in article-summaries with a new 'primary_event_date' field
    based on the 'event_dates' array.
    """
    print("Starting data update script...")
    news_manager = NewsManager()
    db = news_manager.db

    articles_ref = db.collection('selected-figures').document(TARGET_FIGURE_ID).collection('article-summaries')
    docs = articles_ref.stream()
    
    batch = db.batch()
    count = 0

    print("Reading documents and preparing updates...")
    for doc in docs:
        data = doc.to_dict()
        event_dates = data.get('event_dates')

        if event_dates and isinstance(event_dates, list):
            earliest_date_str = get_earliest_date(event_dates)
            
            if earliest_date_str:
                # Convert string to datetime object. Handle different formats.
                try:
                    if len(earliest_date_str) == 4: # YYYY
                        dt_object = datetime.strptime(earliest_date_str, '%Y')
                    elif len(earliest_date_str) == 7: # YYYY-MM
                        dt_object = datetime.strptime(earliest_date_str, '%Y-%m')
                    else: # YYYY-MM-DD
                        dt_object = datetime.strptime(earliest_date_str, '%Y-%m-%d')
                    
                    # Add the new field to the document update
                    batch.update(doc.reference, {'primary_event_date': dt_object})
                    count += 1
                except ValueError:
                    print(f"Warning: Could not parse date '{earliest_date_str}' in doc {doc.id}. Skipping.")

        # Commit the batch every 500 documents to avoid limits
        if count > 0 and count % 499 == 0:
            print(f"Committing batch of {count} updates...")
            batch.commit()
            batch = db.batch()

    # Commit any remaining updates
    if count > 0:
        print(f"Committing final batch of updates...")
        batch.commit()
        
    print(f"\nUpdate complete. Added 'primary_event_date' to {count} documents.")

if __name__ == "__main__":
    main()