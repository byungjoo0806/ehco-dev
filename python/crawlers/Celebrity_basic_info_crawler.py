import firebase_admin
from firebase_admin import credentials, firestore
from anthropic import Anthropic
from dotenv import load_dotenv
import os
import asyncio
import json
from datetime import datetime
from typing import Dict, Optional
import aiohttp

class ImageValidator:
    def __init__(self):
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def validate_image_url(self, url: str) -> bool:
        """
        Validate if an image URL is accessible and returns an image
        """
        if not url or url == "":
            return False
            
        try:
            async with self.session.head(url, allow_redirects=True) as response:
                if response.status != 200:
                    return False
                    
                # Check if content-type is an image
                content_type = response.headers.get('content-type', '')
                return content_type.startswith('image/')
                
        except Exception as e:
            print(f"Error validating image URL {url}: {e}")
            return False

class BasicInfoCrawler:
    def __init__(self):
        print("Initializing crawler...")
        self.setup_anthropic()
        self.db = self.setup_firebase()
        print("Crawler initialized successfully!")
    
    def setup_anthropic(self):
        print("Setting up Anthropic API...")
        load_dotenv()
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")
        self.client = Anthropic(api_key=api_key)
        self.model = "cclaude-3-7-sonnet-20250219"
        print("Anthropic API setup complete")
        
    def setup_firebase(self):
        """Initialize Firebase with environment variables and connect to default database"""
        print("Setting up Firebase connection...")
        load_dotenv()

        try:
            # Get configuration from environment variables
            config_path = os.getenv("FIREBASE_CONFIG_PATH")
            database_url = os.getenv("FIREBASE_DEFAULT_DATABASE_URL")  # Use your env variable name here
            
            if not config_path:
                raise ValueError("FIREBASE_CONFIG_PATH not found in environment variables")
            if not database_url:
                raise ValueError("FIREBASE_DATABASE_URL not found in environment variables")
            if not os.path.exists(config_path):
                raise FileNotFoundError(f"Service account key not found at: {config_path}")

            try:
                # Initialize Firebase app with database URL
                cred = credentials.Certificate(config_path)
                firebase_admin.initialize_app(cred, {
                    'databaseURL': database_url
                })
                print(f"Firebase initialized successfully with database URL: {database_url}")
            except ValueError as e:
                if "The default Firebase app already exists" in str(e):
                    print("Using existing Firebase app")
                else:
                    raise e

            # Get Firestore client
            db = firestore.client()
            print("Firestore client connected successfully")
            return db

        except Exception as e:
            print(f"Failed to initialize Firebase: {e}")
            raise
    
    async def get_celebrity_info(self, celebrity: Dict[str, str]) -> Dict[str, any]:
        """
        Fetch detailed information about a celebrity using Claude
        """
        print(f"\nFetching information for celebrity: {celebrity['name_eng']}...")
        prompt = self._create_celebrity_prompt(celebrity)
        
        try:
            print("Sending request to Claude API...")
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                temperature=0,
                system="You are a helpful assistant that provides accurate information about celebrities. Always respond in the exact JSON format requested, with null for unknown values. Do not include explanations or additional text.",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            print("Response received from Claude API")
            
            # Parse and validate the response
            data = self._parse_celebrity_response(response.content[0].text)
            
            # Ensure sex field is included from input if not provided by Claude
            if data and not data.get('gender'):
                data['gender'] = celebrity.get('gender', '')
                
            return data
            
        except Exception as e:
            print(f"Error getting celebrity info for {celebrity['name_eng']}: {e}")
            return None   
        
    async def get_celebrity_info_with_retry(self, celebrity: Dict[str, str], max_image_retries: int = 3) -> Dict[str, any]:
        """
        Fetch celebrity information with image validation and retry logic
        """
        print(f"\nFetching information for celebrity: {celebrity['name_eng']}...")
        
        # First attempt
        info = await self.get_celebrity_info(celebrity)
        if not info:
            return None

        # Validate initial profile picture
        async with ImageValidator() as validator:
            if info.get('profilePic'):
                is_valid = await validator.validate_image_url(info['profilePic'])
                if is_valid:
                    return info

            # Retry with explicit requests for new images
            retry_count = 0
            while retry_count < max_image_retries:
                retry_count += 1
                print(f"\nRetrying with new image request (attempt {retry_count}/{max_image_retries})...")
                
                # Create new prompt requesting a different image
                prompt = self._create_celebrity_prompt(celebrity, request_new_image=True)
                
                try:
                    response = self.client.messages.create(
                        model=self.model,
                        max_tokens=1024,
                        temperature=0,
                        system="You are a helpful assistant that provides accurate information about celebrities. Always respond in the exact JSON format requested, with null for unknown values. Do not include explanations or additional text.",
                        messages=[
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ]
                    )
                    
                    new_info = self._parse_celebrity_response(response.content[0].text)
                    if not new_info:
                        continue

                    # Validate new profile picture
                    if new_info.get('profilePic'):
                        is_valid = await validator.validate_image_url(new_info['profilePic'])
                        if is_valid:
                            # Merge new valid image URL with original data
                            info['profilePic'] = new_info['profilePic']
                            print("✅ Found valid alternative profile picture")
                            return info
                    
                    print(f"❌ Attempt {retry_count} failed to find valid image")
                
                except Exception as e:
                    print(f"Error during retry {retry_count}: {e}")
                    continue

            print(f"⚠️ Failed to find valid profile picture after {max_image_retries} attempts")
            info['profilePic'] = ""  # Reset to empty string after all retries failed
            return info
    
    def _create_celebrity_prompt(self, celebrity: Dict[str, str], request_new_image: bool = False) -> str:
        """
        Create a structured prompt for getting celebrity information
        """
        base_prompt = f"""Please provide detailed information about the celebrity below in JSON format.
        
Celebrity Details:
- English Name: {celebrity['name_eng']}
- Korean Name: {celebrity['name_kr']}
- Gender: {celebrity['gender']}

Return the information in the following JSON format, using empty strings ("") for any unknown values:
{{
    "birthDate": "YYYY-MM-DD",
    "chineseZodiac": "",
    "company": "",
    "debutDate": "YYYY-MM-DD : [debut work title]",
    "gender": "",
    "group": "",
    "koreanName": "",
    "name": "",
    "nationality": "",
    "occupation": [""],
    "school": [""],
    "zodiacSign": "",
    "profilePic": "",
    "instagramUrl": "",
    "youtubeUrl": "",
    "spotifyUrl": ""
}}
"""

        if request_new_image:
            base_prompt += """
IMPORTANT: Please provide a different profile picture URL than previously provided. 
The URL should be to a high-quality, official or professional headshot of the celebrity.
Preferred sources include:
- Official agency websites
- Official social media accounts
- Professional photo agencies
- Recent press photos
"""

        base_prompt += """
Please ensure:
1. Dates are in YYYY-MM-DD format or empty string if unknown
2. All URLs are complete (including https://) or empty string if unknown
3. Korean name uses proper Hangul characters
4. Occupation and school are arrays (use [""] if unknown)
5. Chinese zodiac and zodiac sign use standard English names
6. Profile picture URL should be to a high-quality headshot if available
7. Use empty strings ("") instead of null for unknown values
8. For debutDate, use format "YYYY-MM-DD : [work title]"
9. Gender should be "Male", "Female", or "" if unknown

Only return the JSON object, no additional text or explanation."""
        return base_prompt

    def _parse_celebrity_response(self, response: str) -> Dict[str, any]:
        """
        Parse and validate the response from Claude and ensure proper date handling
        """
        print("Parsing Claude's response...")
        try:
            # Clean the response if needed (remove markdown, etc)
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:-3]
            
            data = json.loads(cleaned_response)
            
            # Convert any null values to empty strings
            for key, value in data.items():
                if value is None:
                    data[key] = ""
                elif isinstance(value, list) and (not value or value[0] is None):
                    data[key] = [""]
                elif isinstance(value, dict):
                    for subkey, subvalue in value.items():
                        if subvalue is None:
                            value[subkey] = ""
            
            # Basic validation
            required_fields = ["name", "koreanName", "nationality", "occupation", "gender"]
            missing_fields = []
            for field in required_fields:
                if not data.get(field):
                    missing_fields.append(field)
                    data[field] = "" if field != "occupation" else [""]
            
            if missing_fields:
                print(f"⚠️ Warning: Missing required fields (set to empty): {', '.join(missing_fields)}")
            else:
                print("✅ All required fields present")
            
            return data
            
        except json.JSONDecodeError as e:
            print(f"Error parsing response: {e}")
            return None
    
    async def _validate_and_update_profile_pic(self, celebrity_data: dict) -> dict:
        """
        Validate the profile picture URL and update the data accordingly
        """
        if not celebrity_data.get('profilePic'):
            return celebrity_data
            
        async with ImageValidator() as validator:
            is_valid = await validator.validate_image_url(celebrity_data['profilePic'])
            if not is_valid:
                print(f"⚠️ Invalid profile picture URL: {celebrity_data['profilePic']}")
                celebrity_data['profilePic'] = ""  # Reset to empty string if invalid
            else:
                print("✅ Profile picture URL validated successfully")
                
        return celebrity_data
    
    async def save_to_firebase(self, celebrity_data: Dict[str, any]) -> bool:
        """
        Save the celebrity data to Firebase after validating the profile picture URL
        """
        print(f"\nSaving data for {celebrity_data.get('name', 'unknown')} to Firebase...")
        try:
            # Validate profile picture URL
            celebrity_data = await self._validate_and_update_profile_pic(celebrity_data)
            
            # Create document ID from name (remove spaces and make lowercase)
            doc_id = celebrity_data['name'].replace(" ", "").replace("-", "").lower()
            print(f"Creating document with ID: {doc_id}")
            
            # Convert birthDate string to Firestore Timestamp if it exists
            if celebrity_data.get('birthDate'):
                try:
                    celebrity_data['birthDate'] = datetime.strptime(celebrity_data['birthDate'], '%Y-%m-%d')
                except ValueError as e:
                    print(f"Error converting birthDate: {e}")
                    celebrity_data.pop('birthDate', None)
                    
            # Handle debutDate - keep as string since it includes the work title
            if not celebrity_data.get('debutDate'):
                celebrity_data['debutDate'] = ""
            
            collection = self.db.collection('celebrities')
            doc_ref = collection.document(doc_id)
            
            # Add metadata
            celebrity_data['lastUpdated'] = datetime.utcnow()
            
            doc_ref.set(celebrity_data, merge=True)
            print("✅ Data saved successfully to Firebase")
            return True
            
        except Exception as e:
            print(f"Error saving to Firebase: {e}")
            return False
    
async def main():
    print("\n=== Celebrity Information Crawler Starting ===\n")
    crawler = BasicInfoCrawler()
    
    # Example celebrity
    celebrity = {
        "name_eng": "Lee Jung-jae",
        "name_kr": "이정재",
        "gender": "Male"
    }
    
    # Get and save celebrity info with image retry logic
    info = await crawler.get_celebrity_info_with_retry(celebrity, max_image_retries=3)
    if info:
        print("\nRetrieved information:")
        print(json.dumps(info, indent=2, ensure_ascii=False))
        success = await crawler.save_to_firebase(info)
        print(f"\nFinal status: {'✅ Success' if success else '❌ Failed'}")
    else:
        print("Failed to get celebrity info")
    
    print("\n=== Crawler Process Complete ===\n")

if __name__ == "__main__":
    asyncio.run(main())