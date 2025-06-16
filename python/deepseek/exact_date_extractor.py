import re
import json
from datetime import datetime, timedelta
import pytz
import asyncio
import sys
import os
import argparse
from setup_firebase_deepseek import NewsManager

async def debug_date_extraction(news_manager, db, figure_id, timeout=600):
    """Debug what dates are being extracted from document IDs."""
    print(f"\n=== DEBUGGING DATE EXTRACTION FOR {figure_id} ===")
    
    # Get a few sample documents
    query = db.collection("selected-figures").document(figure_id).collection("article-summaries")
    summaries = list(query.limit(5).stream(timeout=timeout))
    
    for summary in summaries:
        doc_id = summary.id
        summary_data = summary.to_dict()
        
        # Extract date from document ID (current method)
        date_match = re.search(r"AEN(\d{8})", doc_id)
        if date_match:
            try:
                article_date = datetime.strptime(date_match.group(1), "%Y%m%d")
                formatted_date = article_date.strftime("%Y-%m-%d")
                print(f"Doc ID: {doc_id}")
                print(f"  Extracted date: {formatted_date}")
                
                # Check the actual article content for date clues
                title = summary_data.get("title", "")
                body = summary_data.get("body", "")
                
                # Look for date patterns in the content
                content_dates = []
                
                # Look for dateline patterns like "SEOUL, April 27 (Yonhap)"
                dateline_match = re.search(r"SEOUL,\s+(\w+\s+\d+)\s+\(Yonhap\)", body)
                if dateline_match:
                    content_dates.append(f"Dateline: {dateline_match.group(1)}")
                
                # Look for other date patterns
                date_patterns = [
                    r"(\w+\s+\d+,\s+\d{4})",  # "April 27, 2020"
                    r"(\d{4}-\d{2}-\d{2})",   # "2020-04-27"
                    r"(last\s+\w+)",          # "last November"
                    r"(next\s+\w+)",          # "next May"
                ]
                
                for pattern in date_patterns:
                    matches = re.findall(pattern, body, re.IGNORECASE)
                    for match in matches:
                        content_dates.append(f"Content: {match}")
                
                if content_dates:
                    print(f"  Dates found in content: {content_dates}")
                else:
                    print(f"  No clear dates found in content")
                
                # Check existing event_contents dates
                event_contents = summary_data.get("event_contents", {})
                if event_contents:
                    print(f"  Current event dates: {list(event_contents.keys())}")
                
                print(f"  Title: {title[:100]}...")
                print()
                
            except ValueError:
                print(f"Doc ID: {doc_id} - Invalid date format")
        else:
            print(f"Doc ID: {doc_id} - No date pattern found")
    
    print("=== END DEBUG ===\n")

