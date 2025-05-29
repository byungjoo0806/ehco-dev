import pandas as pd
import os
from setup_firebase_deepseek import NewsManager
from typing import Dict, List
import sys

class ProfilePicUpdater:
    def __init__(self):
        """Initialize the ProfilePicUpdater with Firebase connection"""
        try:
            self.news_manager = NewsManager()
            self.db = self.news_manager.db
            print("✓ Firebase connection established")
        except Exception as e:
            print(f"❌ Failed to initialize Firebase: {e}")
            sys.exit(1)
    
    def read_csv_file(self, csv_path: str) -> pd.DataFrame:
        """Read the CSV file and return a pandas DataFrame"""
        try:
            if not os.path.exists(csv_path):
                raise FileNotFoundError(f"CSV file not found: {csv_path}")
            
            # Read CSV file
            df = pd.read_csv(csv_path)
            print(f"✓ CSV file loaded successfully with {len(df)} rows")
            
            # Display column names to understand structure
            print(f"Column names: {list(df.columns)}")
            
            # Display first few rows for verification
            print("\nFirst 5 rows:")
            print(df.head())
            
            return df
            
        except Exception as e:
            print(f"❌ Error reading CSV file: {e}")
            raise
    
    def process_csv_data(self, df: pd.DataFrame) -> List[Dict]:
        """Process CSV data to extract document ID and profile pic URL pairs"""
        try:
            # Get column names
            columns = list(df.columns)
            
            # First column contains document IDs, second column contains image URLs
            doc_id_column = columns[0]
            image_url_column = columns[1]
            
            print(f"Using '{doc_id_column}' as document ID and '{image_url_column}' as image URL field")
            
            # Create list of dictionaries with document ID and image URL
            profile_data = []
            for index, row in df.iterrows():
                doc_id = str(row[doc_id_column]).strip()
                image_url = str(row[image_url_column]).strip()
                
                # Skip empty rows
                if pd.isna(row[doc_id_column]) or pd.isna(row[image_url_column]):
                    continue
                
                if doc_id and image_url:
                    profile_data.append({
                        'doc_id': doc_id,
                        'profilePic': image_url
                    })
            
            print(f"✓ Processed {len(profile_data)} valid records")
            return profile_data
            
        except Exception as e:
            print(f"❌ Error processing CSV data: {e}")
            raise
    
    def update_firestore_documents(self, profile_data: List[Dict], dry_run: bool = True):
        """Update Firestore documents with profile picture URLs using document IDs"""
        try:
            collection_ref = self.db.collection('selected-figures')
            
            updated_count = 0
            not_found_count = 0
            error_count = 0
            
            print(f"\n{'DRY RUN: ' if dry_run else ''}Starting to update documents...")
            print("-" * 50)
            
            for item in profile_data:
                doc_id = item['doc_id']  # The document ID from the first column
                profile_pic_url = item['profilePic']
                
                try:
                    # Get document reference by ID
                    doc_ref = collection_ref.document(doc_id)
                    
                    # Check if document exists
                    doc = doc_ref.get()
                    
                    if doc.exists:
                        if not dry_run:
                            # Update the document with the profile picture URL
                            doc_ref.update({
                                'profilePic': profile_pic_url
                            })
                        
                        print(f"{'[DRY RUN] ' if dry_run else ''}✓ Updated document '{doc_id}' with profilePic")
                        print(f"    URL: {profile_pic_url[:80]}{'...' if len(profile_pic_url) > 80 else ''}")
                        updated_count += 1
                    else:
                        print(f"⚠️  Document with ID '{doc_id}' not found in 'selected-figures' collection")
                        not_found_count += 1
                        
                except Exception as e:
                    print(f"❌ Error updating document '{doc_id}': {e}")
                    error_count += 1
            
            # Summary
            print("-" * 50)
            print(f"{'DRY RUN ' if dry_run else ''}SUMMARY:")
            print(f"✓ Successfully updated: {updated_count}")
            print(f"⚠️  Not found: {not_found_count}")
            print(f"❌ Errors: {error_count}")
            
            if dry_run:
                print("\nThis was a dry run. To actually update the database, run with dry_run=False")
            
        except Exception as e:
            print(f"❌ Error updating Firestore documents: {e}")
            raise
    
    def run_update(self, csv_path: str, dry_run: bool = True):
        """Main method to run the complete update process"""
        try:
            print("Starting Profile Picture Update Process")
            print("=" * 50)
            
            # Step 1: Read CSV file
            df = self.read_csv_file(csv_path)
            
            # Step 2: Process CSV data
            profile_data = self.process_csv_data(df)
            
            # Step 3: Update Firestore documents
            self.update_firestore_documents(profile_data, dry_run=dry_run)
            
            print(f"\n{'DRY RUN ' if dry_run else ''}Process completed successfully!")
            
        except Exception as e:
            print(f"❌ Process failed: {e}")
            raise

def main():
    """Main function to run the profile picture updater"""
    # Path to your CSV file
    csv_file_path = "selected_figures_profilepic.csv"
    
    # Initialize updater
    updater = ProfilePicUpdater()
    
    # First, run a dry run to see what would be updated
    print("Running DRY RUN first...")
    updater.run_update(csv_file_path, dry_run=True)
    
    # Ask user if they want to proceed with actual update
    print("\n" + "="*50)
    response = input("Do you want to proceed with the actual update? (y/N): ").strip().lower()
    
    if response in ['y', 'yes']:
        print("\nProceeding with actual update...")
        updater.run_update(csv_file_path, dry_run=False)
    else:
        print("Update cancelled.")

if __name__ == "__main__":
    main()
