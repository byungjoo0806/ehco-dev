from setup_firebase_deepseek import NewsManager
import asyncio
import json
import re
import firebase_admin
from firebase_admin import firestore


class NewArticleProcessor:
    def __init__(self):
        self.news_manager = NewsManager()

    async def process_new_articles(self):
        """
        Process only new articles that haven't been examined yet by:
        1. Fetching only unprocessed articles (where processed_for_figures is missing or false)
        2. Extract public figures with information using DeepSeek from each article's description
        3. Update articles with public figure names and mark as processed
        4. Create public-figure-info documents with additional information and source references
        5. Generate and save public figure-focused article summaries with dates when mentioned
        """
        try:
            # Step 1: Fetch only unprocessed articles
            print("Fetching unprocessed articles...")
            # Query for articles where processed_for_figures is false or the field doesn't exist
            articles_ref = self.news_manager.db.collection("newsArticles")
            
            # First query for articles where the field is false
            false_query = articles_ref.where("processed_for_figures", "==", False).stream()
            articles_false = [{"id": doc.id, "data": doc.to_dict()} for doc in false_query]
            
            # Now query for articles where the field doesn't exist
            # We need to use a different approach as Firestore doesn't support direct "field doesn't exist" queries
            all_articles = articles_ref.stream()
            articles_missing_field = []
            for doc in all_articles:
                data = doc.to_dict()
                if "processed_for_figures" not in data:
                    articles_missing_field.append({"id": doc.id, "data": data})
            
            # Combine both result sets
            articles = articles_false + articles_missing_field
            
            count = len(articles)
            print(f"Found {count} unprocessed articles to process")

            if count == 0:
                print("No new articles found to process")
                return

            # Step 2: Process each article to extract public figures with information
            for i, article in enumerate(articles):
                article_id = article["id"]
                description = article["data"].get("body")
                
                # Handle title and subtitle (fixing the switched fields)
                title = article["data"].get("subTitle", "")
                subtitle = article["data"].get("title", "")
                
                # Get other article fields for the article-summaries collection
                link = article["data"].get("link", "")
                body = article["data"].get("body", "")
                
                # Handle imageUrl (could be a string or an array)
                image_url = article["data"].get("imageUrl", "")
                if isinstance(image_url, list) and len(image_url) > 0:
                    # If it's an array, get the first item
                    first_image_url = image_url[0]
                else:
                    # If it's a string or empty, use as is
                    first_image_url = image_url
                
                # Get article publication date if available
                article_date = article["data"].get("publishedAt", "")

                print(f"Processing article {i+1}/{count} (ID: {article_id})")

                if not description:
                    print(f"Skipping article {article_id} - No description available")
                    # Mark as processed even if we skip it
                    self.news_manager.db.collection("newsArticles").document(article_id).update({
                        "processed_for_figures": True
                    })
                    continue

                # Extract public figures with additional information using DeepSeek
                public_figures_info = await self.extract_public_figures_from_text(description)

                if not public_figures_info:
                    print(f"No public figures found in article {article_id}")
                    # Mark as processed even if no figures found
                    self.news_manager.db.collection("newsArticles").document(article_id).update({
                        "processed_for_figures": True
                    })
                    continue
                    
                print(f"Extracted raw public figure data: {json.dumps(public_figures_info, indent=2)}")

                # Get just the names for the article document
                public_figure_names = [info.get("name") for info in public_figures_info if info.get("name")]
                
                print(f"Found public figures: {public_figure_names}")

                # Step 3: Update the article document with public figure names and mark as processed
                self.news_manager.db.collection("newsArticles").document(article_id).update({
                    "public_figures": public_figure_names,
                    "processed_for_figures": True  # Mark as processed
                })
                print(f"Updated article {article_id} with public figures: {public_figure_names} and marked as processed")

                # Step 4: Create or update public-figure-info documents with details
                for public_figure_info in public_figures_info:
                    # Start with a completely fresh public figure data object for each person
                    name = public_figure_info.get("name")
                    if not name:
                        print("Public figure without a name found, skipping...")
                        continue
                        
                    print(f"\nProcessing public figure: {name}")
                        
                    # Create document ID (lowercase, no spaces)
                    doc_id = name.lower().replace(" ", "").replace("-", "").replace(".", "")
                    
                    # Check if the public figure document already exists
                    public_figure_doc_ref = self.news_manager.db.collection("public-figure-info").document(doc_id)
                    public_figure_doc = public_figure_doc_ref.get()
                    public_figure_exists = public_figure_doc.exists
                    
                    if public_figure_exists:
                        print(f"Public figure {name} already exists in database, updating sources")
                        # Get existing data
                        existing_data = public_figure_doc.to_dict()
                        # Get existing sources or initialize empty array
                        existing_sources = existing_data.get("sources", [])
                        
                        # Only add the source if it's not already in the list
                        if article_id not in existing_sources:
                            existing_sources.append(article_id)
                            # Update only the sources field
                            public_figure_doc_ref.update({"sources": existing_sources})
                            print(f"Updated sources for {name}, added article ID: {article_id}")
                        else:
                            print(f"Article {article_id} already in sources for {name}, skipping update")
                    else:
                        # If we reach here, this is a new public figure
                        # Check if gender and occupation are available
                        gender = public_figure_info.get("gender", "")
                        occupation = public_figure_info.get("occupation", [])
                        is_group = public_figure_info.get("is_group", False)
                        members = []
                        
                        # Reset all fields for this public figure - extremely important to prevent data carryover
                        name_kr = ""
                        nationality = ""
                        # Create a new clean public figure data object with sources field
                        public_figure_data = {
                            "name": name,
                            "gender": gender,
                            "occupation": occupation,
                            "is_group": is_group,
                            "sources": [article_id]  # Initialize sources array with current article ID
                        }
                        
                        # Research if information is missing or if it's a group (to get members)
                        # Ensure we get accurate information for each public figure
                        print(f"Researching more info for {name}...")
                        additional_info = await self.research_public_figure(name)
                        print(f"Research results for {name}: {json.dumps(additional_info, indent=2)}")  # Log research results
                        
                        # Update public figure data with research results
                        if additional_info.get("gender"):
                            public_figure_data["gender"] = additional_info["gender"]
                            gender = additional_info["gender"]
                        
                        if additional_info.get("occupation"):
                            public_figure_data["occupation"] = additional_info["occupation"]
                            occupation = additional_info["occupation"]
                            
                        # Check if it's a group
                        if additional_info.get("is_group", False):
                            is_group = True
                            public_figure_data["is_group"] = True
                            # Make sure we mark it as a group in our database
                            if gender != "Group":
                                gender = "Group"
                                public_figure_data["gender"] = "Group"
                                
                        # Get nationality - only from research results for consistency
                        if additional_info.get("nationality"):
                            nationality = additional_info["nationality"]
                            public_figure_data["nationality"] = nationality
                            
                        # Get members if available in the research results - only for groups
                        if is_group and "members" in additional_info and isinstance(additional_info["members"], list):
                            members = additional_info["members"]
                            print(f"Found {len(members)} members for group {name}")
                        
                        # Add members if this is a group and we have member data
                        if is_group and members:
                            # Make sure to include both stage names and real names for all members
                            processed_members = []
                            for member in members:
                                # Check if this member object has all required fields
                                member_data = {
                                    "name": member.get("name", "")  # Stage name or most commonly known name
                                }
                                
                                # Add real name if available
                                if "real_name" in member:
                                    member_data["real_name"] = member["real_name"]
                                    
                                # Add gender
                                if "gender" in member:
                                    member_data["gender"] = member["gender"]
                                    
                                # Only add Korean name if member is Korean
                                if "name_kr" in member and member["name_kr"]:
                                    member_data["name_kr"] = member["name_kr"]
                                    
                                processed_members.append(member_data)
                                
                            public_figure_data["members"] = processed_members
                        
                        # Handle Korean name only for Korean figures (using research results as primary source)
                        is_korean = False
                        if nationality:
                            is_korean = "korean" in nationality.lower() or "south korea" in nationality.lower()
                            
                        # Check for Korean name in research results
                        if is_korean and additional_info.get("name_kr"):
                            name_kr = additional_info.get("name_kr", "")
                            if name_kr and isinstance(name_kr, str) and len(name_kr.strip()) > 0:
                                print(f"Adding Korean name for {name}: {name_kr}")
                                public_figure_data["name_kr"] = name_kr
                        elif is_korean:
                            print(f"Public figure {name} is Korean but no Korean name was found")
                        else:
                            print(f"Public figure {name} is not Korean, not adding Korean name")

                        # Log the final data before saving
                        print(f"Final data for {name}: {json.dumps(public_figure_data, indent=2)}")
                        
                        # Create the document - this is a new public figure so use set() without merge
                        public_figure_doc_ref.set(public_figure_data)
                        print(f"Created public-figure-info for {name} with source: {article_id}")
                        if is_group and members:
                            print(f"Saved {len(members)} members for group {name}")

                # Step 5: Generate and save public figure-focused article summaries
                # We'll generate a summary for each public figure found in this article
                if public_figure_names:
                    for public_figure_name in public_figure_names:
                        # Create document ID for the public figure (lowercase, no spaces)
                        public_figure_doc_id = public_figure_name.lower().replace(" ", "").replace("-", "").replace(".", "")
                        
                        # Check if this public figure-article summary already exists
                        summary_doc_ref = self.news_manager.db.collection("public-figure-info").document(public_figure_doc_id).collection("article-summaries").document(article_id)
                        summary_doc = summary_doc_ref.get()
                        
                        if summary_doc.exists:
                            print(f"Summary for {public_figure_name} in article {article_id} already exists, skipping...")
                            continue
                        
                        # Generate a summary focused on this public figure only if it doesn't exist
                        print(f"Generating summary for article {article_id} focused on {public_figure_name}")
                        
                        # Extract dates and summary together
                        summary_results = await self.generate_public_figure_focused_summary_with_date(
                            title=title,
                            description=description,
                            public_figure_name=public_figure_name,
                            article_date=article_date
                        )
                        
                        summary = summary_results.get("summary", "")
                        event_date = summary_results.get("content_date", "")
                        
                        if not summary:
                            print(f"Failed to generate summary for {public_figure_name} in article {article_id}")
                            continue
                        
                        # Create a new summary document with ALL required fields
                        summary_data = {
                            "article_id": article_id,
                            "public_figure": public_figure_name,
                            "summary": summary,
                            "created_at": firestore.SERVER_TIMESTAMP,
                            # Add the new required fields
                            "title": title,
                            "subtitle": subtitle,
                            "link": link,
                            "body": body,
                            "source": "Yonhap News Agency",  # Always set to "Yonhap News Agency"
                            "imageUrl": first_image_url  # First image URL or single string value
                        }
                        
                        # Add event_date as a separate field if available
                        if event_date:
                            # Store as string in YYYY-MM-DD format
                            summary_data["event_dates"] = event_date
                            print(f"Adding event dates '{event_date}' to summary for {public_figure_name}")
                        
                        summary_doc_ref.set(summary_data)
                        print(f"Saved new summary for {public_figure_name} in article {article_id} with all required fields")

            print("New article processing completed successfully!")

        except Exception as e:
            print(f"Error in process_new_articles: {e}")
            raise
        finally:
            # Close the connection
            await self.news_manager.close()

    async def extract_public_figures_from_text(self, text):
        """Extract public figures with additional information from text"""
        try:
            # Enhanced prompt for DeepSeek
            prompt = f"""
            Extract all public figure names mentioned in the following text along with their gender and occupation.
            Public figures include politicians, business leaders, celebrities, athletes, activists, and other notable 
            individuals or groups in the public eye.
            
            Determine if each public figure is an individual person or a group (like a band, team, organization, etc.).
            
            Return a JSON array of objects with these properties for individuals:
            - name: The correctly capitalized full name
            - gender: "Male", "Female", or "" if unclear
            - occupation: Array of primary occupations (politician, actor, athlete, business leader, etc.)
            - is_group: false
            
            For groups, return objects with:
            - name: The correctly capitalized group name
            - gender: "Group"
            - occupation: Array of the group's primary occupations (band, sports team, political party, etc.)
            - is_group: true
            
            Only include real public figures (famous or notable people or groups). If no public figures are found, return an empty array.
            
            Text: {text}
            
            Output format: 
            [
              {{"name": "Public Figure Name 1", "gender": "Male", "occupation": ["Politician", "Lawyer"], "is_group": false}},
              {{"name": "Group Name", "gender": "Group", "occupation": ["Political Party"], "is_group": true}}
            ]
            """

            # Call DeepSeek API
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that extracts public figure information from text.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2
            )

            # Extract and parse the response
            result = response.choices[0].message.content.strip()
            
            # Try to find a JSON array in the response
            json_match = re.search(r"\[.*\]", result, re.DOTALL)
            if json_match:
                result = json_match.group(0)
                
            # Handle potential JSON formatting issues
            if result.startswith("```json"):
                result = result[7:-3].strip()
            elif result.startswith("```"):
                result = result[3:-3].strip()
                
            # Parse the JSON array
            public_figures_info = json.loads(result)
            
            # Validate the response structure
            if not isinstance(public_figures_info, list):
                print("Error: Response is not a list, returning empty array")
                public_figures_info = []
                
            # Remove any Korean names from the initial extraction
            # We'll get proper Korean names during the research phase
            for i, public_figure in enumerate(public_figures_info):
                if "name_kr" in public_figure:
                    print(f"Removing Korean name from initial extraction for {public_figure.get('name')}")
                    del public_figures_info[i]["name_kr"]
                
            return public_figures_info
            
        except Exception as e:
            print(f"Error extracting public figures from text: {e}")
            print(f"Text excerpt: {text[:100]}...")
            return []

    async def research_public_figure(self, name):
        """Research a public figure to find basic information when missing from context"""
        prompt = f"""
        Provide basic information about the public figure named "{name}".
        First determine if this is an individual person or a group (like a band, team, organization, etc.).
        
        If it's an individual person, return a JSON object with:
        - gender: "Male", "Female", or "" if unclear
        - occupation: Array of primary occupations (politician, business leader, actor, athlete, etc.)
        - nationality: Primary nationality, if known
        - name_kr: Korean name in Hangul characters (ONLY if this person is Korean, otherwise "")
        - is_group: false
        
        If it's a group, return a JSON object with:
        - gender: "Group"
        - occupation: Array of the group's primary occupations (political party, business organization, band, sports team, etc.)
        - nationality: Primary nationality of the group, if known
        - name_kr: Korean name in Hangul characters (ONLY if this group is Korean, otherwise "")
        - is_group: true
        - members: Array of objects containing basic info about each member with keys:
          - name: Member's official or most commonly known name
          - real_name: Member's full legal name if different from official name
          - gender: "Male", "Female", or "" if unclear
          - name_kr: Korean name in Hangul (ONLY if the member is Korean)
        
        Format for individual:
        {{"gender": "Male", "occupation": ["Politician", "Lawyer"], "nationality": "South Korean", "name_kr": "이재명", "is_group": false}}
        
        Format for non-Korean individual:
        {{"gender": "Female", "occupation": ["Politician", "Diplomat"], "nationality": "American", "name_kr": "", "is_group": false}}
        
        Format for group:
        {{"gender": "Group", "occupation": ["Political Party"], "nationality": "South Korean", "name_kr": "더불어민주당", "is_group": true, "members": [
          {{"name": "Lee Jae-myung", "real_name": "Lee Jae-myung", "gender": "Male", "name_kr": "이재명"}},
          {{"name": "Woo Won-shik", "real_name": "Woo Won-shik", "gender": "Male", "name_kr": "우원식"}},
          ...and so on for notable members
        ]}}
        
        CRITICAL INSTRUCTIONS:
        1. ONLY provide a Korean name (name_kr) if the person or group is actually Korean. For non-Korean public figures, name_kr MUST be an empty string.
        2. For individual public figures who are not Korean, leave name_kr as an empty string like in the non-Korean individual example.
        3. For group members, ALWAYS include their official name as "name" and their birth name as "real_name" if different.
        4. Make sure the data returned is specifically about "{name}" and not a different public figure or group.
        5. Be extremely careful to only include Korean names (name_kr) for Korean public figures, never for non-Korean public figures.
        """
        
        try:
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a knowledgeable assistant that provides accurate information about public figures."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            
            result = response.choices[0].message.content.strip()
            
            # Clean and parse JSON
            if result.startswith("```json"):
                result = result[7:-3].strip()
            elif result.startswith("```"):
                result = result[3:-3].strip()
                
            # Handle the case where JSON might be embedded in text
            json_match = re.search(r"\{.*\}", result, re.DOTALL)
            if json_match:
                result = json_match.group(0)
                
            # Parse the JSON
            data = json.loads(result)
            
            # Extra validation for Korean names
            is_korean = False
            if "nationality" in data:
                is_korean = "korean" in data["nationality"].lower() or "south korea" in data["nationality"].lower()
                
            # Ensure Korean name is only set for Korean public figures
            if not is_korean and "name_kr" in data:
                print(f"FIXING: Public figure {name} is not Korean but had Korean name. Removing.")
                data["name_kr"] = ""
                
            # For groups, ensure members have correct data format
            if data.get("is_group") and "members" in data and isinstance(data["members"], list):
                for i, member in enumerate(data["members"]):
                    # Check if this member is Korean
                    member_is_korean = True  # Assume group members share nationality with the group
                    if not is_korean:
                        # If group is not Korean, clear Korean names for all members
                        if "name_kr" in member:
                            print(f"FIXING: Member {member.get('name')} in non-Korean group had Korean name. Removing.")
                            data["members"][i]["name_kr"] = ""
            
            print(f"Validated data for {name}, is_korean={is_korean}")
            return data
            
        except Exception as e:
            print(f"Error researching public figure {name}: {e}")
            return {"gender": "", "occupation": [], "nationality": "", "name_kr": ""}

    def _normalize_date_format(self, date_str):
        """Normalize different date formats to YYYY-MM-DD, YYYY-MM, or YYYY"""
        if not date_str:
            return ""
            
        # Check if it's already a valid date format
        if re.match(r'^\d{4}(-\d{2}){0,2}$', date_str):
            return date_str
            
        print(f"Normalizing date format: '{date_str}'")
        
        # Try to extract year and possible month and day
        date_match = re.search(r'(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?', date_str)
        if date_match:
            year = date_match.group(1)
            month = date_match.group(2)
            day = date_match.group(3)
            
            if year and month and day:
                return f"{year}-{int(month):02d}-{int(day):02d}"
            elif year and month:
                return f"{year}-{int(month):02d}"
            else:
                return year
                
        # Try to handle other date formats like "Month Day, Year"
        month_names = ["january", "february", "march", "april", "may", "june", 
                      "july", "august", "september", "october", "november", "december"]
        month_pattern = "|".join(month_names)
        date_match = re.search(
            rf'(?i)((?:{month_pattern})\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}})', 
            date_str
        )
        if date_match:
            try:
                from datetime import datetime
                date_str = date_match.group(1)
                # Remove ordinal suffixes
                date_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str)
                parsed_date = datetime.strptime(date_str, "%B %d, %Y")
                return parsed_date.strftime("%Y-%m-%d")
            except Exception as e:
                print(f"Error parsing date string: {e}")
                return ""
                
        # If we got here, couldn't parse the date
        print(f"Could not extract valid date from '{date_str}'")
        return ""

    async def generate_public_figure_focused_summary_with_date(self, title, description, public_figure_name, article_date=""):
        """Generate a summary of an article focused on a specific public figure and extract any content dates"""
        try:
            # Create a prompt for generating the summary and extracting dates
            prompt = f"""
            Generate a concise summary of the following article that focuses specifically on {public_figure_name}.
            Also identify any specific dates mentioned in the context of {public_figure_name}'s activities.
            
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
            7. IMPORTANT: Include any specific dates in the summary naturally, and also extract them separately
               - Extract ALL dates mentioned in relation to {public_figure_name}
               - Format individual dates as YYYY-MM-DD when full date is given
               - Format individual dates as YYYY-MM when only month and year are given
               - Format individual dates as YYYY when only the year is given
               - Handle date ranges by including both start and end dates
               - If multiple separate dates are mentioned, include all of them
               - If no specific date is mentioned, return an empty array
            
            Return your response in this JSON format:
            {{
              "summary": "Your 2-4 sentence summary focused on {public_figure_name}, including any dates naturally in the text",
              "content_date": ["YYYY-MM-DD", "YYYY-MM", "YYYY"] or [] if no specific dates
            }}
            """
            
            # Call DeepSeek API
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that creates concise, focused summaries and extracts specific dates from content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=400  # Increase token limit to accommodate JSON response
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
                content_date = data.get("content_date", [])
                
                # Clean up the summary - remove any quotes or other formatting
                summary = re.sub(r'^["\'`]|["\'`]$', '', summary)
                
                # Process the dates array or convert single string to array
                if isinstance(content_date, str):
                    # LLM returned a string instead of array, convert it to an array with one element
                    if content_date.strip():
                        content_date = [content_date]
                    else:
                        content_date = []
                        
                # Process each date in the array to ensure proper formatting
                processed_dates = []
                
                for date_str in content_date:
                    # Handle date ranges (split by hyphen or 'to' or similar)
                    if ' - ' in date_str or ' to ' in date_str:
                        # Replace 'to' with hyphen for consistent processing
                        date_range = date_str.replace(' to ', ' - ')
                        start_date, end_date = date_range.split(' - ')
                        
                        # Process start and end dates separately and add both
                        processed_start = self._normalize_date_format(start_date.strip())
                        processed_end = self._normalize_date_format(end_date.strip())
                        
                        if processed_start:
                            processed_dates.append(processed_start)
                        if processed_end:
                            processed_dates.append(processed_end)
                    else:
                        # Process single date
                        processed_date = self._normalize_date_format(date_str)
                        if processed_date:
                            processed_dates.append(processed_date)
                
                return {"summary": summary, "content_date": processed_dates}
            
            except json.JSONDecodeError as e:
                print(f"Error parsing JSON response: {e}")
                print(f"Raw response: {result}")
                # Fall back to just returning the text as summary without date
                return {"summary": result.strip(), "content_date": []}
                
        except Exception as e:
            print(f"Error generating public figure-focused summary with date for {public_figure_name}: {e}")
            return {"summary": "", "content_date": []}


# Main function to run the processor
async def main():
    print("\n=== New Article Processing Starting ===\n")
    processor = NewArticleProcessor()
    await processor.process_new_articles()
    print("\n=== New Article Processing Complete ===\n")


# Run the script when executed directly
if __name__ == "__main__":
    asyncio.run(main())
                
            