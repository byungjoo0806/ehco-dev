import re
from datetime import datetime, timedelta
import pytz
import asyncio
import sys
import os
import argparse

# Import your NewsManager class from the setup file
from setup_firebase_deepseek import NewsManager

async def fix_relative_dates(limit=None, start_from=None, single_figure=None):
    """
    Process article summaries to fix relative dates based on document IDs.
    
    Args:
        limit (int, optional): Limit the number of figures to process
        start_from (str, optional): Start processing from this figure ID
        single_figure (str, optional): Process only this specific figure ID
    """
    # Initialize the NewsManager to get Firebase connection and DeepSeek API
    news_manager = NewsManager()
    db = news_manager.db
    
    try:
        # If processing just a single figure
        if single_figure:
            figure_ref = db.collection("selected-figures").document(single_figure)
            figure_doc = figure_ref.get()
            
            if not figure_doc.exists:
                print(f"Error: Figure with ID '{single_figure}' not found!")
                return
                
            # Process just this one figure
            figure_data = figure_doc.to_dict()
            figure_name = figure_data.get("name", single_figure)
            print(f"\n=== Processing single figure: {figure_name} ({single_figure}) ===\n")
            
            # Process all summaries for this figure
            await process_figure_summaries(db, single_figure, figure_name, news_manager)
            
            print(f"\n=== Completed processing for figure: {figure_name} ===\n")
            return
        
        # Process multiple figures
        query = db.collection("selected-figures")
        
        # Apply start_from if provided
        if start_from:
            start_doc_ref = db.collection("selected-figures").document(start_from)
            start_doc = start_doc_ref.get()
            if start_doc.exists:
                query = query.start_after(start_doc)
                print(f"Starting processing after figure: {start_from}")
            else:
                print(f"Warning: Start figure {start_from} does not exist. Starting from the beginning.")
        
        # Apply limit if provided
        if limit:
            query = query.limit(limit)
            print(f"Limited to processing {limit} figures")
        
        figures_ref = query.stream()
        
        total_figures = 0
        total_processed = 0
        total_fixed = 0
        total_ai_corrections = 0
        
        for figure in figures_ref:
            total_figures += 1
            figure_id = figure.id
            figure_data = figure.to_dict()
            figure_name = figure_data.get("name", figure_id)
            
            print(f"\n--- Processing figure {total_figures}: {figure_name} ({figure_id}) ---")
            
            # Process this figure's summaries and get stats
            figure_stats = await process_figure_summaries(db, figure_id, figure_name, news_manager)
            
            total_processed += figure_stats['processed']
            total_fixed += figure_stats['fixed']
            total_ai_corrections += figure_stats.get('ai_corrections', 0)
        
        print(f"\n=== FINAL STATISTICS ===")
        print(f"Total figures processed: {total_figures}")
        print(f"Total summaries processed: {total_processed}")
        print(f"Total summaries fixed: {total_fixed}")
        print(f"Total AI-based corrections: {total_ai_corrections}")
    
    finally:
        # Close connections
        await news_manager.close()
        
