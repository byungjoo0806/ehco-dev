import re
import json
from datetime import datetime, timedelta
import pytz
import asyncio
import sys
import os
import argparse

# Import your NewsManager class from the setup file
from setup_firebase_deepseek import NewsManager

async def validate_figure_dates(limit=None, start_from=None, single_figure=None, dry_run=False, batch_size=10, timeout=300):
    """
    Validate dates in event_contents for public figures and regenerate only if dates are incorrect.
    
    Args:
        limit (int, optional): Limit the number of figures to process
        start_from (str, optional): Start processing from this figure ID
        single_figure (str, optional): Process only this specific figure ID
        dry_run (bool): If True, preview changes without updating the database
        batch_size (int): Number of figures to process in each batch
        timeout (int): Timeout in seconds for Firebase operations
    """
    # Initialize the NewsManager to get Firebase connection and DeepSeek client
    news_manager = NewsManager()
    db = news_manager.db
    
    try:
        # If processing just a single figure
        if single_figure:
            try:
                figure_ref = db.collection("selected-figures").document(single_figure)
                figure_doc = figure_ref.get(timeout=timeout)
                
                if not figure_doc.exists:
                    print(f"Error: Figure with ID '{single_figure}' not found!")
                    return
                    
                # Process just this one figure
                figure_data = figure_doc.to_dict()
                figure_name = figure_data.get("name", single_figure)
                print(f"\n=== Processing single figure: {figure_name} ({single_figure}) ===\n")
                
                # Process all summaries for this figure
                await process_figure_dates(news_manager, db, single_figure, figure_name, dry_run, timeout)
                
                print(f"\n=== Completed processing for figure: {figure_name} ===\n")
                return
            except Exception as e:
                print(f"Error processing single figure {single_figure}: {e}")
                return
        
        # Process multiple figures in batches
        total_figures = 0
        total_processed = 0
        total_corrected = 0
        
        # Determine the total limit to process
        process_limit = limit
        
        last_doc = None
        if start_from:
            try:
                start_doc_ref = db.collection("selected-figures").document(start_from)
                start_doc = start_doc_ref.get(timeout=timeout)
                if start_doc.exists:
                    last_doc = start_doc
                    print(f"Starting processing after figure: {start_from}")
                else:
                    print(f"Warning: Start figure {start_from} does not exist. Starting from the beginning.")
            except Exception as e:
                print(f"Error retrieving start figure: {e}")
                print("Starting from the beginning instead.")
        
        # Process in batches to avoid timeout issues
        continue_processing = True
        while continue_processing:
            try:
                # Create a new query for each batch
                query = db.collection("selected-figures")
                
                # Apply starting point if we have a last document
                if last_doc:
                    query = query.start_after(last_doc)
                
                # Apply a batch size limit
                current_batch_size = min(batch_size, process_limit) if process_limit else batch_size
                query = query.limit(current_batch_size)
                
                # Execute the query with timeout
                figures = list(query.stream(timeout=timeout))
                
                # If no more results or reached limit, stop processing
                if not figures or (process_limit is not None and total_figures >= process_limit):
                    continue_processing = False
                    continue
                
                # Process each figure in the batch
                for figure in figures:
                    total_figures += 1
                    figure_id = figure.id
                    figure_data = figure.to_dict()
                    figure_name = figure_data.get("name", figure_id)
                    
                    print(f"\n--- Processing figure {total_figures}: {figure_name} ({figure_id}) ---")
                    
                    try:
                        # Process this figure's summaries and get stats
                        figure_stats = await process_figure_dates(news_manager, db, figure_id, figure_name, dry_run, timeout)
                        
                        total_processed += figure_stats['processed']
                        total_corrected += figure_stats['corrected']
                    except Exception as e:
                        print(f"Error processing figure {figure_name}: {e}")
                        print("Continuing with next figure...")
                    
                    # Update last_doc to continue from after this document next time
                    last_doc = figure
                    
                    # If we've reached the limit, stop processing
                    if process_limit is not None and total_figures >= process_limit:
                        continue_processing = False
                        break
                
                # If we've processed fewer than batch_size, we've reached the end
                if len(figures) < current_batch_size:
                    continue_processing = False
            
            except Exception as e:
                print(f"Error during batch processing: {e}")
                print("Waiting 5 seconds before trying the next batch...")
                await asyncio.sleep(5)  # Add a delay before retrying
        
        if dry_run:
            print("\n=== DRY RUN SUMMARY ===")
            print("No changes were made to the database. This was a preview only.")
            print(f"Total figures processed: {total_figures}")
            print(f"Total documents with date corrections: {total_corrected}")
            print("Run without --dry-run to apply these changes.")
        else:
            print(f"\n=== FINAL STATISTICS ===")
            print(f"Total figures processed: {total_figures}")
            print(f"Total summaries processed: {total_processed}")
            print(f"Total documents with date corrections: {total_corrected}")
    
    finally:
        # Close connections
        await news_manager.close()
        