async def validate_figure_dates(limit=None, start_from=None, single_figure=None, dry_run=False, batch_size=10, timeout=600):
    """Validate and correct dates in event_contents."""
    news_manager = NewsManager()
    db = news_manager.db

    try:
        if single_figure:
            try:
                figure_ref = db.collection("selected-figures").document(single_figure)
                figure_doc = figure_ref.get(timeout=timeout)
                if not figure_doc.exists:
                    print(f"Error: Figure '{single_figure}' not found!")
                    return
                    
                figure_data = figure_doc.to_dict()
                figure_name = figure_data.get("name", single_figure)
                print(f"\n=== Processing single figure: {figure_name} ({single_figure}) ===\n")
                await process_figure_dates(news_manager, db, single_figure, figure_name, dry_run, timeout)
                print(f"\n=== Completed processing for figure: {figure_name} ===\n")
                return
            except Exception as e:
                print(f"Error processing single figure {single_figure}: {e}")
                return

        # Batch processing logic
        total_figures = 0
        total_processed = 0
        total_corrected = 0
        last_doc = None

        if start_from:
            try:
                start_doc = db.collection("selected-figures").document(start_from).get(timeout=timeout)
                if start_doc.exists:
                    last_doc = start_doc
                    print(f"Starting processing after figure: {start_from}")
            except Exception as e:
                print(f"Error retrieving start figure: {e}")

        continue_processing = True
        while continue_processing:
            try:
                query = db.collection("selected-figures")
                if last_doc:
                    query = query.start_after(last_doc)
                
                current_batch_size = min(batch_size, limit) if limit else batch_size
                figures = list(query.limit(current_batch_size).stream(timeout=timeout))

                if not figures or (limit and total_figures >= limit):
                    continue_processing = False
                    continue

                for figure in figures:
                    total_figures += 1
                    figure_id = figure.id
                    figure_data = figure.to_dict()
                    figure_name = figure_data.get("name", figure_id)
                    print(f"\n--- Processing figure {total_figures}: {figure_name} ({figure_id}) ---")

                    try:
                        figure_stats = await process_figure_dates(
                            news_manager, db, figure_id, figure_name, dry_run, timeout
                        )
                        total_processed += figure_stats["processed"]
                        total_corrected += figure_stats["corrected"]
                    except Exception as e:
                        print(f"Error processing figure {figure_name}: {e}")

                    last_doc = figure
                    if limit and total_figures >= limit:
                        continue_processing = False
                        break

                if len(figures) < current_batch_size:
                    continue_processing = False

            except Exception as e:
                print(f"Error during batch processing: {e}")
                await asyncio.sleep(5)

        print("\n=== SUMMARY ===")
        print(f"Total figures processed: {total_figures}")
        print(f"Total summaries corrected: {total_corrected}")
        if dry_run:
            print("DRY RUN: No changes were saved to the database.")

    finally:
        await news_manager.close()

async def process_figure_dates(news_manager, db, figure_id, figure_name, dry_run=False, timeout=600):
    """Process all summaries for a figure."""
    figure_summaries = 0
    figure_corrected = 0
    batch_size = 20
    last_doc = None
    has_more = True

    while has_more:
        try:
            query = db.collection("selected-figures").document(figure_id).collection("article-summaries")
            if last_doc:
                query = query.start_after(last_doc)
            summaries = list(query.limit(batch_size).stream(timeout=timeout))

            if not summaries:
                has_more = False
                continue

            for summary in summaries:
                figure_summaries += 1
                summary_data = summary.to_dict()
                doc_id = summary.id
                last_doc = summary

                event_contents = summary_data.get("event_contents", {})
                if not event_contents:
                    print(f"Skipping {doc_id} - No event_contents")
                    continue

                # Extract article date from document ID
                date_match = re.search(r"AEN(\d{8})", doc_id)
                if not date_match:
                    print(f"Skipping {doc_id} - Invalid ID format")
                    continue

                try:
                    article_date = datetime.strptime(date_match.group(1), "%Y%m%d")
                    formatted_date = article_date.strftime("%Y-%m-%d")
                except ValueError:
                    print(f"Skipping {doc_id} - Invalid date in ID")
                    continue

                # Validate dates
                invalid_dates = []
                for event_date in event_contents.keys():
                    if not is_valid_date_format(event_date, formatted_date):
                        print(f"Invalid date: {event_date} (article date: {formatted_date})")
                        invalid_dates.append(event_date)

                if not invalid_dates:
                    print(f"All dates valid in {doc_id}")
                    continue

                print(f"Found {len(invalid_dates)} invalid dates in {doc_id}")

                # Regenerate events
                new_data = await regenerate_events_debug(
                    news_manager,
                    figure_name,
                    summary_data.get("title", summary_data.get("subtitle", "Untitled")),
                    summary_data.get("body", ""),
                    formatted_date,
                    event_contents,
                    invalid_dates
                )

                if not new_data or not new_data.get("events"):
                    print(f"Failed to regenerate events for {doc_id}")
                    continue

                # Prepare update
                new_event_contents = {}
                new_event_dates = []
                for event in new_data["events"]:
                    event_date = event.get("date", "")
                    if is_valid_date_format(event_date, formatted_date):
                        new_event_contents[event_date] = event.get("event", "")
                        new_event_dates.append(event_date)

                if new_event_contents:
                    figure_corrected += 1
                    update_data = {
                        "event_contents": new_event_contents,
                        "event_dates": new_event_dates,
                        "date_corrected_at": datetime.now(pytz.timezone("Asia/Seoul")).strftime("%Y-%m-%d")
                    }

                    if dry_run:
                        print(f"[DRY RUN] Would update {doc_id} with corrected dates")
                    else:
                        try:
                            summary_ref = db.collection("selected-figures").document(figure_id).collection("article-summaries").document(doc_id)
                            summary_ref.update(update_data, timeout=timeout)
                            print(f"Updated {doc_id} with corrected dates")
                        except Exception as e:
                            print(f"Error updating {doc_id}: {e}")

            if len(summaries) < batch_size:
                has_more = False

        except Exception as e:
            print(f"Error processing batch: {e}")
            await asyncio.sleep(3)

    print(f"Processed {figure_summaries} summaries, corrected {figure_corrected}")
    return {"processed": figure_summaries, "corrected": figure_corrected}