async def process_figure_summaries(db, figure_id, figure_name, news_manager):
    """
    Process all summaries for a specific figure.
    
    Args:
        db: Firestore database instance
        figure_id (str): Figure document ID
        figure_name (str): Figure name for display
        news_manager: The NewsManager instance with DeepSeek client
        
    Returns:
        dict: Statistics about processed summaries
    """
    summaries_ref = db.collection("selected-figures").document(figure_id).collection("article-summaries").stream()
    
    figure_summaries = 0
    figure_fixed = 0
    ai_corrections = 0
    
    for summary in summaries_ref:
        figure_summaries += 1
        summary_data = summary.to_dict()
        
        # Skip if no event contents
        if "event_contents" not in summary_data or not summary_data["event_contents"]:
            continue
        
        # Extract date from the document ID (e.g., "AEN20171030014300315")
        doc_id = summary.id
        article_date = None
        
        # Extract YYYYMMDD from document ID
        date_match = re.search(r'AEN(\d{8})', doc_id)
        if date_match:
            date_str = date_match.group(1)
            try:
                article_date = datetime.strptime(date_str, "%Y%m%d")
                print(f"Extracted article date: {article_date.strftime('%Y-%m-%d')} from ID: {doc_id}")
            except ValueError:
                print(f"Could not parse date from ID: {doc_id}")
        
        if not article_date:
            print(f"No valid date found in document ID {doc_id}, skipping")
            continue
        
        # Get current event dates and contents
        event_contents = summary_data["event_contents"]
        event_dates = summary_data.get("event_dates", [])
        
        # Get article body for context
        article_body = summary_data.get("body", "")
        
        # Create corrected versions
        need_update = False
        corrected_contents = {}
        corrected_dates = []
        
        # Analyze each date/content pair
        for date_str, content in event_contents.items():
            # First check if the date in event content itself might be wrong
            rule_based_date, rule_based_confidence = fix_incorrect_event_content_date(date_str, content, article_body, article_date)
            
            # Get a second opinion from our rule-based system
            alternative_rule_based_date = fix_relative_date(date_str, content, article_body, article_date)
            
            # If both rule-based methods agree and suggest a change with high confidence
            if rule_based_date != date_str and rule_based_date == alternative_rule_based_date and rule_based_confidence == "high":
                # We already have high confidence from both rule-based systems
                final_date = rule_based_date
                print(f"Rule-based systems agree with HIGH confidence: {date_str} -> {final_date}")
            else:
                # If we have any disagreement or medium/low confidence, consult AI
                final_date, ai_confidence = await ai_verify_date_correction(
                    news_manager, 
                    date_str, 
                    rule_based_date if rule_based_confidence != "low" else alternative_rule_based_date,
                    content, 
                    article_body,
                    article_date
                )
                
                if final_date != date_str:
                    ai_corrections += 1
                    print(f"AI correction with {ai_confidence} confidence: {date_str} -> {final_date}")
            
            # Apply the correction if needed
            if final_date != date_str:
                need_update = True
                corrected_contents[final_date] = content
                
                # Update the dates array too if it exists
                if date_str in event_dates:
                    idx = event_dates.index(date_str)
                    corrected_dates.insert(idx, final_date)
                else:
                    corrected_dates.append(final_date)
            else:
                corrected_contents[date_str] = content
                if date_str not in corrected_dates:
                    corrected_dates.append(date_str)
        
        # If we made changes, update the document
        if need_update:
            figure_fixed += 1
            summary_ref = db.collection("selected-figures").document(figure_id).collection("article-summaries").document(summary.id)
            
            # Create update data
            update_data = {
                "event_contents": corrected_contents,
            }
            
            # Only update event_dates if it existed before
            if "event_dates" in summary_data:
                update_data["event_dates"] = corrected_dates
            
            summary_ref.update(update_data)
            print(f"Updated summary {summary.id} for figure {figure_name}")
    
    print(f"Figure {figure_name}: Processed {figure_summaries} summaries, fixed {figure_fixed}, AI corrections: {ai_corrections}")
    
    await asyncio.sleep(0.5)
    
    return {
        'processed': figure_summaries,
        'fixed': figure_fixed,
        'ai_corrections': ai_corrections
    }

