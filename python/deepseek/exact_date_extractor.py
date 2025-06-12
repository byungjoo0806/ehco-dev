import re
import json
from datetime import datetime, timedelta
import pytz
import asyncio
import sys
import os
import argparse
from setup_firebase_deepseek import NewsManager

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
                new_data = await regenerate_events(
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

async def regenerate_events(news_manager, public_figure_name, title, description, article_date, existing_events, invalid_dates):
    """Regenerate events with correct dates using DeepSeek API."""
    try:
        # Calculate reference dates for the prompt
        article_year = int(article_date[:4])
        article_month = int(article_date[5:7])
        last_year = article_year - 1
        next_year = article_year + 1
        
        # Create month references
        prev_month = f"{article_year}-{article_month-1:02d}" if article_month > 1 else f"{last_year}-12"
        next_month = f"{article_year}-{article_month+1:02d}" if article_month < 12 else f"{next_year}-01"
        
        prompt = f"""
        TASK: Fix ONLY the invalid dates while keeping event descriptions IDENTICAL.
        
        ARTICLE INFORMATION:
        - Title: {title}
        - Publication Date: {article_date} ← THIS IS YOUR REFERENCE POINT
        - Figure: {public_figure_name}
        
        INVALID DATES TO CORRECT: {', '.join(invalid_dates)}
        
        EXISTING EVENTS (fix only the invalid dates):
        """ + "\n".join([f"- {date}: {content}" for date, content in existing_events.items()]) + f"""
        
        ARTICLE CONTENT:
        {description}
        
        CRITICAL DATE CORRECTION RULES:
        1. ALWAYS use article date ({article_date}) as reference
        2. When article mentions dates WITHOUT YEAR:
           - "May 6" → {article_year}-05-06
           - "November" → {article_year}-11
           - "last November" → {last_year}-11
           - "next May" → {next_year}-05
        3. Relative date conversions:
           - "this year" → {article_year}
           - "last year" → {last_year}
           - "next year" → {next_year}
           - "this month" → {article_date[:7]}
           - "last month" → {prev_month}
           - "next month" → {next_month}
           - "yesterday" → day before {article_date}
           - "today" → {article_date}
           - "tomorrow" → day after {article_date}
        4. NEVER assume future years unless explicitly stated
        5. Past tense verbs = events before article date
        6. Future tense verbs = events after article date (but same year unless specified)
        
        EXAMPLE FIXES:
        ❌ Wrong: "2024-05-06" (when article is from 2020)
        ✅ Correct: "2020-05-06"
        
        OUTPUT ONLY THIS JSON FORMAT:
        {{
        "events": [
            {{
            "date": "YYYY-MM-DD",
            "event": "EXACT original event description - DO NOT CHANGE WORDING"
            }}
        ]
        }}
        
        IMPORTANT: Keep event descriptions WORD-FOR-WORD identical. Only fix the dates.
        """
        
        response = news_manager.client.chat.completions.create(
            model=news_manager.model,
            messages=[
                {"role": "system", "content": "You are a precise date correction expert. Fix ONLY dates, never change event descriptions. Use the article publication date as the absolute reference for all date calculations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.05,  # Even lower temperature for more consistency
            max_tokens=1200
        )

        result = response.choices[0].message.content.strip()
        
        # Clean up response
        if result.startswith("```json"):
            result = result[7:-3].strip()
        elif result.startswith("```"):
            result = result[3:-3].strip()

        # Extract JSON
        json_match = re.search(r"\{.*\}", result, re.DOTALL)
        if not json_match:
            print("Error: No JSON found in AI response")
            print(f"Raw response: {result}")
            return None

        try:
            data = json.loads(json_match.group(0))
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            print(f"Raw response: {result}")
            return None

        if not data.get("events"):
            print("Error: No events in AI response")
            return None

        # Validate all generated dates
        validated_events = []
        for event in data["events"]:
            event_date = event.get("date", "")
            event_content = event.get("event", "")
            
            if not event_date or not event_content:
                print(f"Skipping incomplete event: {event}")
                continue
                
            if is_valid_date_format(event_date, article_date):
                validated_events.append(event)
                print(f"✅ Valid correction: {event_date} - {event_content[:50]}...")
            else:
                print(f"❌ Rejected invalid date: {event_date}")

        if not validated_events:
            print("No valid events generated after correction")
            return None
            
        return {"events": validated_events}
        
    except Exception as e:
        print(f"Error regenerating events for {public_figure_name}: {e}")
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