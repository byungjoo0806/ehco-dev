
from public_figure_extractor import PublicFigureExtractor, NewsManager
import asyncio
import json
import re
import firebase_admin
from firebase_admin import firestore
from datetime import datetime
import pytz
import csv
import os


class PredefinedPublicFigureExtractor(PublicFigureExtractor):
    def __init__(self, predefined_names=None, csv_filepath="k_celebrities_master.csv"):
        """
        Initialize the predefined public figure extractor.
        
        Args:
            predefined_names (list, optional): List of public figure names to look for.
                                            If None, loads names from CSV file.
            csv_filepath (str, optional): Path to the CSV file containing predefined figures.
                                        Only used if predefined_names is None.
        """
        super().__init__()
        self.predefined_names = predefined_names or []
        self.celebrity_data = {}  # Dictionary mapping names to their attributes
        
        # Load from CSV if no names are provided
        if not self.predefined_names:
            self.predefined_names, self.celebrity_data = self._load_predefined_names_from_csv(csv_filepath)
            
        print(f"Initialized with {len(self.predefined_names)} predefined public figures")
        
        # Show a preview of names
        preview_count = min(5, len(self.predefined_names))
        if preview_count > 0:
            print(f"Preview of first {preview_count} names: {', '.join(self.predefined_names[:preview_count])}")
        
    
    def _load_predefined_names_from_csv(self, csv_filepath="k_celebrities_master.csv"):
        """
        Load predefined public figure names from a CSV file.
        
        The CSV file should have columns: Name, Occupation, Type, Nationality
        
        Args:
            csv_filepath (str): Path to the CSV file containing public figure data
            
        Returns:
            tuple: (names_list, names_data_dict) where:
                - names_list is a simple list of all names
                - names_data_dict is a dictionary mapping names to their attributes
        """
        try:
            predefined_names = []
            predefined_data = {}  # Store all celebrity data for easier access
            
            if not os.path.exists(csv_filepath):
                print(f"CSV file not found: {csv_filepath}")
                print(f"Current working directory: {os.getcwd()}")
                print("Falling back to default hardcoded list")
                return self._load_default_predefined_names(), {}
                
            print(f"Loading public figures from CSV: {csv_filepath}")
            
            with open(csv_filepath, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                
                # Verify required columns exist
                required_columns = ['Name', 'Occupation', 'Type', 'Nationality']
                first_row = next(reader, None)
                csvfile.seek(0)  # Reset file pointer to beginning
                reader = csv.DictReader(csvfile)  # Recreate reader
                
                if first_row is None:
                    print("CSV file is empty")
                    return self._load_default_predefined_names(), {}
                    
                missing_columns = [col for col in required_columns if col not in first_row]
                if missing_columns:
                    print(f"CSV missing required columns: {', '.join(missing_columns)}")
                    return self._load_default_predefined_names(), {}
                
                # Read all rows
                for row in reader:
                    name = row.get('Name', '').strip()
                    if not name:
                        continue
                        
                    # Add to list of names
                    predefined_names.append(name)
                    
                    # Store complete data in dictionary for this name
                    predefined_data[name] = {
                        'occupation': row.get('Occupation', '').strip(),
                        'type': row.get('Type', '').strip(),
                        'nationality': row.get('Nationality', '').strip()
                    }
                    
            print(f"Successfully loaded {len(predefined_names)} public figures from CSV")
            return predefined_names, predefined_data
            
        except Exception as e:
            print(f"Error loading from CSV: {e}")
            print("Falling back to default hardcoded list")
            return self._load_default_predefined_names(), {}
    
        
    async def research_public_figure(self, name):
        """
        Research a public figure to find comprehensive information.
        This enhanced version first checks our CSV data to pre-fill known information.
        
        Args:
            name (str): Name of the public figure to research
            
        Returns:
            dict: Dictionary with public figure information
        """
        print(f"Researching details for predefined public figure: {name}")
        
        # Initialize with data we might already have from the CSV
        initial_data = {}
        
        if name in self.celebrity_data:
            # Pre-fill with data from our CSV
            csv_data = self.celebrity_data[name]
            print(f"Using pre-existing CSV data for {name}: {csv_data}")
            
            # Convert CSV data to fields for our database
            occupation_str = csv_data.get('occupation', '')
            if occupation_str:
                # Split by commas or similar if it's a list in string format
                occupations = [o.strip() for o in occupation_str.split(',')]
                initial_data['occupation'] = occupations
            
            # Determine if it's a group based on the 'type' field
            type_str = csv_data.get('type', '').lower()
            if type_str:
                is_group = 'group' in type_str
                initial_data['is_group'] = is_group
                if is_group:
                    initial_data['gender'] = 'Group'
            
            # Set nationality if available
            nationality = csv_data.get('nationality', '')
            if nationality:
                initial_data['nationality'] = nationality
            
            print(f"Pre-filled data for {name}: {json.dumps(initial_data, indent=2)}")
        
        # Call the original research method from the parent class
        # We use super() to access the parent class method
        research_results = await super().research_public_figure(name)
        
        # Combine our pre-filled data with research results
        # Pre-filled data takes precedence in case of conflicts
        combined_data = {**research_results, **initial_data}
        
        return combined_data
            
            
    def _normalize_date_format(self, date_str):
        """Normalize different date formats to YYYY-MM-DD, YYYY-MM, or YYYY"""
        if not date_str:
            return ""
                
        # Check if it's already a valid date format
        if re.match(r'^\d{4}(-\d{2}){0,2}$', date_str):
            return date_str
                
        print("Normalizing date format: '{0}'".format(date_str))
            
        # Try to extract year and possible month and day
        date_match = re.search(r'(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?', date_str)
        if date_match:
            year = date_match.group(1)
            month = date_match.group(2)
            day = date_match.group(3)
                
            if year and month and day:
                return "{0}-{1:02d}-{2:02d}".format(year, int(month), int(day))
            elif year and month:
                return "{0}-{1:02d}".format(year, int(month))
            else:
                return year
                    
        # Try to handle other date formats like "Month Day, Year"
        month_names = ["january", "february", "march", "april", "may", "june", 
                    "july", "august", "september", "october", "november", "december"]
        
        # Key fix: Avoid mixing f-string with regex patterns
        # Construct the regex pattern without using f-string
        month_pattern_str = "|".join(month_names)
        date_pattern = r'(?i)((?:' + month_pattern_str + r')\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})'
        date_match = re.search(date_pattern, date_str)
        
        if date_match:
            try:
                from datetime import datetime
                date_str = date_match.group(1)
                # Remove ordinal suffixes
                date_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str)
                parsed_date = datetime.strptime(date_str, "%B %d, %Y")
                return parsed_date.strftime("%Y-%m-%d")
            except Exception as e:
                print("Error parsing date string: {0}".format(e))
                return ""
                    
        # If we got here, couldn't parse the date
        print("Could not extract valid date from '{0}'".format(date_str))
        return ""
    
    
    async def generate_public_figure_focused_summary_with_date(self, title, description, public_figure_name, article_date=""):
        """Generate a summary of an article focused on a specific public figure and extract any content dates with event descriptions"""
        try:
            # Create a prompt for generating the summary and extracting dates with event content
            prompt = f"""
            Generate a concise summary of the following article that focuses specifically on {public_figure_name}.
            Also identify any specific dates mentioned in the context of {public_figure_name}'s activities and what events are happening on those dates.

            Article Title: {title}
            Article Content: {description}
            Article Publication Date: {article_date}

            Instructions:
            1. Focus only on information related to {public_figure_name}
            2. Include key events, achievements, announcements, or news involving {public_figure_name}
            3. If the article only mentions {public_figure_name} briefly, provide a short summary of that mention
            4. Keep the summary between 2-4 sentences
            5. If {public_figure_name} is barely mentioned or only in passing without significant context, state that briefly
            6. Do not include information about other public figures unless it directly relates to {public_figure_name}
            7. IMPORTANT: Include any specific dates in the summary naturally, and also extract them separately along with the event for each date
            - Extract ALL dates mentioned in relation to {public_figure_name}
            - Format individual dates as YYYY-MM-DD when full date is given
            - Format individual dates as YYYY-MM when only month and year are given
            - Format individual dates as YYYY when only the year is given
            - Handle date ranges by including both start and end dates
            - For each date, create a detailed event description that includes:
            * The primary action or event that occurred (1 sentence)
            * The significance or impact of this event in context of {public_figure_name}'s career/story (1 sentence)
            * Any relevant reactions, consequences, or follow-up developments mentioned in the article (1 sentence)
            - If multiple separate dates are mentioned, include all of them with their respective events
            - If no specific date is mentioned, return an empty array

            Return your response in this JSON format:
            {{
            "summary": "Your 2-4 sentence summary focused on {public_figure_name}, including any dates naturally in the text. This summary should capture the overall significance of the article's content as it relates to {public_figure_name}.",
            "events": [
                {{
                "date": "YYYY-MM-DD", 
                "event": "Comprehensive description of what happened on this date, including the action, significance, and any aftermath mentioned in the article"
                }},
                ...
            ]
            }}
            """
            
            # Call DeepSeek API
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates concise, focused summaries and extracts specific dates with event descriptions from content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=600  # Increased token limit to accommodate JSON response with events
            )
            
            # Extract the summary and dates from response
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
                summary = data.get("summary", "")
                events = data.get("events", [])
                
                # Clean up the summary - remove any quotes or other formatting
                summary = re.sub(r'^["\'`]|["\'`]$', '', summary)
                
                # Extract dates for backwards compatibility with existing code
                content_dates = []
                event_contents = {}  # Map dates to event descriptions
                
                for event_item in events:
                    date_str = event_item.get("date", "")
                    event_desc = event_item.get("event", "")
                    
                    # Process the date to ensure proper formatting
                    processed_date = self._normalize_date_format(date_str)
                    if processed_date:
                        content_dates.append(processed_date)
                        event_contents[processed_date] = event_desc
                
                # Return both the dates array (for backwards compatibility) and the events details
                return {
                    "summary": summary, 
                    "content_date": content_dates,
                    "event_contents": event_contents
                }
                
            except json.JSONDecodeError as e:
                print(f"Error parsing JSON response: {e}")
                print(f"Raw response: {result}")
                # Fall back to just returning the text as summary without date or events
                return {"summary": result.strip(), "content_date": [], "event_contents": {}}
                
        except Exception as e:
            print(f"Error generating public figure-focused summary with date and events for {public_figure_name}: {e}")
            return {"summary": "", "content_date": [], "event_contents": {}}
        
        
    async def _find_mentioned_figures(self, text):
        """
        Check if any predefined public figures are meaningfully mentioned in the given text.
        Uses AI to handle variations in naming and ensure meaningful mentions.
        
        Args:
            text (str): The article text to check
            
        Returns:
            list: Names of predefined public figures found in the text
        """
        if not text or not isinstance(text, str):
            print("Empty or invalid text provided to _find_mentioned_figures")
            return []
            
        try:
            # Create chunks if text is very long to avoid token limits
            max_text_length = 8000  # Adjust based on model's token limit
            text_to_check = text[:max_text_length] if len(text) > max_text_length else text
            
            # Group names into chunks to avoid exceeding prompt token limits
            # Using chunks of 50 names at a time
            name_chunks = [self.predefined_names[i:i+50] for i in range(0, len(self.predefined_names), 50)]
            all_mentioned_figures = set()
            
            for chunk_index, name_chunk in enumerate(name_chunks):
                # Create a prompt for DeepSeek
                prompt = f"""
                Given the following list of public figure names and the article text below,
                identify which of these public figures are meaningfully mentioned in the article.
                
                Only include figures who are actually discussed or referenced in the article content,
                not just mentioned in passing or in metadata. Consider different ways they might be referred to
                (full name, partial name, stage name, etc.)
                
                Public Figure Names (Chunk {chunk_index+1}/{len(name_chunks)}):
                {", ".join(name_chunk)}
                
                Article Text:
                {text_to_check}
                
                Return ONLY a JSON array of strings with the names of public figures who are meaningfully mentioned
                in the article, using the exact spelling from the provided list. Return an empty array if none are mentioned.
                
                Example response format: ["BTS", "IU"]
                """
                
                # Call DeepSeek API
                response = self.news_manager.client.chat.completions.create(
                    model=self.news_manager.model,
                    messages=[
                        {"role": "system", "content": "You are a precise assistant that identifies when specific named entities are mentioned in text."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.2,
                    max_tokens=400  # Limit tokens for efficiency
                )
                
                # Extract and parse the response
                result = response.choices[0].message.content.strip()
                
                # Extract JSON array from the response
                json_match = re.search(r"\[.*\]", result, re.DOTALL)
                if json_match:
                    result = json_match.group(0)
                    
                # Clean up code blocks if present
                if result.startswith("```json"):
                    result = result[7:-3].strip()
                elif result.startswith("```"):
                    result = result[3:-3].strip()
                    
                # Parse the JSON array
                try:
                    chunk_mentioned_figures = json.loads(result)
                    
                    # Validate results - ensure we only have strings and they match our predefined names
                    if isinstance(chunk_mentioned_figures, list):
                        valid_names_set = set(name_chunk)
                        for name in chunk_mentioned_figures:
                            if isinstance(name, str) and name in valid_names_set:
                                all_mentioned_figures.add(name)
                            else:
                                print(f"Warning: Invalid name returned: {name}")
                                
                        print(f"Found {len(chunk_mentioned_figures)} mentions in chunk {chunk_index+1}")
                    else:
                        print(f"Warning: Expected list but got {type(chunk_mentioned_figures)} for chunk {chunk_index+1}")
                
                except json.JSONDecodeError as e:
                    print(f"Error parsing JSON response for chunk {chunk_index+1}: {e}")
                    print(f"Raw response: {result}")
            
            # Convert set back to list for final result
            mentioned_figures = list(all_mentioned_figures)
            
            if mentioned_figures:
                print(f"Found {len(mentioned_figures)} predefined public figures mentioned: {', '.join(mentioned_figures)}")
            else:
                print("No predefined public figures found in the text")
                
            return mentioned_figures
            
        except Exception as e:
            print(f"Error finding mentioned figures: {e}")
            return []
        
        
    async def extract_for_predefined_figures(self, limit=None, reverse_order=True, start_after_doc_id=None):
        """
        Process articles to find mentions of predefined public figures.
        1. Fetch articles directly with options for ordering and limiting
        2. For each article, check if it mentions any predefined public figures
        3. For matches, create/update public figure info documents
        4. Create public figure-focused article summaries
        
        Args:
            limit (int, optional): Maximum number of articles to process. None means process all.
            reverse_order (bool): If True, process articles in reverse alphabetical order.
        """
        try:
            # Log the predefined public figures we're searching for
            print(f"Looking for mentions of {len(self.predefined_names)} predefined public figures in articles")
            print(f"First 10 names: {', '.join(self.predefined_names[:10])}...")
            
            # Step 1: Fetch articles with ordering and limiting options (similar to original)
            print("Fetching articles...")
            
            # Start with the base query
            query = self.news_manager.db.collection("newsArticles")
            
            # Apply ordering
            if reverse_order:
                query = query.order_by("__name__", direction=firestore.Query.DESCENDING)
            else:
                query = query.order_by("__name__", direction=firestore.Query.ASCENDING)
                
            # If we have a document ID to start after, get a reference to it and modify the query
            if start_after_doc_id:
                print(f"Starting processing after document ID: {start_after_doc_id}")
                start_doc_ref = self.news_manager.db.collection("newsArticles").document(start_after_doc_id)
                start_doc = start_doc_ref.get()
            
                if start_doc.exists:
                    query = query.start_after(start_doc)
                else:
                    print(f"Warning: Start document {start_after_doc_id} does not exist. Starting from the beginning.")
            
            # Apply limit if specified
            if limit is not None:
                query = query.limit(limit)
                print(f"Limited to processing {limit} articles")
            
            # Execute the query
            articles_ref = query.stream()
            articles = []

            # Convert to list so we can count and iterate
            for doc in articles_ref:
                articles.append({"id": doc.id, "data": doc.to_dict()})

            count = len(articles)
            print(f"Found {count} articles to process")

            if count == 0:
                print("No articles found")
                return

            # Log the first few article IDs to confirm ordering
            preview_count = min(5, count)
            preview_ids = [article["id"] for article in articles[:preview_count]]
            print(f"First {preview_count} articles to be processed (in this order): {preview_ids}")

            # Track stats
            stats = {
                "articles_processed": 0,
                "articles_with_figures": 0,
                "figure_mentions": 0,
                "figures_researched": 0,
                "summaries_created": 0
            }

            # Step 2: Process each article to find mentions of predefined public figures
            for i, article in enumerate(articles):
                article_id = article["id"]
                body = article["data"].get("body", "")
                
                # Handle title and subtitle (fixing the switched fields as in original)
                title = article["data"].get("subTitle", "")
                subtitle = article["data"].get("title", "")
                
                # Get other article fields for the article-summaries collection
                link = article["data"].get("link", "")
                
                # Handle imageUrl (could be a string or an array)
                image_url = article["data"].get("imageUrl", "")
                if isinstance(image_url, list) and len(image_url) > 0:
                    first_image_url = image_url[0]
                else:
                    first_image_url = image_url
                
                # Get article publication date if available
                send_date = article["data"].get("sendDate", "")
                article_date = ""
                if send_date and isinstance(send_date, str) and len(send_date) == 8:
                    # Convert YYYYMMDD to YYYY-MM-DD
                    article_date = f"{send_date[:4]}-{send_date[4:6]}-{send_date[6:8]}"

                print(f"Processing article {i+1}/{count} (ID: {article_id})")
                stats["articles_processed"] += 1

                if not body:
                    print(f"Skipping article {article_id} - No body content available")
                    continue

                # Find which predefined public figures are mentioned in this article
                mentioned_figures = await self._find_mentioned_figures(body)
                
                if not mentioned_figures:
                    print(f"No predefined public figures found in article {article_id}")
                    continue
                
                print(f"Found {len(mentioned_figures)} public figures in article {article_id}: {mentioned_figures}")
                stats["articles_with_figures"] += 1
                stats["figure_mentions"] += len(mentioned_figures)
                
                # Update the article document with public figure names
                self.news_manager.db.collection("newsArticles").document(article_id).update(
                    {"public_figures": mentioned_figures}
                )
                print(f"Updated article {article_id} with public figures: {mentioned_figures}")

                # Process each mentioned public figure
                for public_figure_name in mentioned_figures:
                    print(f"\nProcessing public figure: {public_figure_name}")
                    
                    # Create document ID (lowercase, no spaces)
                    doc_id = public_figure_name.lower().replace(" ", "").replace("-", "").replace(".", "")
                    
                    # Check if the public figure document already exists
                    public_figure_doc_ref = self.news_manager.db.collection("selected-figures").document(doc_id)
                    public_figure_doc = public_figure_doc_ref.get()
                    public_figure_exists = public_figure_doc.exists
                    
                    if public_figure_exists:
                        print(f"Public figure {public_figure_name} already exists in database")
                        # Get existing data
                        existing_data = public_figure_doc.to_dict()
                        # Get existing sources or initialize empty array
                        existing_sources = existing_data.get("sources", [])
                        
                        # Only add the source if it's not already in the list
                        if article_id not in existing_sources:
                            existing_sources.append(article_id)
                            # Update only the sources field
                            public_figure_doc_ref.update({"sources": existing_sources})
                            print(f"Updated sources for {public_figure_name}, added article ID: {article_id}")
                        else:
                            print(f"Article {article_id} already in sources for {public_figure_name}, skipping update")
                        
                        # Check if we need to update lastUpdated field
                        should_update_timestamp = False
                        current_date_kr = datetime.now(pytz.timezone('Asia/Seoul')).strftime("%Y-%m-%d")
                        
                        # If lastUpdated field doesn't exist or is older than today (in KR timezone)
                        if "lastUpdated" not in existing_data or existing_data.get("lastUpdated", "") != current_date_kr:
                            public_figure_doc_ref.update({"lastUpdated": current_date_kr})
                            print(f"Updated lastUpdated timestamp for {public_figure_name}")
                        
                        # Check if we should enrich missing fields (similar to original)
                        # missing_fields = []
                        # essential_fields = ["birthDate", "chineseZodiac", "company", "debutDate", "group", 
                        #                     "instagramUrl", "profilePic", "school", "spotifyUrl", "youtubeUrl", 
                        #                     "zodiacSign", "gender", "occupation", "nationality"]
                        
                        # for field in essential_fields:
                        #     if field not in existing_data or (
                        #         (isinstance(existing_data.get(field), str) and not existing_data.get(field)) or
                        #         (isinstance(existing_data.get(field), list) and not existing_data.get(field))
                        #     ):
                        #         missing_fields.append(field)
                        
                        # For groups, check if members have complete information
                        # is_group = existing_data.get("is_group", False)
                        # members_need_update = False
                        
                        # if is_group and "members" in existing_data and isinstance(existing_data["members"], list):
                        #     for member in existing_data["members"]:
                        #         for member_field in ["birthDate", "chineseZodiac", "instagramUrl", "profilePic", 
                        #                             "school", "spotifyUrl", "youtubeUrl", "zodiacSign"]:
                        #             if member_field not in member or (
                        #                 (isinstance(member.get(member_field), str) and not member.get(member_field)) or
                        #                 (isinstance(member.get(member_field), list) and not member.get(member_field))
                        #             ):
                        #                 members_need_update = True
                        #                 break
                                
                        #         if members_need_update:
                        #             break
                        
                        # Only perform research if essential data is missing
                        # if missing_fields or members_need_update:
                        #     print(f"Public figure {public_figure_name} has missing information: {missing_fields}")
                        #     print(f"Members need update: {members_need_update}")
                        #     print(f"Researching more info for {public_figure_name} to fill in missing data...")
                            
                        #     # Research to get missing information
                        #     additional_info = await self.research_public_figure(public_figure_name)
                        #     print(f"Research results for {public_figure_name}: {json.dumps(additional_info, indent=2)}")
                        #     stats["figures_researched"] += 1
                            
                        #     # Prepare the update data
                        #     update_data = {}
                            
                        #     # Add any missing fields we found to update_data
                        #     for field in missing_fields:
                        #         if field in additional_info and additional_info[field]:
                        #             update_data[field] = additional_info[field]
                        #             print(f"Adding missing field {field}: {additional_info[field]}")
                            
                        #     # If it's a group and members need update (same as original)
                        #     if is_group and members_need_update and "members" in additional_info:
                        #         # Code for updating members (same as original)
                        #         existing_members = existing_data.get("members", [])
                        #         researched_members = additional_info.get("members", [])
                        #         researched_members_dict = {member.get("name", ""): member for member in researched_members}
                                
                        #         for i, member in enumerate(existing_members):
                        #             member_name = member.get("name", "")
                        #             if member_name and member_name in researched_members_dict:
                        #                 researched_member = researched_members_dict[member_name]
                                        
                        #                 for member_field in ["birthDate", "chineseZodiac", "instagramUrl", "profilePic", 
                        #                                     "school", "spotifyUrl", "youtubeUrl", "zodiacSign"]:
                        #                     if (member_field not in member or not member.get(member_field)) and \
                        #                     member_field in researched_member and researched_member[member_field]:
                        #                         existing_members[i][member_field] = researched_member[member_field]
                        #                         print(f"Updated {member_field} for member {member_name}")
                                
                        #         update_data["members"] = existing_members
                            
                        #     # Only update if we have data to update
                        #     if update_data:
                        #         public_figure_doc_ref.update(update_data)
                        #         print(f"Updated public figure {public_figure_name} with missing information")
                        #     else:
                        #         print(f"No new information found for {public_figure_name}, skipping update")
                        
                        # else:
                        #     print(f"Public figure {public_figure_name} has complete information, no update needed")
                    
                    else:
                        # This is a new public figure - not in database yet
                        print(f"Creating new public figure entry for {public_figure_name}")
                        
                        # Research comprehensive information
                        print(f"Researching info for new public figure {public_figure_name}...")
                        public_figure_info = await self.research_public_figure(public_figure_name)
                        print(f"Research results for {public_figure_name}: {json.dumps(public_figure_info, indent=2)}")
                        stats["figures_researched"] += 1
                        
                        # Get basic info
                        gender = public_figure_info.get("gender", "")
                        occupation = public_figure_info.get("occupation", [])
                        is_group = public_figure_info.get("is_group", False)
                        nationality = public_figure_info.get("nationality", "")
                        
                        # Create a new clean public figure data object
                        public_figure_data = {
                            "name": public_figure_name,
                            "gender": gender,
                            "occupation": occupation,
                            "is_group": is_group,
                            "nationality": nationality,
                            "sources": [article_id],  # Initialize sources array with current article ID
                            "birthDate": "",
                            "chineseZodiac": "",
                            "company": "",
                            "debutDate": "",
                            "group": "",
                            "instagramUrl": "",
                            "profilePic": "",
                            "school": [],
                            "spotifyUrl": "",
                            "youtubeUrl": "",
                            "zodiacSign": "",
                            "lastUpdated": datetime.now(pytz.timezone('Asia/Seoul')).strftime("%Y-%m-%d")
                        }
                        
                        # Update with research results
                        for field in ["birthDate", "chineseZodiac", "company", "debutDate", "group", 
                                    "instagramUrl", "profilePic", "school", "spotifyUrl", "youtubeUrl", 
                                    "zodiacSign"]:
                            if field in public_figure_info and public_figure_info[field]:
                                public_figure_data[field] = public_figure_info[field]
                        
                        # Handle Korean name
                        is_korean = False
                        if nationality:
                            is_korean = "korean" in nationality.lower() or "south korea" in nationality.lower()
                            
                        if is_korean and public_figure_info.get("name_kr"):
                            name_kr = public_figure_info.get("name_kr", "")
                            if name_kr and isinstance(name_kr, str) and len(name_kr.strip()) > 0:
                                public_figure_data["name_kr"] = name_kr
                        
                        # Add members if this is a group
                        if is_group and "members" in public_figure_info and isinstance(public_figure_info["members"], list):
                            public_figure_data["members"] = public_figure_info["members"]
                        
                        # Create the document
                        public_figure_doc_ref.set(public_figure_data)
                        print(f"Created new public-figure-info for {public_figure_name}")

                    # Generate and save article summary for this public figure
                    summary_doc_ref = self.news_manager.db.collection("selected-figures").document(doc_id).collection("article-summaries").document(article_id)
                    summary_doc = summary_doc_ref.get()
                    
                    if summary_doc.exists:
                        print(f"Summary for {public_figure_name} in article {article_id} already exists, skipping...")
                        continue
                    
                    # Generate a summary focused on this public figure
                    print(f"Generating summary for article {article_id} focused on {public_figure_name}")
                    
                    # Extract dates and summary with event content
                    summary_results = await self.generate_public_figure_focused_summary_with_date(
                        title=title,
                        description=body,
                        public_figure_name=public_figure_name,
                        article_date=article_date
                    )
                    
                    summary = summary_results.get("summary", "")
                    event_date = summary_results.get("content_date", "")
                    event_contents = summary_results.get("event_contents", {})
                    
                    if not summary:
                        print(f"Failed to generate summary for {public_figure_name} in article {article_id}")
                        continue
                    
                    # Create a new summary document with ALL required fields
                    summary_data = {
                        "article_id": article_id,
                        "public_figure": public_figure_name,
                        "summary": summary,
                        "created_at": firestore.SERVER_TIMESTAMP,
                        "title": title,
                        "subtitle": subtitle,
                        "link": link,
                        "body": body,
                        "source": "Yonhap News Agency",  # Always set to "Yonhap News Agency"
                        "imageUrl": first_image_url  # First image URL or single string value
                    }
                    
                    # Add event_date as a separate field if available
                    if event_date:
                        summary_data["event_dates"] = event_date
                        print(f"Adding event dates '{event_date}' to summary for {public_figure_name}")
                    
                    # Add event_contents as a separate field if available
                    if event_contents:
                        summary_data["event_contents"] = event_contents
                        print(f"Adding event contents for {len(event_contents)} dates to summary for {public_figure_name}")
                    
                    summary_doc_ref.set(summary_data)
                    print(f"Saved new summary for {public_figure_name} in article {article_id}")
                    stats["summaries_created"] += 1

            # Print final statistics
            print("\n=== Processing Statistics ===")
            print(f"Total articles processed: {stats['articles_processed']}")
            print(f"Articles with predefined figures: {stats['articles_with_figures']}")
            print(f"Total public figure mentions: {stats['figure_mentions']}")
            print(f"Public figures researched: {stats['figures_researched']}")
            print(f"Article summaries created: {stats['summaries_created']}")
            print("===========================\n")

            print("Predefined public figure extraction and summary generation completed successfully!")

        except Exception as e:
            print(f"Error in extract_for_predefined_figures: {e}")
            raise
        finally:
            # Close the connection
            await self.news_manager.close()
           
                    
# Main function
async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Predefined Public Figure Information Extractor')
    parser.add_argument('--limit', type=int, default=None,
                        help='Number of articles to process (default: all)')
    parser.add_argument('--reverse', action='store_true', default=True,
                        help='Process in reverse alphabetical order (default: True)')
    parser.add_argument('--names-file', type=str, default=None,
                        help='Path to a text file containing public figure names (one per line)')
    parser.add_argument('--csv-file', type=str, default="k_celebrities_master.csv",
                        help='Path to CSV file with public figure data (default: k_celebrities_master.csv)')
    parser.add_argument('--start-doc', type=str, default=None,
                        help='Document ID to start processing after')
    
    args = parser.parse_args()
    
    # Load custom names from text file if provided (this overrides CSV)
    predefined_names = []
    if args.names_file:
        try:
            with open(args.names_file, 'r') as f:
                predefined_names = [line.strip() for line in f if line.strip()]
            print(f"Loaded {len(predefined_names)} public figure names from file: {args.names_file}")
        except Exception as e:
            print(f"Error loading names from file: {e}")
    
    # Create extractor with either custom names or using the CSV
    extractor = PredefinedPublicFigureExtractor(
        predefined_names=predefined_names,
        csv_filepath=args.csv_file
    )
    
    print("\n=== Predefined Public Figure Information Extraction Starting ===\n")
    await extractor.extract_for_predefined_figures(limit=args.limit, reverse_order=args.reverse, start_after_doc_id=args.start_doc)
    print("\n=== Predefined Public Figure Information Extraction Complete ===\n")


# Run the script when executed directly
if __name__ == "__main__":
    asyncio.run(main())