def fix_relative_date(date_str, content, article_body, article_date):
    """
    Analyze and fix date strings with high precision, focusing on contextual clues.
    Preserves the original date format (YYYY, YYYY-MM, or YYYY-MM-DD).
    
    Args:
        date_str (str): The current date string to fix
        content (str): The event content describing what happened
        article_body (str): The full article text for additional context
        article_date (datetime): The publication date of the article
        
    Returns:
        str: The corrected date string in the same format as the input
    """
    # Create a combined text for analysis
    combined_text = (content + " " + article_body).lower()
    
    # Determine the original date format to preserve it
    date_format = "year"  # Default
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        date_format = "full"
    elif re.match(r'^\d{4}-\d{2}$', date_str):
        date_format = "year-month"
    
    # Parse the original date components
    year = None
    month = None
    day = None
    
    if date_format == "full":
        year = int(date_str[:4])
        month = int(date_str[5:7])
        day = int(date_str[8:10])
    elif date_format == "year-month":
        year = int(date_str[:4])
        month = int(date_str[5:7])
    else:  # year format
        year = int(date_str)
    
    # Store original values to check if they changed
    original_year = year
    original_month = month
    original_day = day
    
    article_year = article_date.year
    article_month = article_date.month
    article_day = article_date.day
    
    # ANALYZE YEAR COMPONENT
    if year is not None:
        # Handle explicit relative year references
        if re.search(r'\b(this year|current year|the year)\b', combined_text):
            year = article_year
                
        elif re.search(r'\b(last year|previous year|past year|year before)\b', combined_text):
            year = article_year - 1
                
        elif re.search(r'\b(next year|coming year|following year|year ahead)\b', combined_text):
            year = article_year + 1
                
        elif re.search(r'\b(two years ago|2 years ago)\b', combined_text):
            year = article_year - 2
                
        elif re.search(r'\b(three years ago|3 years ago)\b', combined_text):
            year = article_year - 3
                
        # Check for major year discrepancies when no relative terms found
        elif abs(year - article_year) > 3:  # More strict check for 3 years difference
            # Look for explicit mentions of the year in the text
            year_str = str(year)
            year_explicit = False
            
            # Check for exact year mention
            if year_str in combined_text:
                if re.search(fr'\b{year_str}\b', combined_text):
                    year_explicit = True
            
            # If year not explicitly mentioned, likely should be article year
            if not year_explicit:
                future_indicators = ['will', 'is set to', 'is scheduled to', 'upcoming', 'next', 'plan', 'future']
                past_indicators = ['was', 'were', 'had', 'attended', 'held', 'performed', 'released']
                
                has_future = any(indicator in combined_text for indicator in future_indicators)
                has_past = any(indicator in combined_text for indicator in past_indicators)
                
                if has_future and not has_past:
                    # Future tense suggests article year or later
                    if year < article_year:
                        year = article_year
                elif has_past and not has_future:
                    # Past tense suggests article year or earlier
                    if year > article_year:
                        year = article_year
                elif abs(year - article_year) > 10:
                    # Major discrepancy with no clear evidence
                    year = article_year
    
    # ANALYZE MONTH COMPONENT (if present in original)
    if date_format in ["year-month", "full"] and month is not None:
        # Handle relative month references
        if re.search(r'\b(this month|current month|the month of)\b', combined_text):
            year = article_year
            month = article_month
                
        elif re.search(r'\b(last month|previous month|month before)\b', combined_text):
            prev_month_date = article_date - timedelta(days=30)
            year = prev_month_date.year
            month = prev_month_date.month
                
        elif re.search(r'\b(next month|coming month|month ahead)\b', combined_text):
            next_month_date = article_date + timedelta(days=30)
            year = next_month_date.year
            month = next_month_date.month
    
    # ANALYZE DAY COMPONENT (if present in original)
    if date_format == "full" and day is not None:
        # Check for specific day references
        if re.search(r'\b(yesterday|the day before)\b', combined_text):
            yesterday = article_date - timedelta(days=1)
            year = yesterday.year
            month = yesterday.month
            day = yesterday.day
                
        elif re.search(r'\b(today|current day)\b', combined_text):
            year = article_date.year
            month = article_date.month
            day = article_date.day
                
        elif re.search(r'\b(tomorrow|the next day)\b', combined_text):
            tomorrow = article_date + timedelta(days=1)
            year = tomorrow.year
            month = tomorrow.month
            day = tomorrow.day
    
    # BUILD THE CORRECTED DATE STRING IN THE ORIGINAL FORMAT
    if date_format == "full":
        corrected_date = f"{year}-{month:02d}-{day:02d}"
    elif date_format == "year-month":
        corrected_date = f"{year}-{month:02d}"
    else:  # year format
        corrected_date = f"{year}"
    
    # Only print details if something changed
    if corrected_date != date_str:
        changes = []
        if original_year != year:
            changes.append(f"year {original_year}->{year}")
        if date_format in ["year-month", "full"] and original_month != month:
            changes.append(f"month {original_month}->{month}")
        if date_format == "full" and original_day != day:
            changes.append(f"day {original_day}->{day}")
            
        print(f"Fixing date '{date_str}' to '{corrected_date}' (changed: {', '.join(changes)})")
    
    return corrected_date