async def process_figure_dates(news_manager, db, figure_id, figure_name, dry_run=False, timeout=300):
    """
    Process all summaries for a specific figure, validating dates and regenerating descriptions only if dates are incorrect.
    
    Args:
        news_manager: NewsManager instance with DeepSeek client
        db: Firestore database instance
        figure_id (str): Figure document ID
        figure_name (str): Figure name for display
        dry_run (bool): If True, preview changes without updating the database
        timeout (int): Timeout in seconds for Firebase operations
        
    Returns:
        dict: Statistics about processed summaries
    """
    figure_summaries = 0
    figure_corrected = 0
    
    try:
        # Get the summaries in smaller batches to avoid timeout
        batch_size = 20
        last_doc = None
        has_more = True
        
        while has_more:
            try:
                # Create a query for this batch
                query = db.collection("selected-figures").document(figure_id).collection("article-summaries")
                
                if last_doc:
                    query = query.start_after(last_doc)
                    
                query = query.limit(batch_size)
                
                # Get the batch with timeout
                summaries = list(query.stream(timeout=timeout))
                
                # If no results, we're done
                if not summaries:
                    has_more = False
                    continue
                
                # Process each summary in this batch
                for summary in summaries:
                    figure_summaries += 1
                    summary_data = summary.to_dict()
                    
                    # Get necessary fields for validation
                    doc_id = summary.id
                    article_body = summary_data.get("body", "")
                    title = summary_data.get("title", "")
                    subtitle = summary_data.get("subtitle", "")
                    
                    # Update last_doc for next batch
                    last_doc = summary
                    
                    # Check if we have event_contents to validate
                    event_contents = summary_data.get("event_contents", {})
                    if not event_contents:
                        print(f"Skipping summary {doc_id} - No event_contents available")
                        continue
                    
                    # Extract article date from the document ID (e.g., "AEN20171030014300315")
                    article_date = None
                    date_str = ""
                    
                    # Extract YYYYMMDD from document ID
                    date_match = re.search(r'AEN(\d{8})', doc_id)
                    if date_match:
                        date_str = date_match.group(1)
                        try:
                            article_date = datetime.strptime(date_str, "%Y%m%d")
                            formatted_date = article_date.strftime('%Y-%m-%d')
                            print(f"Extracted article date: {formatted_date} from ID: {doc_id}")
                        except ValueError:
                            print(f"Could not parse date from ID: {doc_id}")
                    
                    if not article_date:
                        print(f"No valid date found in document ID {doc_id}, skipping")
                        continue
                    
                    # Format date as YYYY-MM-DD for validation
                    formatted_date = article_date.strftime('%Y-%m-%d')
                    
                    # Validate date formats in event_contents
                    valid_dates = True
                    invalid_dates = []
                    
                    for event_date in event_contents.keys():
                        if not is_valid_date_format(event_date):
                            valid_dates = False
                            invalid_dates.append(event_date)
                            
                    if valid_dates:
                        print(f"All dates in {doc_id} for {figure_name} are valid, skipping")
                        continue
                        
                    print(f"Found {len(invalid_dates)} invalid dates in {doc_id} for {figure_name}")
                    
                    # Only regenerate if we have invalid dates
                    try:
                        # We need to regenerate the events with correct dates
                        new_data = await regenerate_events(
                            news_manager, 
                            figure_name, 
                            title or subtitle or "Untitled", 
                            article_body, 
                            formatted_date,
                            event_contents,
                            invalid_dates
                        )
                        
                        if not new_data:
                            print(f"Failed to regenerate events for {doc_id}, skipping")
                            continue
                            
                        # Keep the existing summary, only update event data
                        new_events = new_data.get("events", [])
                        
                        # Convert events list to event_contents map and event_dates list
                        new_event_contents = {}
                        new_event_dates = []
                        
                        for event in new_events:
                            event_date = event.get("date", "")
                            event_content = event.get("event", "")
                            
                            # Validate date format
                            if not is_valid_date_format(event_date):
                                print(f"Warning: Generated date '{event_date}' is still invalid, skipping this event")
                                continue
                                
                            new_event_contents[event_date] = event_content
                            new_event_dates.append(event_date)
                        
                        # Check if we successfully corrected the dates
                        if len(new_event_contents) > 0:
                            figure_corrected += 1
                            
                            # Create update data
                            update_data = {
                                "event_contents": new_event_contents,
                                "event_dates": new_event_dates,
                                "date_corrected_at": datetime.now(pytz.timezone('Asia/Seoul')).strftime("%Y-%m-%d")
                            }
                            
                            # Preview or apply changes
                            if dry_run:
                                print(f"[DRY RUN] Would update events in {doc_id} for {figure_name}")
                                print(f"[DRY RUN] Invalid dates: {invalid_dates}")
                                print(f"[DRY RUN] New events: {len(new_events)} events extracted")
                                for event_date, event_content in new_event_contents.items():
                                    print(f"[DRY RUN]   - {event_date}: {event_content[:100]}{'...' if len(event_content) > 100 else ''}")
                            else:
                                try:
                                    summary_ref = db.collection("selected-figures").document(figure_id).collection("article-summaries").document(doc_id)
                                    summary_ref.update(update_data, timeout=timeout)
                                    print(f"Updated events in {doc_id} with corrected dates for {figure_name}")
                                except Exception as e:
                                    print(f"Error updating document {doc_id}: {e}")
                                    print("Continuing with next document...")
                        else:
                            print(f"Failed to generate valid replacement dates for {doc_id}, skipping update")
                            
                    except Exception as e:
                        print(f"Error processing summary {doc_id}: {e}")
                
                # If we got fewer results than the batch size, we're done
                if len(summaries) < batch_size:
                    has_more = False
                    
            except Exception as e:
                print(f"Error processing batch for figure {figure_name}: {e}")
                print("Waiting 3 seconds before next batch...")
                await asyncio.sleep(3)
                
    except Exception as e:
        print(f"Error accessing summaries for figure {figure_name}: {e}")
    
    print(f"Figure {figure_name}: Processed {figure_summaries} summaries, corrected dates in {figure_corrected}")
    
    return {
        'processed': figure_summaries,
        'corrected': figure_corrected
    }

