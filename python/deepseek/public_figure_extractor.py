from setup_firebase_deepseek import NewsManager
import asyncio
import json
import re
import firebase_admin
from firebase_admin import firestore
from datetime import datetime
import pytz


class PublicFigureExtractor:
    def __init__(self):
        self.news_manager = NewsManager()

    async def extract_and_save_public_figures(self, limit=None, reverse_order=True):
        """
        1. Fetch all articles directly with options for ordering and limiting
        2. Extract public figures with information using DeepSeek from each article's description
        3. Update articles with public figure names
        4. Create public-figure-info documents with additional information and source references
        5. Generate and save public figure-focused article summaries with dates when mentioned
        
        Args:
            limit (int, optional): Maximum number of articles to process. None means process all.
            reverse_order (bool): If True, process articles in reverse alphabetical order.
        """
        try:
            # Step 1: Fetch articles with ordering and limiting options
            print("Fetching articles...")
            
            # Start with the base query
            query = self.news_manager.db.collection("newsArticles")
            
            # Apply ordering (Firestore's default is ascending by document ID)
            if reverse_order:
                # For reverse alphabetical order, order by document ID in descending order
                # Use a simple string "__name__" which refers to the document ID in Firestore
                query = query.order_by("__name__", direction=firestore.Query.DESCENDING)
            else:
                # For normal alphabetical order, order by document ID in ascending order
                query = query.order_by("__name__", direction=firestore.Query.ASCENDING)
            
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
                    continue

                # Extract public figures with additional information using DeepSeek
                initial_public_figures_info = await self.extract_public_figures_from_text(description)
                
                if not initial_public_figures_info:
                    print(f"No public figures found in article {article_id}")
                    continue
                
                # Apply comprehensive verification to ensure only human, notable and modern public figures are processed
                public_figures_info = await self.filter_and_verify_public_figures(initial_public_figures_info)
                
                if not public_figures_info:
                    print(f"No suitable public figures found in article {article_id} after verification")
                    continue
                    
                print(f"Extracted public figure data: {json.dumps(public_figures_info, indent=2)}")

                # Get just the names for the article document
                public_figure_names = [info.get("name") for info in public_figures_info if info.get("name")]
                
                print(f"Found public figures: {public_figure_names}")

                # Step 3: Update the article document with public figure names
                self.news_manager.db.collection("newsArticles").document(article_id).update(
                    {"public_figures": public_figure_names}
                )
                print(f"Updated article {article_id} with public figures: {public_figure_names}")

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
                        print(f"Public figure {name} already exists in database")
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
                        
                        # Check if we need to update lastUpdated field
                        should_update_timestamp = False
                        current_date_kr = datetime.now(pytz.timezone('Asia/Seoul')).strftime("%Y-%m-%d")
                        
                        # If lastUpdated field doesn't exist or is older than today (in KR timezone)
                        if "lastUpdated" not in existing_data or existing_data.get("lastUpdated", "") != current_date_kr:
                            should_update_timestamp = True
                        
                        # Check if we should enrich missing fields (only for existing records with incomplete data)
                        missing_fields = []
                        essential_fields = ["birthDate", "chineseZodiac", "company", "debutDate", "group", 
                                            "instagramUrl", "profilePic", "school", "spotifyUrl", "youtubeUrl", 
                                            "zodiacSign"]
                        
                        for field in essential_fields:
                            # Check if field is missing or empty (empty string or empty array)
                            if field not in existing_data or (
                                (isinstance(existing_data.get(field), str) and not existing_data.get(field)) or
                                (isinstance(existing_data.get(field), list) and not existing_data.get(field))
                            ):
                                missing_fields.append(field)
                        
                        # For groups, check if members have complete information
                        is_group = existing_data.get("is_group", False)
                        members_need_update = False
                        
                        if is_group and "members" in existing_data and isinstance(existing_data["members"], list):
                            for member in existing_data["members"]:
                                for member_field in ["birthDate", "chineseZodiac", "instagramUrl", "profilePic", 
                                                    "school", "spotifyUrl", "youtubeUrl", "zodiacSign"]:
                                    if member_field not in member or (
                                        (isinstance(member.get(member_field), str) and not member.get(member_field)) or
                                        (isinstance(member.get(member_field), list) and not member.get(member_field))
                                    ):
                                        members_need_update = True
                                        break
                                
                                if members_need_update:
                                    break
                        
                        # Only perform research if essential data is missing
                        if missing_fields or members_need_update:
                            print(f"Public figure {name} has missing information: {missing_fields}")
                            print(f"Members need update: {members_need_update}")
                            print(f"Researching more info for {name} to fill in missing data...")
                            
                            # Research to get missing information
                            additional_info = await self.research_public_figure(name)
                            print(f"Research results for {name}: {json.dumps(additional_info, indent=2)}")
                            
                            # Prepare the update data
                            update_data = {}
                            
                            # Add any missing fields we found to update_data
                            for field in missing_fields:
                                if field in additional_info and additional_info[field]:
                                    update_data[field] = additional_info[field]
                                    print(f"Adding missing field {field}: {additional_info[field]}")
                            
                            # If it's a group and members need update
                            if is_group and members_need_update and "members" in additional_info:
                                # Map existing members to research results by name
                                existing_members = existing_data.get("members", [])
                                researched_members = additional_info.get("members", [])
                                
                                # Create a dictionary of researched members by name for easy lookup
                                researched_members_dict = {member.get("name", ""): member for member in researched_members}
                                
                                # For each existing member, update with research info if available
                                for i, member in enumerate(existing_members):
                                    member_name = member.get("name", "")
                                    if member_name and member_name in researched_members_dict:
                                        researched_member = researched_members_dict[member_name]
                                        
                                        # Update missing fields for this member
                                        for member_field in ["birthDate", "chineseZodiac", "instagramUrl", "profilePic", 
                                                            "school", "spotifyUrl", "youtubeUrl", "zodiacSign"]:
                                            if (member_field not in member or not member.get(member_field)) and \
                                            member_field in researched_member and researched_member[member_field]:
                                                existing_members[i][member_field] = researched_member[member_field]
                                                print(f"Updated {member_field} for member {member_name}")
                                
                                # Set the updated members array in the update data
                                update_data["members"] = existing_members
                            
                            # Always update lastUpdated to current date in KR timezone
                            if should_update_timestamp:
                                update_data["lastUpdated"] = current_date_kr
                            
                            # Only update if we have data to update
                            if update_data:
                                public_figure_doc_ref.update(update_data)
                                print(f"Updated public figure {name} with missing information")
                            else:
                                print(f"No new information found for {name}, skipping update")
                        
                        elif should_update_timestamp:
                            # If only timestamp needs update
                            public_figure_doc_ref.update({"lastUpdated": current_date_kr})
                            print(f"Updated lastUpdated timestamp for {name}")
                        
                        else:
                            print(f"Public figure {name} has complete information, no update needed")
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
                        
                        # Create a new clean public figure data object with sources field and all new fields
                        public_figure_data = {
                            "name": name,
                            "gender": gender,
                            "occupation": occupation,
                            "is_group": is_group,
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
                            "lastUpdated": ""
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
                        
                        # Add all the new fields from the research results
                        for field in ["birthDate", "chineseZodiac", "company", "debutDate", "group", 
                                    "instagramUrl", "profilePic", "school", "spotifyUrl", "youtubeUrl", 
                                    "zodiacSign", "lastUpdated"]:
                            if field in additional_info and additional_info[field]:
                                public_figure_data[field] = additional_info[field]
                                print(f"Added {field}: {additional_info[field]} for {name}")
                            
                        # Get members if available in the research results - only for groups
                        if is_group and "members" in additional_info and isinstance(additional_info["members"], list):
                            members = additional_info["members"]
                            print(f"Found {len(members)} members for group {name}")
                        
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
                            
                        # Add members if this is a group and we have member data
                        if is_group and members:
                            # Make sure to include both stage names and real names for all members
                            processed_members = []
                            for member in members:
                                # Create a complete member data object with all fields
                                member_data = {
                                    "name": member.get("name", ""),  # Stage name or most commonly known name
                                    "real_name": member.get("real_name", ""),
                                    "gender": member.get("gender", ""),
                                    "name_kr": "",  # Default empty, will be filled if Korean
                                    "birthDate": member.get("birthDate", ""),
                                    "chineseZodiac": member.get("chineseZodiac", ""),
                                    "nationality": member.get("nationality", ""),
                                    "profilePic": member.get("profilePic", ""),
                                    "instagramUrl": member.get("instagramUrl", ""),
                                    "spotifyUrl": member.get("spotifyUrl", ""),
                                    "youtubeUrl": member.get("youtubeUrl", ""),
                                    "school": member.get("school", []),
                                    "zodiacSign": member.get("zodiacSign", "")
                                }
                                
                                # Check if this member is Korean before adding Korean name
                                member_is_korean = False
                                if "nationality" in member:
                                    member_is_korean = "korean" in member["nationality"].lower() or "south korea" in member["nationality"].lower()
                                elif is_korean:  # If the group is Korean, assume members are too
                                    member_is_korean = True
                                    
                                # Only add Korean name if member is Korean
                                if member_is_korean and "name_kr" in member and member["name_kr"]:
                                    member_data["name_kr"] = member["name_kr"]
                                    
                                processed_members.append(member_data)
                                
                            public_figure_data["members"] = processed_members
                        
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
                            # Store as string in YYYY-MM-DD format
                            summary_data["event_dates"] = event_date
                            print(f"Adding event dates '{event_date}' to summary for {public_figure_name}")
                            
                        # Add event_contents as a separate field if available
                        if event_contents:
                            summary_data["event_contents"] = event_contents
                            print(f"Adding event contents for {len(event_contents)} dates to summary for {public_figure_name}")
                        
                        summary_doc_ref.set(summary_data)
                        print(f"Saved new summary for {public_figure_name} in article {article_id} with all required fields")

            print("Public figure extraction, database updates, and summary generation completed successfully!")

        except Exception as e:
            print(f"Error in extract_and_save_public_figures: {e}")
            raise
        finally:
            # Close the connection
            await self.news_manager.close()

    async def extract_public_figures_from_text(self, text):
        """Extract public figures with additional information from text with comprehensive filtering"""
        try:
            # Enhanced prompt for DeepSeek with stricter criteria including entity type constraints
            prompt = f"""
            Extract only MODERN and NOTABLE HUMAN public figures or performance groups mentioned in the following text, along with their gender and occupation.
            
            Public figures must meet ALL of these requirements:
            1. HUMAN INDIVIDUALS OR HUMAN PERFORMANCE GROUPS - Must be individual people or groups of people (bands, sports teams, etc.)
            2. MODERN - Generally born after 1900 or currently active/recently active (within the last 30 years)
            3. NOTABLE - Well-known to the general public with substantial media presence
            
            Include ONLY:
            1. Individual people who are widely recognized (politicians, celebrities, athletes, artists, etc.)
            2. Performance groups comprised of people (music bands, dance groups, sports teams, etc.)
            
            DO NOT include:
            1. Companies, corporations, or business entities (Sony, Apple, Netflix, 20th Century Fox, etc.)
            2. Brands or products (iPhone, Nike, Coca-Cola, etc.)
            3. Organizations or institutions (universities, hospitals, government agencies, etc.)
            4. Historical figures (e.g., Abraham Lincoln, Gandhi, ancient rulers, etc.)
            5. People who died before 1990 (unless they have extraordinary ongoing cultural relevance)
            6. Regular citizens or local individuals without widespread recognition
            7. Minor officials or bureaucrats without nationwide recognition
            
            For each potential entry, verify:
            - Is this an actual human person or group of people (not a company/brand/organization)?
            - Is this person alive or active within the last 30 years?
            - Would an average person recognize this name today?
            
            Return a JSON array of objects with these properties for individuals:
            - name: The correctly capitalized full name
            - gender: "Male", "Female", or "" if unclear
            - occupation: Array of primary occupations (politician, actor, athlete, business leader, etc.)
            - is_group: false
            - entity_type: "human_individual"
            
            For groups of people, return objects with:
            - name: The correctly capitalized group name
            - gender: "Group"
            - occupation: Array of the group's primary occupations (band, sports team, political party, etc.)
            - is_group: true
            - entity_type: "human_group"
            
            Only include verifiably notable AND modern human public figures or human groups. If no such entities are found, return an empty array.
            
            Text: {text}
            
            Output format: 
            [
            {{"name": "Modern Public Figure", "gender": "Male", "occupation": ["Politician", "Lawyer"], "is_group": false, "entity_type": "human_individual"}},
            {{"name": "Famous Band", "gender": "Group", "occupation": ["K-pop Group"], "is_group": true, "entity_type": "human_group"}}
            ]
            """

            # Call DeepSeek API
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that extracts information only about human public figures from text. Only return individual people or groups of people (like bands or teams). Strictly exclude companies, brands, organizations, and historical figures.",
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
            
            # Filter out any entities that somehow got through but aren't valid human entity types
            filtered_figures = []
            
            for figure in public_figures_info:
                entity_type = figure.get("entity_type", "")
                if entity_type in ["human_individual", "human_group"]:
                    # Remove the entity_type field before returning (we only used it for filtering)
                    if "entity_type" in figure:
                        del figure["entity_type"]
                    filtered_figures.append(figure)
                else:
                    print(f"Filtered out {figure.get('name', 'unnamed')} - not a human individual or group")
            
            print(f"Initial extraction found {len(public_figures_info)} entities, filtered to {len(filtered_figures)} human public figures")
            
            # Remove any Korean names from the initial extraction
            # We'll get proper Korean names during the research phase
            for i, public_figure in enumerate(filtered_figures):
                if "name_kr" in public_figure:
                    print(f"Removing Korean name from initial extraction for {public_figure.get('name')}")
                    del filtered_figures[i]["name_kr"]
                
            return filtered_figures
            
        except Exception as e:
            print(f"Error extracting public figures from text: {e}")
            print(f"Text excerpt: {text[:100]}...")
            return []

    async def verify_entity_is_human(self, name):
        """Verify that an entity is a human individual or group of humans, not a company or organization"""
        try:
            # Entity type verification prompt
            prompt = f"""
            Determine if "{name}" is:
            
            A) A human individual (a specific person)
            B) A group of humans (band, team, ensemble, etc.)
            C) A company, corporation, or business entity
            D) A brand or product
            E) An organization or institution
            F) Something else
            
            Examples for clarity:
            - "BTS" is a group of humans (K-pop band)
            - "Sony" is a company/corporation
            - "iPhone" is a brand/product
            - "Harvard University" is an organization/institution
            - "Michael Jordan" is a human individual
            - "Lakers" is a group of humans (sports team)
            - "United Nations" is an organization/institution
            - "Coca-Cola" is both a company and a brand
            
            Return a JSON with a clear categorization and confidence level:
            {{"entity_type": "human_individual", "human_group", "company", "brand", "organization", or "other", 
            "confidence": 1-10,
            "explanation": "Brief explanation of your reasoning"}}
            """

            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a precise categorization assistant that determines if an entity is a human individual, a human group, or a non-human entity like a company or organization."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )
            
            result = response.choices[0].message.content.strip()
            
            # Extract JSON
            json_match = re.search(r"\{.*\}", result, re.DOTALL)
            if json_match:
                result = json_match.group(0)
                
            # Parse response
            verification = json.loads(result)
            entity_type = verification.get("entity_type", "")
            confidence = verification.get("confidence", 0)
            explanation = verification.get("explanation", "")
            
            # Log the verification result
            print(f"Entity type verification for '{name}': {entity_type} (confidence: {confidence}/10)")
            print(f"Explanation: {explanation}")
            
            # Return true only if entity type is human_individual or human_group AND confidence is high
            is_human_entity = entity_type in ["human_individual", "human_group"] and confidence >= 7
            
            return is_human_entity
            
        except Exception as e:
            print(f"Error verifying entity type of '{name}': {e}")
            return False  # Default to not including if verification fails

    async def verify_public_figure_time_relevance(self, name):
        """Additional verification step to confirm the modern relevance of extracted public figures"""
        try:
            # Time relevance verification prompt
            prompt = f"""
            Verify if "{name}" is a MODERN public figure who was either:
            1. Born after 1900, AND
            2. Is either still alive OR has been active/relevant within the last 30 years

            A modern public figure should meet MULTIPLE of these criteria:
            - Is currently alive or died after 1990
            - Has current cultural, political, or social relevance
            - Is discussed in contemporary media (not just historical contexts)
            - Has an active career or legacy within the last 30 years
            - If it's a group, the group either still exists or disbanded within the last 30 years
            
            Do NOT consider as modern:
            - Historical figures from before the 20th century
            - Individuals whose primary significance was before 1950 and are no longer culturally relevant
            - Figures who died before 1990 (unless they have extraordinary continued cultural impact)
            
            For a concrete example:
            - Abraham Lincoln: NOT modern (historical figure, died long ago)
            - The Beatles: Borderline modern (disbanded in 1970, but with enormous continued cultural relevance)
            - Michael Jackson: Modern (though deceased, died after 1990 and remains culturally significant)
            - Lady Gaga: Clearly modern (contemporary figure, still active)
            
            Provide your assessment and confidence:
            {{"is_modern": true/false, "confidence": 1-10, "explanation": "brief explanation", "birth_year": "YYYY or Unknown", "death_year": "YYYY, N/A, or Unknown"}}
            """

            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a knowledgeable assistant that evaluates if individuals or groups are contemporary public figures with modern relevance."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )
            
            result = response.choices[0].message.content.strip()
            
            # Extract JSON
            json_match = re.search(r"\{.*\}", result, re.DOTALL)
            if json_match:
                result = json_match.group(0)
                
            # Parse response
            verification = json.loads(result)
            is_modern = verification.get("is_modern", False)
            confidence = verification.get("confidence", 0)
            explanation = verification.get("explanation", "")
            birth_year = verification.get("birth_year", "Unknown")
            death_year = verification.get("death_year", "Unknown")
            
            # Log the verification result
            print(f"Time relevance verification for '{name}': {is_modern} (confidence: {confidence}/10)")
            print(f"Birth year: {birth_year}, Death year: {death_year}")
            print(f"Explanation: {explanation}")
            
            # Return true only if both is_modern is true AND confidence score is high enough
            return is_modern and confidence >= 7
            
        except Exception as e:
            print(f"Error verifying time relevance of '{name}': {e}")
            return False  # Default to not including if verification fails

    async def filter_and_verify_public_figures(self, initial_figures):
        """Apply comprehensive verification to ensure only human, notable and modern public figures are processed"""
        verified_figures = []
        
        for figure in initial_figures:
            name = figure.get("name")
            if not name:
                continue
            
            # First verify if this is actually a human individual or human group
            is_human_entity = await self.verify_entity_is_human(name)
            
            if not is_human_entity:
                print(f"Filtered out '{name}' - not a human individual or human group")
                continue
            
            # Next verify time relevance
            is_modern = await self.verify_public_figure_time_relevance(name)
            
            if not is_modern:
                print(f"Filtered out '{name}' - not considered a modern public figure")
                continue
            
            # Finally verify notability (only check if both previous checks pass)
            is_notable = await self.verify_public_figure_notability(name)
            
            if is_notable:
                verified_figures.append(figure)
                print(f"Verified '{name}' as a human, notable, and modern public figure")
            else:
                print(f"Filtered out '{name}' - not considered a notable public figure")
        
        return verified_figures

    async def verify_public_figure_notability(self, name):
        """Additional verification step to confirm the notability of extracted public figures"""
        try:
            # Enhanced verification prompt
            prompt = f"""
            Verify if "{name}" is truly a NOTABLE public figure who would be widely recognized by the general public.

            A notable public figure should meet MULTIPLE of these criteria:
            1. Has significant media presence across multiple major news outlets
            2. Would likely have a Wikipedia page or equivalent
            3. Is recognized by people outside their immediate professional field
            4. Has substantial social media following or public profile
            5. Is frequently mentioned in news related to their field
            6. Holds a prominent position in politics, business, entertainment, or sports
            
            Provide a confidence score (1-10) on whether this person/group is truly a notable public figure.
            
            Return your response as a simple JSON:
            {{"is_notable": true/false, "confidence_score": 1-10, "explanation": "brief explanation"}}
            """

            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a discerning assistant that evaluates if individuals or groups are truly notable public figures with significant recognition."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )
            
            result = response.choices[0].message.content.strip()
            
            # Extract JSON
            json_match = re.search(r"\{.*\}", result, re.DOTALL)
            if json_match:
                result = json_match.group(0)
                
            # Parse response
            verification = json.loads(result)
            is_notable = verification.get("is_notable", False)
            confidence_score = verification.get("confidence_score", 0)
            explanation = verification.get("explanation", "")
            
            # Log the verification result
            print(f"Notability verification for '{name}': {is_notable} (confidence: {confidence_score}/10)")
            print(f"Explanation: {explanation}")
            
            # Return true only if both is_notable is true AND confidence score is high enough
            return is_notable and confidence_score >= 7
            
        except Exception as e:
            print(f"Error verifying notability of '{name}': {e}")
            return False  # Default to not including if verification fails

    async def research_public_figure(self, name):
        """Research a public figure to find comprehensive information when missing from context"""
        # Using a named placeholder {target_name} instead of {0}
        prompt = """
        Provide detailed information about the public figure named "{target_name}".
        First determine if this is an individual person or a group (like a band, team, organization, etc.).
        
        If it's an individual person, return a JSON object with:
        - gender: "Male", "Female", or "" if unclear
        - occupation: Array of primary occupations (singer, actor, model, idol, athlete, politician, etc.)
        - nationality: Primary nationality, if known
        - name_kr: Korean name in Hangul characters (ONLY if this person is Korean, otherwise "")
        - is_group: false
        - birthDate: Birth date in format "YYYY-MM-DD" or "" if unknown
        - chineseZodiac: Chinese zodiac sign like "Ox (소띠)" with Hangul or "" if unknown
        - company: Entertainment company/agency they belong to or "" if unknown/not applicable
        - debutDate: Debut date in format "YYYY-MM-DD" with optional description after colon like "2016-02-23 : To Be Continued" or "" if unknown
        - group: Musical group/band they belong to or "" if none/unknown
        - instagramUrl: Full Instagram URL or "" if unknown
        - profilePic: URL to profile picture or "" if unknown
        - school: Array of schools attended ["Elementary School", "Middle School", "University", etc.] or [] if unknown
        - spotifyUrl: Full Spotify artist URL or "" if unknown
        - youtubeUrl: Full YouTube channel URL or "" if unknown
        - zodiacSign: Western zodiac sign like "Aries (양자리)" with Hangul or "" if unknown
        - lastUpdated: Current date in UTC+9 timezone (Korea)
        
        If it's a group, return a JSON object with:
        - gender: "Group"
        - occupation: Array of the group's primary occupations (band, idol group, sports team, etc.)
        - nationality: Primary nationality of the group, if known
        - name_kr: Korean name in Hangul characters (ONLY if this group is Korean, otherwise "")
        - is_group: true
        - company: Entertainment company/agency they belong to or "" if unknown/not applicable
        - debutDate: Debut date in format "YYYY-MM-DD" with optional description after colon or "" if unknown
        - instagramUrl: Full Instagram URL or "" if unknown
        - profilePic: URL to profile picture or "" if unknown
        - spotifyUrl: Full Spotify artist URL or "" if unknown
        - youtubeUrl: Full YouTube channel URL or "" if unknown
        - lastUpdated: Current date in UTC+9 timezone (Korea)
        - members: Array of objects containing detailed info about each member with keys:
        - name: Member's official or most commonly known name
        - real_name: Member's full legal name if different from official name
        - gender: "Male", "Female", or "" if unclear
        - name_kr: Korean name in Hangul (ONLY if the member is Korean)
        - birthDate: Birth date in format "YYYY-MM-DD" or "" if unknown
        - chineseZodiac: Chinese zodiac sign like "Ox (소띠)" with Hangul or "" if unknown
        - nationality: Primary nationality
        - profilePic: URL to profile picture or "" if unknown
        - instagramUrl: Full Instagram URL or "" if unknown
        - spotifyUrl: Full Spotify artist URL or "" if unknown
        - youtubeUrl: Full YouTube channel URL or "" if unknown
        - school: Array of schools attended or [] if unknown
        - zodiacSign: Western zodiac sign like "Aries (양자리)" with Hangul or "" if unknown
        
        Format for Korean individual (K-pop idol example):
        {{
            "gender": "Male", "occupation": ["Singer", "Actor", "Model", "MC"], "nationality": "South Korean", 
            "name_kr": "차은우", "is_group": false, "birthDate": "1997-03-30", "chineseZodiac": "Ox (소띠)", 
            "company": "Fantagio", "debutDate": "2016-02-23 : To Be Continued", "group": "ASTRO", 
            "instagramUrl": "https://www.instagram.com/eunwo.o_c", "profilePic": "https://image.url/example.jpg", 
            "school": ["Suri Middle School", "Hanlim Multi Art School", "Sungkyunkwan University"], 
            "spotifyUrl": "https://open.spotify.com/artist/4XDi67ZENZtbfKnvMnTYel", "youtubeUrl": "", 
            "zodiacSign": "Aries (양자리)", "lastUpdated": "2025-04-29"
        }}
        
        Format for non-Korean individual:
        {{
            "gender": "Female", "occupation": ["Singer", "Songwriter"], "nationality": "American", 
            "name_kr": "", "is_group": false, "birthDate": "1989-12-13", "chineseZodiac": "Snake", 
            "company": "Republic Records", "debutDate": "2006-06-19", "group": "", 
            "instagramUrl": "https://www.instagram.com/example", "profilePic": "https://image.url/example.jpg", 
            "school": ["Wyomissing Area High School"], "spotifyUrl": "https://open.spotify.com/artist/example", 
            "youtubeUrl": "https://www.youtube.com/example", "zodiacSign": "Sagittarius", "lastUpdated": "2025-04-29"
        }}
        
        Format for Korean group (K-pop group example):
        {{
            "gender": "Group", "occupation": ["K-pop Group"], "nationality": "South Korean", "name_kr": "아스트로", 
            "is_group": true, "company": "Fantagio", "debutDate": "2016-02-23", 
            "instagramUrl": "https://www.instagram.com/officialastro", "profilePic": "https://image.url/example.jpg", 
            "spotifyUrl": "https://open.spotify.com/artist/example", "youtubeUrl": "https://www.youtube.com/astro", 
            "lastUpdated": "2025-04-29", "members": [
            {{
                "name": "Cha Eun-woo", "real_name": "Lee Dong-min", "gender": "Male", "name_kr": "차은우", 
                "birthDate": "1997-03-30", "chineseZodiac": "Ox (소띠)", "nationality": "South Korean", 
                "profilePic": "https://image.url/eunwoo.jpg", "instagramUrl": "https://www.instagram.com/eunwo.o_c", 
                "spotifyUrl": "", "youtubeUrl": "", "school": ["Suri Middle School", "Hanlim Multi Art School"], 
                "zodiacSign": "Aries (양자리)"
            }},
            {{
                "name": "Moonbin", "real_name": "Moon Bin", "gender": "Male", "name_kr": "문빈", 
                "birthDate": "1998-01-26", "chineseZodiac": "Tiger (호랑이띠)", "nationality": "South Korean",
                "profilePic": "", "instagramUrl": "", "spotifyUrl": "", "youtubeUrl": "", 
                "school": [], "zodiacSign": "Aquarius (물병자리)"
            }}
            ]
        }}
        
        CRITICAL INSTRUCTIONS:
        1. ONLY provide a Korean name (name_kr) if the person or group is actually Korean. For non-Korean public figures, name_kr MUST be an empty string.
        2. For individual public figures who are not Korean, leave name_kr as an empty string.
        3. For group members, ALWAYS include their official name as "name" and their birth name as "real_name" if different.
        4. Make sure the data returned is specifically about "{target_name}" and not a different public figure or group.
        5. For any field where information is uncertain or unknown, provide an empty string ("") or empty array ([]) as appropriate.
        6. For lastUpdated, use the current date in Korea (UTC+9) in format "YYYY-MM-DD".
        7. For URLs, provide complete URLs (including https://) or empty strings.
        8. Be extremely careful to only include Korean names (name_kr) for Korean public figures, never for non-Korean public figures.
        """
        
        # Format the prompt using the .format() method with a named parameter
        formatted_prompt = prompt.format(target_name=name)
        
        try:
            response = self.news_manager.client.chat.completions.create(
                model=self.news_manager.model,
                messages=[
                    {"role": "system", "content": "You are a knowledgeable assistant that provides accurate information about public figures."},
                    {"role": "user", "content": formatted_prompt}
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
                print("FIXING: Public figure {0} is not Korean but had Korean name. Removing.".format(name))
                data["name_kr"] = ""
                
            # Ensure all required fields exist with default values if not present
            required_fields = {
                "gender": "", 
                "occupation": [], 
                "nationality": "",
                "name_kr": "", 
                "is_group": None,  # This should be a boolean, set based on data
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
                "lastUpdated": ""
            }
            
            # Make sure is_group is a boolean
            if "is_group" in data:
                is_group = data["is_group"]
            else:
                # Default to false if not specified
                is_group = False
                data["is_group"] = False
            
            # Add missing fields with default values
            for field, default_value in required_fields.items():
                if field != "is_group" and field not in data:  # Skip is_group as we handled it separately
                    data[field] = default_value
                    print("Adding missing field '{0}' with default value".format(field))
                
            # For groups, ensure members have correct data format
            if is_group and "members" in data and isinstance(data["members"], list):
                member_required_fields = {
                    "name": "", 
                    "real_name": "", 
                    "gender": "",
                    "name_kr": "",
                    "birthDate": "", 
                    "chineseZodiac": "", 
                    "nationality": "",
                    "profilePic": "", 
                    "instagramUrl": "", 
                    "spotifyUrl": "", 
                    "youtubeUrl": "", 
                    "school": [], 
                    "zodiacSign": ""
                }
                
                for i, member in enumerate(data["members"]):
                    # Check if this member is Korean
                    member_is_korean = True  # Assume group members share nationality with the group
                    if "nationality" in member:
                        member_is_korean = "korean" in member["nationality"].lower() or "south korea" in member["nationality"].lower()
                    elif not is_korean:
                        member_is_korean = False
                    
                    # If member is not Korean, clear Korean name
                    if not member_is_korean and "name_kr" in member:
                        print("FIXING: Member {0} is not Korean but had Korean name. Removing.".format(member.get('name')))
                        data["members"][i]["name_kr"] = ""
                    
                    # Add missing fields with default values for each member
                    for field, default_value in member_required_fields.items():
                        if field not in member:
                            data["members"][i][field] = default_value
                            print("Adding missing field '{0}' for member {1} with default value".format(field, member.get('name')))
            
            print("Validated data for {0}, is_korean={1}".format(name, is_korean))
            return data
            
        except Exception as e:
            print("Error researching public figure {0}: {1}".format(name, e))
            return {"gender": "", "occupation": [], "nationality": "", "name_kr": "", "birthDate": "", "chineseZodiac": "", 
                    "company": "", "debutDate": "", "group": "", "instagramUrl": "", "profilePic": "", "school": [], 
                    "spotifyUrl": "", "youtubeUrl": "", "zodiacSign": "", "lastUpdated": ""}

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

    async def update_existing_article_summaries_with_event_contents(self, limit=None):
        """
        Update existing article summaries with event contents field.
        This method is used to backfill the event_contents field for summaries that already exist.
        
        Args:
            limit (int, optional): Maximum number of summaries to process. None means process all.
        """
        try:
            print("Starting to update existing article summaries with event contents...")
            
            # Get all public figures
            public_figures_ref = self.news_manager.db.collection("public-figure-info").stream()
            public_figures = [doc.id for doc in public_figures_ref]
            
            total_updated = 0
            
            for public_figure_id in public_figures:
                print(f"Processing public figure: {public_figure_id}")
                
                # Get actual public figure name from document
                public_figure_doc = self.news_manager.db.collection("public-figure-info").document(public_figure_id).get()
                if not public_figure_doc.exists:
                    continue
                    
                public_figure_data = public_figure_doc.to_dict()
                public_figure_name = public_figure_data.get("name", "")
                
                if not public_figure_name:
                    print(f"Could not get name for public figure {public_figure_id}, skipping...")
                    continue
                    
                print(f"Found name: {public_figure_name} for ID {public_figure_id}")
                
                # Get article summaries for this public figure
                query = self.news_manager.db.collection("public-figure-info").document(public_figure_id).collection("article-summaries")
                
                # Only get summaries that have event_dates but not event_contents
                query = query.where("event_dates", "!=", None)
                
                # Apply limit if specified (per public figure)
                if limit is not None:
                    query = query.limit(limit)
                    
                summaries_ref = query.stream()
                
                for summary_doc in summaries_ref:
                    summary_data = summary_doc.to_dict()
                    
                    # Skip if this summary already has event_contents
                    if "event_contents" in summary_data and summary_data["event_contents"]:
                        print(f"Summary {summary_doc.id} already has event_contents, skipping...")
                        continue
                    
                    # Get required data from the summary
                    article_id = summary_data.get("article_id", "")
                    title = summary_data.get("title", "")
                    body = summary_data.get("body", "")
                    event_dates = summary_data.get("event_dates", [])
                    
                    if not article_id or not body:
                        print(f"Missing required data for article summary {summary_doc.id}, skipping...")
                        continue
                    
                    if not event_dates:
                        print(f"No event dates for article summary {summary_doc.id}, skipping...")
                        continue
                    
                    print(f"Regenerating event contents for article {article_id}")
                    
                    # Regenerate the summary with events
                    summary_results = await self.generate_public_figure_focused_summary_with_date(
                        title=title,
                        description=body,
                        public_figure_name=public_figure_name
                    )
                    
                    event_contents = summary_results.get("event_contents", {})
                    
                    if not event_contents:
                        print(f"Failed to extract event contents for article {article_id}")
                        continue
                    
                    # Update the document with the new event_contents field
                    summary_doc_ref = self.news_manager.db.collection("public-figure-info").document(public_figure_id).collection("article-summaries").document(summary_doc.id)
                    summary_doc_ref.update({"event_contents": event_contents})
                    
                    print(f"Updated article summary {summary_doc.id} with event contents for {len(event_contents)} dates")
                    total_updated += 1
                    
            print(f"Completed update of {total_updated} article summaries with event contents!")
        
        except Exception as e:
            print(f"Error in update_existing_article_summaries_with_event_contents: {e}")
            raise
        finally:
            # Close the connection
            await self.news_manager.close()

    async def update_specific_article_summaries(self, document_ids=None, public_figure_id=None):
        """
        Update specific article summaries with event contents field.
        
        Args:
            document_ids (list, optional): List of specific document IDs to update. 
                                        If provided, only these documents will be processed.
            public_figure_id (str, optional): If provided, only documents for this public figure will be processed.
                                            This should be the document ID (lowercase, no spaces).
        """
        try:
            print("Starting to update specific article summaries with event contents...")
            
            total_updated = 0
            
            # Handle case where specific documents are provided
            if document_ids and isinstance(document_ids, list):
                print(f"Processing {len(document_ids)} specific document IDs")
                
                for doc_id in document_ids:
                    # We need to find which public figure collection this document belongs to
                    # Only process if public_figure_id is provided, otherwise we'd have to search all collections
                    if not public_figure_id:
                        print(f"Cannot process document ID {doc_id} without a public figure ID")
                        continue
                    
                    # Get the public figure name
                    public_figure_doc = self.news_manager.db.collection("public-figure-info").document(public_figure_id).get()
                    if not public_figure_doc.exists:
                        print(f"Public figure with ID {public_figure_id} does not exist, skipping...")
                        continue
                        
                    public_figure_data = public_figure_doc.to_dict()
                    public_figure_name = public_figure_data.get("name", "")
                    
                    if not public_figure_name:
                        print(f"Could not get name for public figure {public_figure_id}, skipping...")
                        continue
                        
                    print(f"Found name: {public_figure_name} for ID {public_figure_id}")
                    
                    # Get the specific document
                    summary_doc_ref = self.news_manager.db.collection("public-figure-info").document(public_figure_id).collection("article-summaries").document(doc_id)
                    summary_doc = summary_doc_ref.get()
                    
                    if not summary_doc.exists:
                        print(f"Document {doc_id} does not exist for public figure {public_figure_id}, skipping...")
                        continue
                    
                    summary_data = summary_doc.to_dict()
                    
                    # Skip if this summary already has event_contents (unless it's empty)
                    if "event_contents" in summary_data and summary_data["event_contents"]:
                        print(f"Summary {doc_id} already has event_contents, skipping...")
                        continue
                    
                    # Get required data from the summary
                    article_id = summary_data.get("article_id", "")
                    title = summary_data.get("title", "")
                    body = summary_data.get("body", "")
                    
                    if not article_id or not body:
                        print(f"Missing required data for article summary {doc_id}, skipping...")
                        continue
                    
                    print(f"Regenerating event contents for article {article_id}")
                    
                    # Regenerate the summary with events
                    summary_results = await self.generate_public_figure_focused_summary_with_date(
                        title=title,
                        description=body,
                        public_figure_name=public_figure_name
                    )
                    
                    event_contents = summary_results.get("event_contents", {})
                    
                    if not event_contents:
                        print(f"Failed to extract event contents for article {article_id}")
                        continue
                    
                    # Update the document with the new event_contents field
                    summary_doc_ref.update({"event_contents": event_contents})
                    
                    print(f"Updated article summary {doc_id} with event contents for {len(event_contents)} dates")
                    total_updated += 1
            
            # Handle case where only a specific public figure is provided
            elif public_figure_id:
                print(f"Processing all documents for public figure: {public_figure_id}")
                
                # Get the public figure name
                public_figure_doc = self.news_manager.db.collection("public-figure-info").document(public_figure_id).get()
                if not public_figure_doc.exists:
                    print(f"Public figure with ID {public_figure_id} does not exist")
                    return
                    
                public_figure_data = public_figure_doc.to_dict()
                public_figure_name = public_figure_data.get("name", "")
                
                if not public_figure_name:
                    print(f"Could not get name for public figure {public_figure_id}")
                    return
                    
                print(f"Found name: {public_figure_name} for ID {public_figure_id}")
                
                # Get all article summaries for this public figure
                summaries_ref = self.news_manager.db.collection("public-figure-info").document(public_figure_id).collection("article-summaries").stream()
                
                for summary_doc in summaries_ref:
                    summary_data = summary_doc.to_dict()
                    
                    # Skip if this summary already has event_contents
                    if "event_contents" in summary_data and summary_data["event_contents"]:
                        print(f"Summary {summary_doc.id} already has event_contents, skipping...")
                        continue
                    
                    # Get required data from the summary
                    article_id = summary_data.get("article_id", "")
                    title = summary_data.get("title", "")
                    body = summary_data.get("body", "")
                    
                    if not article_id or not body:
                        print(f"Missing required data for article summary {summary_doc.id}, skipping...")
                        continue
                    
                    print(f"Regenerating event contents for article {article_id}")
                    
                    # Regenerate the summary with events
                    summary_results = await self.generate_public_figure_focused_summary_with_date(
                        title=title,
                        description=body,
                        public_figure_name=public_figure_name
                    )
                    
                    event_contents = summary_results.get("event_contents", {})
                    
                    if not event_contents:
                        print(f"Failed to extract event contents for article {article_id}")
                        continue
                    
                    # Update the document with the new event_contents field
                    summary_doc_ref = self.news_manager.db.collection("public-figure-info").document(public_figure_id).collection("article-summaries").document(summary_doc.id)
                    summary_doc_ref.update({"event_contents": event_contents})
                    
                    print(f"Updated article summary {summary_doc.id} with event contents for {len(event_contents)} dates")
                    total_updated += 1
            
            else:
                print("No document IDs or public figure ID provided, nothing to do")
            
            print(f"Completed update of {total_updated} specific article summaries with event contents!")
        
        except Exception as e:
            print(f"Error in update_specific_article_summaries: {e}")
            raise
        finally:
            # Close the connection
            await self.news_manager.close()


# Main function to run the extractor
async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Public Figure Information Extractor')
    parser.add_argument('--mode', choices=['extract', 'update_events', 'update_specific'], default='extract',
                        help='Operation mode: extract new data, update all existing event contents, or update specific documents')
    parser.add_argument('--limit', type=int, default=1000,
                        help='Number of items to process (None for all)')
    parser.add_argument('--reverse', action='store_true', default=True,
                        help='Process in reverse alphabetical order (default: True)')
    parser.add_argument('--public-figure', type=str, default=None,
                        help='Specific public figure ID to process (lowercase, no spaces)')
    parser.add_argument('--doc-ids', nargs='+', default=None,
                        help='Specific document IDs to process (requires --public-figure)')
    parser.add_argument('--doc-ids-file', type=str, default=None,
                        help='Path to a text file containing document IDs to process (one per line)')
    
    args = parser.parse_args()
    
    extractor = PublicFigureExtractor()
    
    if args.mode == 'extract':
        print("\n=== Public Figure Information Extraction Starting ===\n")
        await extractor.extract_and_save_public_figures(limit=args.limit, reverse_order=args.reverse)
        print("\n=== Public Figure Information Extraction Complete ===\n")
    
    elif args.mode == 'update_events':
        print("\n=== Updating Existing Article Summaries with Event Contents ===\n")
        await extractor.update_existing_article_summaries_with_event_contents(limit=args.limit)
        print("\n=== Event Contents Update Complete ===\n")
    
    elif args.mode == 'update_specific':
        print("\n=== Updating Specific Article Summaries with Event Contents ===\n")
        
        # Handle document IDs from file if provided
        doc_ids = args.doc_ids or []
        if args.doc_ids_file:
            try:
                with open(args.doc_ids_file, 'r') as f:
                    file_ids = [line.strip() for line in f if line.strip()]
                    doc_ids.extend(file_ids)
                print(f"Loaded {len(file_ids)} document IDs from file: {args.doc_ids_file}")
            except Exception as e:
                print(f"Error loading document IDs from file: {e}")
        
        # Remove duplicates while preserving order
        if doc_ids:
            seen = set()
            doc_ids = [x for x in doc_ids if not (x in seen or seen.add(x))]
            print(f"Processing {len(doc_ids)} unique document IDs")
        
        await extractor.update_specific_article_summaries(
            document_ids=doc_ids,
            public_figure_id=args.public_figure
        )
        print("\n=== Specific Event Contents Update Complete ===\n")


# Run the script when executed directly
if __name__ == "__main__":
    asyncio.run(main())