# main.py

import asyncio
import argparse
from Storytelling_fetch_firebase import NewsManager
from Storytelling_fetch_TEST_firebase import TestNewsManager
from Storytelling_generation import ContentGenerationManager
from Storytelling_update import IncrementalContentManager

async def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Generate or update celebrity content')
    parser.add_argument('--mode', choices=['full', 'incremental'], default='incremental',
                      help='Mode of operation: full (regenerate all) or incremental (update only new articles)')
    parser.add_argument('--celebrity', default="Lee Jung-jae",
                      help='Name of the celebrity to process')
    args = parser.parse_args()
    print("\n=== Starting Content Generation Process ===")
    
    # Initialize NewsManager (handles Firebase and Anthropic setup)
    print("\nInitializing NewsManager...")
    news_manager = TestNewsManager()
    print("✓ NewsManager initialized successfully")
    
    if args.mode == 'full':
        # Full content regeneration
        print(f"\nInitializing ContentGenerationManager for celebrity: {args.celebrity}")
        manager = ContentGenerationManager(news_manager, args.celebrity)
        print("✓ ContentGenerationManager initialized successfully")
        
        print("\nStarting full content generation and storage process...")
        try:
            num_processed, doc_id = await manager.generate_and_store_content()
            print(f"\n=== Process Complete ===")
            print(f"✓ Successfully processed {num_processed} content batches")
        except Exception as e:
            print(f"\n❌ Error during content generation: {e}")
    
    else:
        # Incremental update
        print(f"\nInitializing IncrementalContentManager for celebrity: {args.celebrity}")
        manager = IncrementalContentManager(news_manager, args.celebrity)
        print("✓ IncrementalContentManager initialized successfully")
        
        print("\nStarting incremental update process...")
        try:
            num_updated = await manager.process_incremental_update()
            print(f"\n=== Process Complete ===")
            print(f"✓ Successfully updated {num_updated} content sections")
        except Exception as e:
            print(f"\n❌ Error during incremental update: {e}")
    
    print("\n=== Process Finished ===")

if __name__ == "__main__":
    asyncio.run(main())