async def regenerate_events(news_manager, public_figure_name, title, description, article_date, existing_events, invalid_dates):
    """
    Regenerate events with correct dates using DeepSeek API.
    
    Args:
        news_manager: NewsManager instance with DeepSeek client
        public_figure_name (str): Name of the public figure
        title (str): Article title
        description (str): Article content
        article_date (str): Article date in YYYY-MM-DD format
        existing_events (dict): Existing event_contents with dates as keys
        invalid_dates (list): List of dates that are in invalid format
        
    Returns:
        dict: Generated events with corrected dates or None if failed
    """
    try:
        # Create a prompt focused on fixing the dates
        invalid_dates_str = ", ".join([f"'{date}'" for date in invalid_dates])
        
        # Include information about existing events
        existing_events_str = ""
        for date, content in existing_events.items():
            existing_events_str += f"- Date: {date}, Event: {content}\n"
        
        prompt = f"""
        I need to fix the date formats in the following events related to {public_figure_name}.
        
        Article Title: {title}
        Article Publication Date: {article_date}
        
        EXISTING EVENTS WITH POTENTIAL DATE FORMAT ISSUES:
        {existing_events_str}
        
        INVALID DATES THAT NEED CORRECTION: {invalid_dates_str}
        
        The article content is:
        {description}

        Instructions:
        1. Focus only on fixing the dates while maintaining the same events
        2. Keep the event descriptions as close as possible to the original ones
        
        3. IMPORTANT: For date extraction, follow these STRICT RULES:
           a) ALWAYS use the article publication date ({article_date}) as your reference point
           b) When the article says:
              - "this year" → it means {article_date[:4]}
              - "last year" → it means {int(article_date[:4])-1}
              - "next year" → it means {int(article_date[:4])+1}
              - "this month" → it means {article_date[:7]}
              - "last month" → it means one month before {article_date[:7]}
              - "next month" → it means one month after {article_date[:7]}
              - "yesterday" → it means the day before {article_date}
              - "today" → it means {article_date}
              - "tomorrow" → it means the day after {article_date}
           c) If the article mentions a specific date, use that exact date
           d) If the article mentions only a month and year, format as YYYY-MM
           e) If the article mentions only a year, format as YYYY
           f) If the article does not specify a year for an event, assume it is the same year as the article publication date ({article_date[:4]})
           g) NEVER use future dates for past events or past dates for future events
           h) Check tense of verbs - past tense verbs mean events happened before the article date, future tense means after
           i) Ensure every date is in one of these formats: YYYY, YYYY-MM, or YYYY-MM-DD

        Return your response in this JSON format:
        {{
        "events": [
            {{
            "date": "YYYY-MM-DD", 
            "event": "Description of what happened on this date"
            }},
            ...
        ]
        }}

        IMPORTANT: Every date must be in a valid format (YYYY, YYYY-MM, or YYYY-MM-DD) and must be accurate based on the article content.
        """
        
        # Call the DeepSeek API
        response = news_manager.client.chat.completions.create(
            model=news_manager.model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts and corrects dates and event descriptions. You are excellent at date calculations and formatting."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,  # Lower temperature for more consistent responses
            max_tokens=800  # Token limit
        )
        
        # Extract the response
        result = response.choices[0].message.content.strip()
        
        # Clean up the result - remove any markdown formatting
        if result.startswith("```json"):
            result = result[7:-3].strip()
        elif result.startswith("```"):
            result = result[3:-3].strip()
            
        # Find the JSON object in the response
        json_match = re.search(r"\{.*\}", result, re.DOTALL)
        if json_match:
            result = json_match.group(0)
        
        # Parse the JSON
        try:
            data = json.loads(result)
            
            # Ensure we have the expected fields
            events = data.get("events", [])
            
            # Validate dates in events
            validated_events = []
            for event in events:
                date_str = event.get("date", "")
                event_content = event.get("event", "")
                
                # Skip if date or event is missing
                if not date_str or not event_content:
                    continue
                
                # Ensure date is in a valid format
                if is_valid_date_format(date_str):
                    validated_events.append(event)
                else:
                    print(f"Warning: Generated date '{date_str}' is still invalid, skipping this event")
            
            return {
                "events": validated_events
            }
                
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON response: {e}")
            print(f"Raw response: {result}")
            return None
            
    except Exception as e:
        print(f"Error regenerating events for {public_figure_name}: {e}")
        return None

