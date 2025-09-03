import asyncio
import os
from datetime import datetime
import pytz
from public_figure_extractor import PublicFigureExtractor
from setup_firebase_deepseek import NewsManager


class GroupMemberProcessor:
    def __init__(self):
        """Initialize the processor with Firebase and DeepSeek connections"""
        self.news_manager = NewsManager()
        # We'll use the research functionality from PublicFigureExtractor
        self.extractor = PublicFigureExtractor()
        
    async def process_group_members(self, dry_run=False):
        """
        Main function to process group members and create missing documents.
        
        Args:
            dry_run (bool): If True, only shows what would be done without making changes
        """
        try:
            print("=== Starting Group Member Processing ===\n")
            
            # Step 1: Get all group documents
            group_docs = await self._get_group_documents()
            if not group_docs:
                print("No group documents found.")
                return
                
            print(f"Found {len(group_docs)} group documents to process.\n")
            
            # Step 2: Extract all member names from groups
            all_member_names = await self._extract_member_names(group_docs)
            if not all_member_names:
                print("No member names found in any groups.")
                return
                
            print(f"Found {len(all_member_names)} unique member names across all groups.\n")
            
            # Step 3: Check which members already exist as documents
            existing_members, missing_members = await self._check_existing_members(all_member_names)
            
            print(f"Existing members: {len(existing_members)}")
            print(f"Missing members: {len(missing_members)}")
            
            if existing_members:
                print(f"Existing members: {', '.join(existing_members)}")
            if missing_members:
                print(f"Missing members: {', '.join(missing_members)}")
            print()
            
            # Step 4: Process missing members
            if missing_members:
                if dry_run:
                    print("=== DRY RUN MODE - No changes will be made ===")
                    print(f"Would create {len(missing_members)} new member documents:")
                    
                    # Enhanced dry-run: Check for potential overwrites
                    potential_overwrites = []
                    for member_name in missing_members:
                        doc_id = member_name.lower().replace(" ", "").replace("-", "").replace(".", "")
                        member_doc_ref = self.news_manager.db.collection("selected-figures").document(doc_id)
                        existing_doc = member_doc_ref.get()
                        
                        if existing_doc.exists:
                            existing_data = existing_doc.to_dict()
                            existing_name = existing_data.get("name", "")
                            potential_overwrites.append({
                                "member_name": member_name,
                                "doc_id": doc_id,
                                "existing_name": existing_name
                            })
                            print(f"  ⚠️  {member_name} (ID: {doc_id}) - WOULD OVERWRITE existing document for '{existing_name}'")
                        else:
                            print(f"  ✓ {member_name} (ID: {doc_id}) - New document")
                    
                    if potential_overwrites:
                        print(f"\n🚨 WARNING: {len(potential_overwrites)} potential overwrites detected!")
                        print("These existing documents would be replaced:")
                        for item in potential_overwrites:
                            print(f"  - ID '{item['doc_id']}': '{item['existing_name']}' → '{item['member_name']}'")
                        print("\nReview these carefully before running without --dry-run!")
                    else:
                        print(f"\n✅ All {len(missing_members)} members are safe to create (no overwrites)")
                        
                else:
                    print("=== Creating missing member documents ===")
                    await self._create_missing_member_documents(missing_members)
            else:
                print("All group members already exist as documents. No action needed.")
                
            print("\n=== Group Member Processing Complete ===")
            
        except Exception as e:
            print(f"Error during group member processing: {e}")
            raise
        finally:
            # Clean up connections
            await self.news_manager.close()
            await self.extractor.news_manager.close()
    
    async def _get_group_documents(self):
        """Get all documents where is_group is True"""
        try:
            print("Fetching group documents...")
            
            # Query for documents where is_group is True
            query = self.news_manager.db.collection("selected-figures").where(
                "is_group", "==", True
            )
            
            group_docs = []
            for doc in query.stream():
                doc_data = doc.to_dict()
                group_docs.append({
                    "id": doc.id,
                    "name": doc_data.get("name", "Unknown"),
                    "data": doc_data
                })
                
            print(f"Found {len(group_docs)} group documents.")
            
            # Show preview of found groups
            if group_docs:
                group_names = [doc["name"] for doc in group_docs]
                print(f"Groups found: {', '.join(group_names)}")
                
            return group_docs
            
        except Exception as e:
            print(f"Error fetching group documents: {e}")
            raise
    
    async def _extract_member_names(self, group_docs):
        """Extract all member names from group documents"""
        try:
            print("Extracting member names from groups...")
            
            all_member_names = set()  # Use set to avoid duplicates
            
            for group_doc in group_docs:
                group_name = group_doc["name"]
                group_data = group_doc["data"]
                members = group_data.get("members", [])
                
                print(f"Processing group: {group_name}")
                
                if not members:
                    print(f"  No members found in {group_name}")
                    continue
                    
                print(f"  Found {len(members)} members in {group_name}")
                
                for member in members:
                    if isinstance(member, dict) and "name" in member:
                        member_name = member["name"].strip()
                        if member_name:
                            all_member_names.add(member_name)
                            print(f"    - {member_name}")
                    else:
                        print(f"    Warning: Invalid member format in {group_name}: {member}")
                        
                print()  # Empty line for readability
                
            return list(all_member_names)
            
        except Exception as e:
            print(f"Error extracting member names: {e}")
            raise
    
    async def _check_existing_members(self, member_names):
        """Check which member names already exist as documents"""
        try:
            print("Checking which members already exist as documents...")
            
            existing_members = []
            missing_members = []
            
            # Get all document IDs and names in selected-figures collection
            existing_docs = self.news_manager.db.collection("selected-figures").stream()
            existing_doc_names = set()
            existing_doc_ids = set()
            doc_id_to_name = {}  # Map document IDs to actual names for safety checking
            
            # Create a mapping of document IDs to actual names
            for doc in existing_docs:
                doc_data = doc.to_dict()
                doc_name = doc_data.get("name", "")
                doc_id = doc.id
                
                if doc_name:
                    existing_doc_names.add(doc_name)
                    existing_doc_ids.add(doc_id)
                    doc_id_to_name[doc_id] = doc_name
            
            print(f"Found {len(existing_doc_names)} existing documents in selected-figures collection")
            
            # Check each member name with enhanced safety checks
            for member_name in member_names:
                # Check by exact name match first
                if member_name in existing_doc_names:
                    existing_members.append(member_name)
                    print(f"  ✓ Found existing document for '{member_name}' (exact name match)")
                else:
                    # Check by document ID to catch potential ID collisions
                    expected_doc_id = member_name.lower().replace(" ", "").replace("-", "").replace(".", "")
                    
                    if expected_doc_id in existing_doc_ids:
                        existing_name = doc_id_to_name.get(expected_doc_id, "Unknown")
                        print(f"  ⚠️  Document ID '{expected_doc_id}' exists for '{existing_name}' but member name is '{member_name}'")
                        
                        # Check if names are similar (case-insensitive, ignoring spaces/punctuation)
                        normalized_existing = existing_name.lower().replace(" ", "").replace("-", "").replace(".", "")
                        normalized_member = member_name.lower().replace(" ", "").replace("-", "").replace(".", "")
                        
                        if normalized_existing == normalized_member:
                            print(f"  ✓ Names are equivalent variants - treating as existing member")
                            existing_members.append(member_name)
                        else:
                            print(f"  🚨 POTENTIAL ID COLLISION: Different names with same ID!")
                            print(f"      Existing: '{existing_name}' → ID: '{expected_doc_id}'")
                            print(f"      New: '{member_name}' → ID: '{expected_doc_id}'")
                            # Treat as existing to prevent overwrite
                            existing_members.append(member_name)
                    else:
                        missing_members.append(member_name)
                        print(f"  - '{member_name}' not found - will be created")
                        
            return existing_members, missing_members
            
        except Exception as e:
            print(f"Error checking existing members: {e}")
            raise
    
    async def _create_missing_member_documents(self, missing_members):
        """Create documents for missing members using research_public_figure"""
        try:
            print(f"Creating {len(missing_members)} missing member documents...")
            
            created_count = 0
            failed_count = 0
            
            for i, member_name in enumerate(missing_members, 1):
                print(f"\nProcessing member {i}/{len(missing_members)}: {member_name}")
                
                try:
                    # Research the public figure using the extractor's method
                    print(f"  Researching information for {member_name}...")
                    
                    # The research_public_figure method in PublicFigureExtractor is not async
                    # but it uses an async client, so we need to handle this properly
                    try:
                        member_info = await self._research_public_figure_async(member_name)
                        
                        # Check if research returned meaningful data
                        if not member_info or not self._is_valid_research_result(member_info):
                            print(f"  ✗ Research failed or returned insufficient data for {member_name}. Skipping document creation.")
                            failed_count += 1
                            continue
                            
                    except Exception as research_error:
                        print(f"  ✗ Error during research for {member_name}: {research_error}")
                        print(f"  Skipping document creation for {member_name} due to research failure.")
                        failed_count += 1
                        continue
                    
                    # Create document ID (same logic as in the original script)
                    doc_id = member_name.lower().replace(" ", "").replace("-", "").replace(".", "")
                    
                    # SAFETY CHECK: Verify the document doesn't already exist
                    member_doc_ref = self.news_manager.db.collection("selected-figures").document(doc_id)
                    existing_doc = member_doc_ref.get()
                    
                    if existing_doc.exists:
                        existing_data = existing_doc.to_dict()
                        existing_name = existing_data.get("name", "")
                        print(f"  ⚠️  SAFETY ALERT: Document with ID '{doc_id}' already exists!")
                        print(f"      Existing document name: '{existing_name}'")
                        print(f"      Trying to create for: '{member_name}'")
                        
                        # Additional safety check: verify names match
                        if existing_name.lower().strip() == member_name.lower().strip():
                            print(f"  ℹ️  Names match. Document for {member_name} already exists. Skipping creation.")
                        else:
                            print(f"  🚨 CRITICAL: Name mismatch! Existing='{existing_name}' vs New='{member_name}'")
                            print(f"  🚨 This could be a different person with the same document ID!")
                            print(f"  🚨 SKIPPING to prevent data overwrite!")
                        
                        # Always skip if document exists, regardless of name match
                        print(f"  → Skipping document creation to prevent overwriting existing data")
                        continue
                    
                    # Prepare document data
                    member_data = {
                        "name": member_name,
                        "sources": [],  # Start with empty sources
                        "lastUpdated": datetime.now(pytz.timezone('Asia/Seoul')).strftime("%Y-%m-%d"),
                        "created_from_group_processing": True,  # Flag to indicate how this was created
                        **member_info  # Unpack all researched info
                    }
                    
                    # Additional safety: Log what we're about to create
                    print(f"  📝 About to create document for '{member_name}' with ID '{doc_id}'")
                    print(f"      Data summary: gender='{member_data.get('gender', '')}', occupation={member_data.get('occupation', [])}, nationality='{member_data.get('nationality', '')}'")
                    
                    # Create the document (using set since we've verified it doesn't exist)
                    member_doc_ref.set(member_data)
                    
                    print(f"  ✓ Successfully created document for {member_name} (ID: {doc_id})")
                    created_count += 1
                    
                except Exception as e:
                    print(f"  ✗ Failed to create document for {member_name}: {e}")
                    failed_count += 1
                    continue
            
            print(f"\n=== Creation Summary ===")
            print(f"Successfully created: {created_count}")
            print(f"Failed to create: {failed_count}")
            print(f"Total processed: {len(missing_members)}")
            
        except Exception as e:
            print(f"Error creating missing member documents: {e}")
            raise

    async def _research_public_figure_async(self, name):
        """
        Research a public figure using the async DeepSeek client.
        This is a corrected version of the research_public_figure method that properly awaits the API call.
        """
        # Using the same comprehensive prompt as in the original script
        prompt = f"""
        Provide detailed information about the public figure named "{name}".
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
        
        CRITICAL INSTRUCTIONS:
        1. ONLY provide a Korean name (name_kr) if the person or group is actually Korean. For non-Korean public figures, name_kr MUST be an empty string.
        2. For individual public figures who are not Korean, leave name_kr as an empty string.
        3. For group members, ALWAYS include their official name as "name" and their birth name as "real_name" if different.
        4. Make sure the data returned is specifically about "{name}" and not a different public figure or group.
        5. For any field where information is uncertain or unknown, provide an empty string ("") or empty array ([]) as appropriate.
        6. For lastUpdated, use the current date in Korea (UTC+9) in format "YYYY-MM-DD".
        7. For URLs, provide complete URLs (including https://) or empty strings.
        8. Be extremely careful to only include Korean names (name_kr) for Korean public figures, never for non-Korean public figures.
        """
        
        try:
            # Use await with the async client
            response = await self.news_manager.client.chat.completions.create(
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
            import re
            import json
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
                
            # Ensure all required fields exist with default values if not present
            required_fields = {
                "gender": "", 
                "occupation": [], 
                "nationality": "",
                "name_kr": "", 
                "is_group": False,
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
            
            # Add missing fields with default values
            for field, default_value in required_fields.items():
                if field not in data:
                    data[field] = default_value
                    print(f"Adding missing field '{field}' with default value")
                
            # For groups, ensure members have correct data format
            if data.get("is_group", False) and "members" in data and isinstance(data["members"], list):
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
                    member_is_korean = is_korean  # Assume group members share nationality with the group
                    if "nationality" in member:
                        member_is_korean = "korean" in member["nationality"].lower() or "south korea" in member["nationality"].lower()
                    
                    # If member is not Korean, clear Korean name
                    if not member_is_korean and "name_kr" in member:
                        print(f"FIXING: Member {member.get('name')} is not Korean but had Korean name. Removing.")
                        data["members"][i]["name_kr"] = ""
                    
                    # Add missing fields with default values for each member
                    for field, default_value in member_required_fields.items():
                        if field not in member:
                            data["members"][i][field] = default_value
            
            print(f"Validated data for {name}, is_korean={is_korean}")
            return data
            
        except Exception as e:
            print(f"Error researching public figure {name}: {e}")
            return {
                "gender": "", 
                "occupation": [], 
                "nationality": "", 
                "name_kr": "", 
                "is_group": False,
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

    def _is_valid_research_result(self, research_data):
        """
        Check if the research result contains meaningful information.
        Returns True if the data is valid enough to create a document, False otherwise.
        """
        if not research_data or not isinstance(research_data, dict):
            return False
        
        # Check if we have at least some basic identifying information
        # At minimum, we should have either gender, occupation, or nationality
        meaningful_fields = [
            research_data.get("gender", ""),
            research_data.get("occupation", []),
            research_data.get("nationality", ""),
            research_data.get("company", ""),
            research_data.get("group", "")
        ]
        
        # Check if any of these fields have meaningful data
        has_meaningful_data = False
        
        # Check gender
        if research_data.get("gender", "") and research_data.get("gender") not in ["", "Unknown"]:
            has_meaningful_data = True
        
        # Check occupation
        if research_data.get("occupation", []) and len(research_data.get("occupation", [])) > 0:
            # Make sure it's not just empty strings
            occupations = [occ for occ in research_data.get("occupation", []) if occ and occ.strip()]
            if occupations:
                has_meaningful_data = True
        
        # Check nationality
        if research_data.get("nationality", "") and research_data.get("nationality") not in ["", "Unknown"]:
            has_meaningful_data = True
        
        # Check company
        if research_data.get("company", "") and research_data.get("company") not in ["", "Unknown"]:
            has_meaningful_data = True
        
        # Check group
        if research_data.get("group", "") and research_data.get("group") not in ["", "Unknown"]:
            has_meaningful_data = True
        
        if has_meaningful_data:
            print(f"  Research data validation: PASSED - Found meaningful information")
            return True
        else:
            print(f"  Research data validation: FAILED - No meaningful information found")
            print(f"  Data received: gender='{research_data.get('gender', '')}', occupation={research_data.get('occupation', [])}, nationality='{research_data.get('nationality', '')}', company='{research_data.get('company', '')}', group='{research_data.get('group', '')}'")
            return False


async def main():
    """Main function to run the group member processor"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Process group members and create missing documents')
    parser.add_argument('--dry-run', action='store_true', 
                        help='Run in dry-run mode (show what would be done without making changes)')
    
    args = parser.parse_args()
    
    # Create and run the processor
    processor = GroupMemberProcessor()
    await processor.process_group_members(dry_run=args.dry_run)


if __name__ == "__main__":
    # Example usage:
    # python group_member_processor.py              # Run normally
    # python group_member_processor.py --dry-run    # Run in dry-run mode
    asyncio.run(main())