def find_year_context_for_month(text, month_name, default_year):
    """
    Find the year context for a specific month mention in text.
    
    Args:
        text (str): The text to analyze
        month_name (str): The month name to find context for
        default_year (int): Default year to return if no context found
        
    Returns:
        int: The year associated with this month mention
    """
    # Look for patterns like "January 2019" or "in May 2020"
    pattern = fr"\b{month_name}\s+(\d{{4}})\b|\b{month_name}\s+of\s+(\d{{4}})\b|\bin\s+{month_name}\s+(\d{{4}})\b"
    match = re.search(pattern, text, re.IGNORECASE)
    
    if match:
        # Return the first non-None group (the year)
        for group in match.groups():
            if group:
                return int(group)
    
    # Look for relative year context
    if re.search(fr"\b(this|the current)\s+{month_name}\b", text, re.IGNORECASE):
        return default_year
    elif re.search(fr"\blast\s+{month_name}\b", text, re.IGNORECASE):
        # Check if we're currently past that month in the year
        current_month = datetime.now().month
        month_num = get_month_number(month_name)
        if month_num is not None:
            if month_num >= current_month:
                return default_year - 1
            else:
                return default_year
    elif re.search(fr"\bnext\s+{month_name}\b", text, re.IGNORECASE):
        # Check if we're currently before that month in the year
        current_month = datetime.now().month
        month_num = get_month_number(month_name)
        if month_num is not None:
            if month_num <= current_month:
                return default_year + 1
            else:
                return default_year
    
    # Default to the article year if no clear context
    return default_year

def get_month_number(month_name):
    """Get the month number (1-12) from a month name."""
    month_dict = {
        'january': 1, 'jan': 1,
        'february': 2, 'feb': 2,
        'march': 3, 'mar': 3,
        'april': 4, 'apr': 4,
        'may': 5,
        'june': 6, 'jun': 6,
        'july': 7, 'jul': 7,
        'august': 8, 'aug': 8,
        'september': 9, 'sep': 9, 'sept': 9,
        'october': 10, 'oct': 10,
        'november': 11, 'nov': 11,
        'december': 12, 'dec': 12
    }
    return month_dict.get(month_name.lower())

