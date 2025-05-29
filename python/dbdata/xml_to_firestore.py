# Batch processing of XML files for Firestore upload
# pip install firebase-admin lxml

import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import xml.etree.ElementTree as ET
from datetime import datetime
import os
import glob

def construct_link(content_id):
    """
    Construct the link using the specified format:
    https://www.yna.co.kr/view/[contentId]?input=feed_ehco
    
    This is a fallback if the direct link is not available in the XML.
    """
    if not content_id:
        return None
    
    return f"https://www.yna.co.kr/view/{content_id}?input=feed_ehco"

def extract_subtitle_from_body(title, body):
    """
    Extract subtitle from body text when a separate subtitle tag is missing.
    Pattern observed:
    - First line of body is the title
    - Second line is the subtitle
    - The rest is the actual body content
    """
    if not body:
        return "", body
    
    # Split the body into lines
    lines = body.strip().split('\n')
    
    # Need at least 3 lines to extract subtitle (title, subtitle, content)
    if len(lines) < 3:
        return "", body
    
    # First line should match the title (or be very similar)
    first_line = lines[0].strip()
    
    # If first line is similar to title, assume second line is subtitle
    if first_line == title.strip() or first_line.lower() == title.strip().lower():
        subtitle = lines[1].strip()
        # Reconstruct body without the subtitle line
        new_body = '\n'.join([lines[0]] + lines[2:])
        return subtitle, new_body
    
    return "", body

def parse_xml_to_dict(xml_file_path):
    """Parse XML file and convert to dictionary structure suitable for Firestore."""
    try:
        tree = ET.parse(xml_file_path)
        root = tree.getroot()
        
        # Extract Header information
        header = root.find('Header')
        content_id = header.find('ContentID').text if header.find('ContentID') is not None else "unknown"
        send_date = header.find('SendDate').text if header.find('SendDate') is not None else ""
        send_time = header.find('SendTime').text if header.find('SendTime') is not None else ""
        
        # Extract Metadata
        metadata = root.find('Metadata')
        urgency = metadata.find('Urgency').text if metadata.find('Urgency') is not None else ""
        
        category = metadata.find('Category')
        category_code = category.get('code') if category is not None else ""
        category_name = category.get('name') if category is not None and category.get('name') else ""
        
        # Handle nested elements carefully
        class_code = ""
        class_name = ""
        class_path = metadata.find('Class')
        if class_path is not None:
            class_elem = class_path.find('ClassCode')
            if class_elem is not None:
                class_code = class_elem.get('code') if class_elem.get('code') is not None else ""
                class_name = class_elem.get('name') if class_elem.get('name') is not None else ""
        
        attribute_code = ""
        attribute_name = ""
        attribute_path = metadata.find('Attribute')
        if attribute_path is not None:
            attribute_elem = attribute_path.find('AttributeCode')
            if attribute_elem is not None:
                attribute_code = attribute_elem.get('code') if attribute_elem.get('code') is not None else ""
                attribute_name = attribute_elem.get('name') if attribute_elem.get('name') is not None else ""
        
        credit = metadata.find('Credit').text if metadata.find('Credit') is not None else ""
        source = "Yonhap News Agency"  # Fixed source as requested
        
        writer_elem = metadata.find('Writer')
        writer = writer_elem.text if writer_elem is not None else ""
        
        # Get direct link from the <Href> tag in Metadata (new format)
        link_elem = metadata.find('Href')
        link = link_elem.text if link_elem is not None else construct_link(content_id)
        
        desk_elem = metadata.find('Desk')
        desk_code = desk_elem.get('code') if desk_elem is not None else ""
        desk_name = desk_elem.text if desk_elem is not None else ""
        
        # Extract News Content
        news_content = root.find('NewsContent')
        lang_type = news_content.find('LangType').text if news_content.find('LangType') is not None else ""
        title = news_content.find('Title').text if news_content.find('Title') is not None else ""
        
        # Check if SubTitle exists, if not try to extract from Body
        subtitle_elem = news_content.find('SubTitle')
        body_elem = news_content.find('Body')
        
        if subtitle_elem is not None:
            subtitle = subtitle_elem.text if subtitle_elem.text is not None else ""
            body = body_elem.text if body_elem is not None and body_elem.text is not None else ""
        else:
            # SubTitle tag is missing, try to extract from Body
            body = body_elem.text if body_elem is not None and body_elem.text is not None else ""
            extracted_subtitle, new_body = extract_subtitle_from_body(title, body)
            subtitle = extracted_subtitle
            # Only update body if we successfully extracted a subtitle
            if subtitle:
                body = new_body
        
        # Extract Image data if available - now as arrays
        image_captions = []
        image_file_names = []
        image_urls = []
        
        # Find all AppendData elements
        append_data_elements = news_content.findall('AppendData')
        for append_data in append_data_elements:
            if append_data is not None:
                caption = append_data.find('Caption')
                file_name = append_data.find('FileName')
                href = append_data.find('Href')
                
                if caption is not None:
                    image_captions.append(caption.text)
                if file_name is not None:
                    image_file_names.append(file_name.text)
                if href is not None:
                    image_urls.append(href.text)
        
        # Create news data dictionary
        news_data = {
            # Header info
            'contentID': content_id,
            'sendDate': send_date,
            'sendTime': send_time,
            
            # Link to article
            'link': link,
            
            # Metadata
            'urgency': urgency,
            'category': category_name,
            'categoryCode': category_code,
            'classCode': class_code,
            'className': class_name,
            'attributeCode': attribute_code,
            'attributeName': attribute_name,
            'credit': credit,
            'source': source,
            'writer': writer,
            'desk': desk_name,
            'deskCode': desk_code,
            
            # News Content
            'language': lang_type,
            'title': title,
            'subTitle': subtitle,
            'body': body,
            
            # Image data as arrays
            'imageCaptions': image_captions,
            'imageFileNames': image_file_names,
            'imageUrls': image_urls,
            
            # File metadata
            'originalFilename': os.path.basename(xml_file_path),
            'createdAt': datetime.now()
        }
        
        return news_data
    except Exception as e:
        print(f"Error parsing {xml_file_path}: {str(e)}")
        return None