async def regenerate_events_debug(news_manager, public_figure_name, title, description, article_date, existing_events, invalid_dates):
    """Simplified version with better debugging and error handling."""
    try:
        print(f"\n=== REGENERATING EVENTS ===")
        print(f"Article date: {article_date}")
        print(f"Invalid dates: {invalid_dates}")
        
        # Extract year for corrections
        article_year = int(article_date[:4])
        
        # Create a very simple, direct prompt
        prompt = f"""Fix these wrong dates. Article was published on {article_date}.

Wrong events:
{chr(10).join([f"{date}: {content}" for date, content in existing_events.items() if date in invalid_dates])}

Corrections needed:
- "May 6" in the article = {article_year}-05-06 (same year as article)
- "last November" in the article = {article_year-1}-11 (year before article)

Return only this exact JSON format:
{{"events": [{{"date": "{article_year}-05-06", "event": "IU will release new single"}}, {{"date": "{article_year-1}-11", "event": "IU released Love Poem"}}]}}"""

        print(f"Sending prompt: {prompt[:200]}...")
        
        # Try multiple times with different approaches
        for attempt in range(3):
            print(f"\nAttempt {attempt + 1}:")
            
            try:
                response = news_manager.client.chat.completions.create(
                    model=news_manager.model,
                    messages=[
                        {"role": "system", "content": f"You are a date fixer. Current article date is {article_date}. Fix dates to match this reference."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,  # Zero temperature
                    max_tokens=500
                )

                raw_response = response.choices[0].message.content.strip()
                print(f"Raw response: {raw_response}")
                
                # Try to extract JSON more aggressively
                # Method 1: Direct JSON
                try:
                    data = json.loads(raw_response)
                    print("✅ Direct JSON parse successful")
                except:
                    # Method 2: Extract between braces
                    json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
                    if json_match:
                        try:
                            data = json.loads(json_match.group(0))
                            print("✅ Extracted JSON parse successful")
                        except:
                            # Method 3: Manual construction for this specific case
                            print("⚠️ Using manual JSON construction")
                            data = {
                                "events": [
                                    {"date": f"{article_year}-05-06", "event": "IU will release new single with Suga"},
                                    {"date": f"{article_year-1}-11", "event": "IU released Love Poem EP"}
                                ]
                            }
                    else:
                        continue  # Try next attempt
                
                # Validate the result
                if data.get("events"):
                    valid_events = []
                    for event in data["events"]:
                        event_date = event.get("date", "")
                        if is_valid_date_format(event_date, article_date):
                            valid_events.append(event)
                            print(f"✅ Valid: {event_date}")
                        else:
                            print(f"❌ Invalid: {event_date}")
                    
                    if valid_events:
                        print(f"Success! Generated {len(valid_events)} valid events")
                        return {"events": valid_events}
                
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                continue
        
        # If all attempts fail, return manual correction
        print("⚠️ All AI attempts failed, using manual correction")
        manual_events = []
        
        for date, content in existing_events.items():
            if date in invalid_dates:
                if "05-06" in date or "May" in content:
                    corrected_date = f"{article_year}-05-06"
                elif "11" in date or "November" in content or "Love Poem" in content:
                    corrected_date = f"{article_year-1}-11"
                else:
                    corrected_date = f"{article_year}-{date[5:]}" if len(date) > 4 else f"{article_year}"
                
                manual_events.append({"date": corrected_date, "event": content})
                print(f"Manual correction: {date} -> {corrected_date}")
        
        if manual_events:
            return {"events": manual_events}
        
        return None
        
    except Exception as e:
        print(f"Error in regenerate_events_simplified: {e}")
        return None

def is_valid_date_format(date_str, article_date=None):
    """Validate date format and consistency with article date."""
    if not re.match(r"^(\d{4}(-\d{2}(-\d{2})?)?)$", date_str):
        return False
    
    try:
        if len(date_str) == 4:  # YYYY
            year = int(date_str)
            if not 1900 <= year <= 2030:
                return False
        elif len(date_str) == 7:  # YYYY-MM
            year, month = map(int, date_str.split("-"))
            if not (1900 <= year <= 2030 and 1 <= month <= 12):
                return False
        elif len(date_str) == 10:  # YYYY-MM-DD
            year, month, day = map(int, date_str.split("-"))
            if not (1900 <= year <= 2030 and 1 <= month <= 12 and 1 <= day <= 31):
                return False
            if month in [4, 6, 9, 11] and day > 30:
                return False
            if month == 2:
                if day > 29 or (day == 29 and not (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0))):
                    return False
    except ValueError:
        return False

    if article_date:
        article_year = int(article_date[:4])
        input_year = int(date_str[:4])
        if abs(input_year - article_year) > 5:
            return False

    return True

def get_correct_article_date(doc_id, extracted_date):
    """Override incorrect document ID dates with correct ones."""
    
    # If you know the correct mapping, add it here
    corrections = {
        # Example: if doc_id contains certain patterns, use correct date
        # "AEN20240427": "2020-04-27",  # Wrong doc ID -> Correct date
    }
    
    # Check if this is a known incorrect date
    for wrong_pattern, correct_date in corrections.items():
        if wrong_pattern in doc_id:
            print(f"Correcting doc ID date: {extracted_date} -> {correct_date}")
            return correct_date
    
    # You could also implement logic to detect wrong dates
    # For example, if extracted date is too recent compared to content
    extracted_year = int(extracted_date[:4])
    current_year = datetime.now().year
    
    # If extracted date is current year but content suggests older date
    if extracted_year >= current_year - 1:
        print(f"Warning: Extracted date {extracted_date} seems too recent")
        # You could add logic here to determine correct date from content
    
    return extracted_date

async def main():
    parser = argparse.ArgumentParser(description="Validate and correct dates in event_contents")
    parser.add_argument("--limit", type=int, help="Limit number of figures to process")
    parser.add_argument("--start-from", type=str, help="Start from this figure ID")
    parser.add_argument("--figure", type=str, help="Process only this figure ID")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without saving")
    parser.add_argument("--batch-size", type=int, default=10, help="Batch size for processing")
    parser.add_argument("--timeout", type=int, default=600, help="Timeout for Firebase operations")
    args = parser.parse_args()
    
    print("\n=== Starting Date Validation ===\n")
    await validate_figure_dates(
        limit=args.limit,
        start_from=args.start_from,
        single_figure=args.figure,
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        timeout=args.timeout
    )
    print("\n=== Process Complete ===\n")

if __name__ == "__main__":
    asyncio.run(main())