def fix_incorrect_event_content_date(date_str, content, article_body, article_date):
    """
    Check if the date mentioned in event content seems incorrect when compared to article.
    
    Returns:
        tuple: (corrected_date, confidence) where confidence is 'high', 'medium', or 'low'
    """
    year = None
    month = None
    day = None
    confidence = "low"
    
    # Parse the date string
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        year = int(date_str[:4])
        month = int(date_str[5:7])
        day = int(date_str[8:10])
    elif re.match(r'^\d{4}-\d{2}$', date_str):
        year = int(date_str[:4])
        month = int(date_str[5:7])
    elif re.match(r'^\d{4}$', date_str):
        year = int(date_str)
    
    if year is None:
        return (date_str, "low")
    
    # Look for explicit date mentions in article body
    article_body_lower = article_body.lower()
    
    # Extract all potential dates from article body
    date_patterns = [
        r'\b(\d{4})-(\d{1,2})-(\d{1,2})\b',  # YYYY-MM-DD
        r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b',  # MM/DD/YYYY or DD/MM/YYYY
        r'\b(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})\b',  # Month Day, Year
        r'\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(\w+),?\s+(\d{4})\b'  # Day Month Year
    ]
    
    article_dates = []
    month_names = {
        'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
        'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
        'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9, 'october': 10, 
        'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12
    }
    
    # Extract all dates from article body
    for pattern in date_patterns:
        matches = re.finditer(pattern, article_body_lower)
        for match in matches:
            try:
                if pattern == r'\b(\d{4})-(\d{1,2})-(\d{1,2})\b':
                    y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
                    if 1900 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31:
                        article_dates.append((y, m, d))
                
                elif pattern == r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b':
                    # This is ambiguous (could be MM/DD or DD/MM) - try both
                    a, b, y = int(match.group(1)), int(match.group(2)), int(match.group(3))
                    if 1 <= a <= 12 and 1 <= b <= 31 and 1900 <= y <= 2100:
                        article_dates.append((y, a, b))  # Assuming MM/DD
                    if 1 <= b <= 12 and 1 <= a <= 31 and 1900 <= y <= 2100:
                        article_dates.append((y, b, a))  # Assuming DD/MM
                
                elif pattern == r'\b(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})\b':
                    month_name, d, y = match.group(1).lower(), int(match.group(2)), int(match.group(3))
                    if month_name in month_names and 1 <= d <= 31 and 1900 <= y <= 2100:
                        article_dates.append((y, month_names[month_name], d))
                
                elif pattern == r'\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(\w+),?\s+(\d{4})\b':
                    d, month_name, y = int(match.group(1)), match.group(2).lower(), int(match.group(3))
                    if month_name in month_names and 1 <= d <= 31 and 1900 <= y <= 2100:
                        article_dates.append((y, month_names[month_name], d))
            except:
                continue
    
    # Look for direct matches between content date and article dates
    if year and month and day:
        # We have a full date to compare
        for art_y, art_m, art_d in article_dates:
            if art_y == year and art_m == month and art_d == day:
                return (date_str, "high")  # Date explicitly confirmed in article
            
            # If we find the same month/day but different year, that's suspicious
            if art_m == month and art_d == day and art_y != year:
                corrected = f"{art_y}-{month:02d}-{day:02d}"
                return (corrected, "high")
    
    elif year and month:
        # We have year and month to compare
        for art_y, art_m, _ in article_dates:
            if art_y == year and art_m == month:
                return (date_str, "high")  # Date explicitly confirmed
            
            # Same month, different year
            if art_m == month and art_y != year:
                corrected = f"{art_y}-{month:02d}"
                return (corrected, "medium")
    
    elif year:
        # We only have year to compare
        article_years = [y for y, _, _ in article_dates]
        if year in article_years:
            return (date_str, "high")  # Year explicitly confirmed
        
        # If year not found but another year is mentioned multiple times
        if article_years:
            # Count occurrences of each year
            from collections import Counter
            year_counts = Counter(article_years)
            most_common_year = year_counts.most_common(1)[0][0]
            
            # If a different year appears multiple times, it's suspicious
            if most_common_year != year and year_counts[most_common_year] >= 2:
                return (str(most_common_year), "medium")
    
    # Check for tense inconsistency
    if year:
        is_past_event = False
        is_future_event = False
        
        # Check for past tense indicators
        past_tense = ['announced', 'released', 'launched', 'performed', 'held', 'conducted',
                    'participated', 'attended', 'won', 'said', 'was', 'were', 'had']
        
        # Check for future tense indicators
        future_tense = ['will', 'scheduled', 'upcoming', 'plan', 'expected', 'set to']
        
        content_lower = content.lower()
        
        is_past_event = any(word in content_lower for word in past_tense)
        is_future_event = any(word in content_lower for word in future_tense)
        
        article_year = article_date.year
        
        # Severe inconsistency: content talks about past event but date is in future
        if is_past_event and not is_future_event and year > article_year:
            # This is likely wrong - fix to article year or year before
            return (f"{article_year}", "high")
            
        # Severe inconsistency: content talks about future event but date is in past
        if is_future_event and not is_past_event and year < article_year:
            # This is likely wrong - fix to article year or year after
            return (f"{article_year}", "high")
    
    # If no clear evidence, check plausibility of time gap
    if year:
        article_year = article_date.year
        time_gap = abs(year - article_year)
        
        # Extremely large gaps with no explicit confirmation are suspicious
        if time_gap > 10:
            return (f"{article_year}", "medium")  # Use article year as fallback
        elif time_gap > 5:
            return (f"{article_year}", "low")  # Lower confidence but still suspicious
    
    # No correction needed or not enough evidence
    return (date_str, "low")

