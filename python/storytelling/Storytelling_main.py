# main.py

import asyncio
from Storytelling_fetch_firebase import NewsManager
from Storytelling_generation import ContentGenerationManager

async def main():
    print("\n=== Starting Content Generation Process ===")
    
    # Initialize NewsManager (handles Firebase and Anthropic setup)
    print("\nInitializing NewsManager...")
    news_manager = NewsManager()
    print("✓ NewsManager initialized successfully")
    
    # Initialize ContentGenerationManager with NewsManager instance
    celebrity_name = "Lee Jung-jae"
    print(f"\nInitializing ContentGenerationManager for celebrity: {celebrity_name}")
    manager = ContentGenerationManager(news_manager, celebrity_name)
    print("✓ ContentGenerationManager initialized successfully")
    
    # Generate and store content
    print("\nStarting content generation and storage process...")
    try:
        num_processed, doc_id = await manager.generate_and_store_content()
        print(f"\n=== Process Complete ===")
        print(f"✓ Successfully processed {num_processed} content batches")
        # print(f"✓ Document ID: {doc_id}")
    except Exception as e:
        print(f"\n❌ Error during content generation: {e}")
    
    print("\n=== Process Finished ===")

if __name__ == "__main__":
    asyncio.run(main())