def is_valid_date_format(date_str):
    """Check if the date string is in a valid format (YYYY, YYYY-MM, or YYYY-MM-DD)."""
    if re.match(r'^\d{4}$', date_str):
        # Year only: Check if it's a reasonable year
        year = int(date_str)
        return 1900 <= year <= 2030
    elif re.match(r'^\d{4}-\d{2}$', date_str):
        # Year-month: Check if month is valid
        year = int(date_str[:4])
        month = int(date_str[5:7])
        return 1900 <= year <= 2030 and 1 <= month <= 12
    elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        # Full date: Check if it's a valid date
        try:
            year = int(date_str[:4])
            month = int(date_str[5:7])
            day = int(date_str[8:10])
            # Basic validation
            return (1900 <= year <= 2030 and 
                    1 <= month <= 12 and 
                    1 <= day <= 31 and
                    not (month in [4, 6, 9, 11] and day > 30) and
                    not (month == 2 and day > 29) and
                    not (month == 2 and day == 29 and not (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0))))
        except ValueError:
            return False
    return False

async def main():
    parser = argparse.ArgumentParser(description='Validate and correct dates in event_contents')
    parser.add_argument('--limit', type=int, default=None, 
                        help='Limit the number of figures to process')
    parser.add_argument('--start-from', type=str, default=None,
                        help='Start processing from this figure ID')
    parser.add_argument('--figure', type=str, default=None,
                        help='Process only this specific figure ID')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without updating the database')
    parser.add_argument('--batch-size', type=int, default=10,
                        help='Number of figures to process in each batch')
    parser.add_argument('--timeout', type=int, default=300,
                        help='Timeout in seconds for Firebase operations')
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.figure and (args.limit or args.start_from):
        print("Warning: When --figure is specified, --limit and --start-from are ignored.")
    
    print("\n=== Starting Date Validation Process ===\n")
    
    # Make sure setup_firebase_deepseek.py is in the path
    module_dir = os.path.dirname(os.path.abspath(__file__))
    if module_dir not in sys.path:
        sys.path.append(module_dir)
    
    # Configure error handling and recovery
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            await validate_figure_dates(
                limit=args.limit, 
                start_from=args.start_from, 
                single_figure=args.figure,
                dry_run=args.dry_run,
                batch_size=args.batch_size,
                timeout=args.timeout
            )
            break  # Successfully completed, exit the retry loop
        except Exception as e:
            retry_count += 1
            print(f"\n!!! Error during execution (attempt {retry_count}/{max_retries}): {e}")
            
            if retry_count < max_retries:
                wait_time = 10 * retry_count  # Exponential backoff
                print(f"Waiting {wait_time} seconds before retrying...")
                await asyncio.sleep(wait_time)
            else:
                print("Maximum retry attempts reached. Exiting.")
    
    print("\n=== Date Validation Process Complete ===\n")

if __name__ == "__main__":
    asyncio.run(main())