async def ai_verify_date_correction(news_manager, original_date, suggested_date, content, article_body, article_date):
    """
    Use DeepSeek API to verify a suggested date correction.
    
    Args:
        news_manager: The NewsManager instance with DeepSeek client
        original_date (str): The original date string
        suggested_date (str): The suggested corrected date
        content (str): The event content
        article_body (str): The full article text
        article_date (datetime): Publication date extracted from document ID
        
    Returns:
        tuple: (verified_date, confidence) 
    """
    # Format article date for context
    article_date_str = article_date.strftime("%Y-%m-%d")
    
    # Prepare prompt for the AI
    prompt = f"""
    CONTEXT:
    Original date stored in database: {original_date}
    Date suggested by rule-based system: {suggested_date}
    Article publication date (from ID): {article_date_str}
    
    Event content: "{content}"
    
    Article excerpt (first 500 chars): "{article_body[:500]}..."
    
    TASK:
    Analyze the article and event content to determine the most accurate date for this event.
    Consider temporal expressions, tense, and context in the article.
    
    Return your answer in this exact format:
    DATE: [YYYY, YYYY-MM, or YYYY-MM-DD matching the original date's format]
    CONFIDENCE: [high/medium/low]
    """
    
    try:
        # Call DeepSeek API
        response = news_manager.client.chat.completions.create(
            model=news_manager.model,
            messages=[
                {"role": "system", "content": "You are an expert date analyst for news articles. Your task is to determine the correct date for events mentioned in articles based on context."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # Low temperature for consistent, factual responses
            max_tokens=100    # Short response is all we need
        )
        
        # Parse response to get the verified date and confidence
        response_text = response.choices[0].message.content.strip()
        
        # Extract date and confidence
        date_line = [line for line in response_text.split('\n') if line.startswith('DATE:')]
        confidence_line = [line for line in response_text.split('\n') if line.startswith('CONFIDENCE:')]
        
        if date_line and confidence_line:
            verified_date = date_line[0].replace('DATE:', '').strip()
            confidence = confidence_line[0].replace('CONFIDENCE:', '').strip().lower()
            
            # Validate confidence level
            if confidence not in ['high', 'medium', 'low']:
                confidence = 'medium'  # Default to medium if invalid
                
            return verified_date, confidence
        else:
            # If parsing fails, return the suggested date with low confidence
            print(f"Warning: Failed to parse AI response properly. Response: {response_text}")
            return suggested_date, "low"
            
    except Exception as e:
        print(f"Error calling DeepSeek API: {e}")
        # Fall back to the rule-based suggestion
        return suggested_date, "low"

async def main():
    parser = argparse.ArgumentParser(description='Fix relative dates in article summaries')
    parser.add_argument('--limit', type=int, default=None, 
                        help='Limit the number of figures to process')
    parser.add_argument('--start-from', type=str, default=None,
                        help='Start processing from this figure ID')
    parser.add_argument('--figure', type=str, default=None,
                        help='Process only this specific figure ID')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without updating the database')
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.figure and (args.limit or args.start_from):
        print("Warning: When --figure is specified, --limit and --start-from are ignored.")
    
    print("\n=== Starting Date Correction Process ===\n")
    
    # Make sure setup_firebase_deepseek.py is in the path
    module_dir = os.path.dirname(os.path.abspath(__file__))
    if module_dir not in sys.path:
        sys.path.append(module_dir)
    
    await fix_relative_dates(limit=args.limit, start_from=args.start_from, single_figure=args.figure)
    
    print("\n=== Date Correction Process Complete ===\n")

if __name__ == "__main__":
    asyncio.run(main())