def find_all_xml_files(base_directory):
    """
    Recursively find all XML files in the base directory and its subdirectories.
    Returns a list of full paths to XML files.
    """
    xml_files = []
    
    # Walk through all directories starting from base_directory
    for root, dirs, files in os.walk(base_directory):
        # Find XML files in current directory
        for file in files:
            if file.lower().endswith('.xml'):
                full_path = os.path.join(root, file)
                xml_files.append(full_path)
    
    print(f"Found {len(xml_files)} XML files across all directories")
    return xml_files

def batch_process_xml_files(base_directory, db):
    """Process all XML files in a directory and its subdirectories, and upload to Firestore."""
    # Get all XML files recursively
    xml_files = find_all_xml_files(base_directory)
    
    # Create a local directory for parsed data (for debugging and backup)
    parsed_dir = os.path.join(base_directory, "parsed_data")
    if not os.path.exists(parsed_dir):
        os.makedirs(parsed_dir)
    
    # Process each file
    successful_count = 0
    failed_count = 0
    
    for xml_file in xml_files:
        try:
            print(f"Processing {xml_file}...")
            news_data = parse_xml_to_dict(xml_file)
            
            if news_data:
                # Save parsed data locally before attempting Firestore upload
                content_id = news_data['contentID']
                local_file = os.path.join(parsed_dir, f"{content_id}.txt")
                with open(local_file, 'w', encoding='utf-8') as f:
                    for key, value in news_data.items():
                        f.write(f"{key}: {value}\n")
                print(f"Saved parsed data locally to {local_file}")
                
                # Try to upload to Firestore with retry mechanism
                max_retries = 3
                retry_delay = 5  # seconds
                for attempt in range(max_retries):
                    try:
                        # Upload to Firestore
                        doc_ref = db.collection('newsArticles').document(content_id)
                        doc_ref.set(news_data)
                        print(f"Successfully uploaded article: {content_id} with link: {news_data['link']}")
                        
                        # Create a "processed" directory in the SAME directory as the original file
                        original_dir = os.path.dirname(xml_file)
                        processed_dir = os.path.join(original_dir, "processed")
                        if not os.path.exists(processed_dir):
                            os.makedirs(processed_dir)
                            
                        # Move the file to the processed directory within its original directory
                        processed_file = os.path.join(processed_dir, os.path.basename(xml_file))
                        os.rename(xml_file, processed_file)
                        print(f"Moved {xml_file} to {processed_file}")
                        
                        successful_count += 1
                        break  # Success, exit retry loop
                        
                    except Exception as e:
                        if attempt < max_retries - 1:
                            print(f"Firestore upload attempt {attempt+1} failed: {str(e)}. Retrying in {retry_delay} seconds...")
                            import time
                            time.sleep(retry_delay)
                        else:
                            print(f"All {max_retries} upload attempts failed for {content_id}. File will be kept in original location.")
                            failed_count += 1
                            raise  # Re-raise to be caught by the outer exception handler
            else:
                print(f"Skipping {xml_file} due to parsing failure")
                failed_count += 1
        except Exception as e:
            print(f"Error processing {xml_file}: {str(e)}")
            failed_count += 1
    
    print(f"\nProcessing complete. Summary:")
    print(f"Total XML files found: {len(xml_files)}")
    print(f"Successfully processed: {successful_count}")
    print(f"Failed to process: {failed_count}")
    print(f"Parsed data saved to: {parsed_dir}")

def main():
    try:
        # Initialize Firebase with increased timeout
        cred = credentials.Certificate("/Users/byungjoopark/Desktop/Coding/ehco-dev/firebase/config/serviceAccountKey.json")
        firebase_admin.initialize_app(cred, {
            'httpTimeout': 120,  # Increase timeout to 120 seconds
        })
        db = firestore.client()
        
        # Parse command line arguments
        import argparse
        parser = argparse.ArgumentParser(description='Process XML files and upload to Firestore')
        parser.add_argument('--validate', action='store_true', 
                            help='Run in validation mode (parse XML but do not upload to Firestore)')
        parser.add_argument('--dir', type=str, default='/Users/byungjoopark/Desktop/Coding/yna-db',
                            help='Base directory containing XML files or folders with XML files')
        parser.add_argument('--limit', type=int, default=0,
                            help='Limit the number of files to process (0 means no limit)')
        args = parser.parse_args()
        
        base_directory = args.dir
        print(f"Using base directory: {base_directory}")
        
        if args.validate:
            print("Running in validation mode - will parse XML files but not upload to Firestore")
            # Find all XML files recursively
            xml_files = find_all_xml_files(base_directory)
            
            # Apply limit if specified
            if args.limit > 0:
                print(f"Limiting validation to {args.limit} files")
                xml_files = xml_files[:args.limit]
            
            # Just parse the files without uploading
            for xml_file in xml_files:
                print(f"Validating {xml_file}...")
                try:
                    data = parse_xml_to_dict(xml_file)
                    if data:
                        print(f"Successfully parsed {xml_file}")
                        # Print some key data points for verification
                        print(f"Title: {data['title']}")
                        print(f"Subtitle: {data['subTitle']}")
                        print(f"Content ID: {data['contentID']}")
                        print(f"Link: {data['link']}")
                        print(f"Images: {len(data['imageUrls'])}")
                        print("-" * 50)
                    else:
                        print(f"Failed to parse {xml_file}")
                except Exception as e:
                    print(f"Error validating {xml_file}: {str(e)}")
        else:
            # Normal processing mode
            print("Running in normal mode - will upload to Firestore")
            
            # Apply limit if specified
            if args.limit > 0:
                print(f"Limiting processing to {args.limit} files")
                xml_files = find_all_xml_files(base_directory)[:args.limit]
                batch_process_specific_files(xml_files, db, base_directory)
            else:
                batch_process_xml_files(base_directory, db)
    
    except Exception as e:
        print(f"Error in main program: {str(e)}")
        print("If you're having trouble connecting to Firestore, try running with --validate to check XML parsing")

def batch_process_specific_files(xml_files, db, base_directory):
    """Process a specific list of XML files and upload to Firestore."""
    # Create a local directory for parsed data (for debugging and backup)
    parsed_dir = os.path.join(base_directory, "parsed_data")
    if not os.path.exists(parsed_dir):
        os.makedirs(parsed_dir)
    
    # Process each file
    successful_count = 0
    failed_count = 0
    
    for xml_file in xml_files:
        try:
            print(f"Processing {xml_file}...")
            news_data = parse_xml_to_dict(xml_file)
            
            if news_data:
                # Save parsed data locally before attempting Firestore upload
                content_id = news_data['contentID']
                local_file = os.path.join(parsed_dir, f"{content_id}.txt")
                with open(local_file, 'w', encoding='utf-8') as f:
                    for key, value in news_data.items():
                        f.write(f"{key}: {value}\n")
                print(f"Saved parsed data locally to {local_file}")
                
                # Try to upload to Firestore with retry mechanism
                max_retries = 3
                retry_delay = 5  # seconds
                for attempt in range(max_retries):
                    try:
                        # Upload to Firestore
                        doc_ref = db.collection('newsArticles').document(content_id)
                        doc_ref.set(news_data)
                        print(f"Successfully uploaded article: {content_id} with link: {news_data['link']}")
                        
                        # Create a "processed" directory in the SAME directory as the original file
                        original_dir = os.path.dirname(xml_file)
                        processed_dir = os.path.join(original_dir, "processed")
                        if not os.path.exists(processed_dir):
                            os.makedirs(processed_dir)
                            
                        # Move the file to the processed directory within its original directory
                        processed_file = os.path.join(processed_dir, os.path.basename(xml_file))
                        os.rename(xml_file, processed_file)
                        print(f"Moved {xml_file} to {processed_file}")
                        
                        successful_count += 1
                        break  # Success, exit retry loop
                        
                    except Exception as e:
                        if attempt < max_retries - 1:
                            print(f"Firestore upload attempt {attempt+1} failed: {str(e)}. Retrying in {retry_delay} seconds...")
                            import time
                            time.sleep(retry_delay)
                        else:
                            print(f"All {max_retries} upload attempts failed for {content_id}. File will be kept in original location.")
                            failed_count += 1
                            raise  # Re-raise to be caught by the outer exception handler
            else:
                print(f"Skipping {xml_file} due to parsing failure")
                failed_count += 1
        except Exception as e:
            print(f"Error processing {xml_file}: {str(e)}")
            failed_count += 1
    
    print(f"\nProcessing complete. Summary:")
    print(f"Total XML files processed: {len(xml_files)}")
    print(f"Successfully processed: {successful_count}")
    print(f"Failed to process: {failed_count}")
    print(f"Parsed data saved to: {parsed_dir}")


if __name__ == "__main__":
    main()