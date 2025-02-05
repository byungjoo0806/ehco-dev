# main.py

import asyncio
from Storytelling_fetch_firebase import NewsManager
from Storytelling_generation import ContentGenerationManager

async def main():
    # Initialize NewsManager (handles Firebase and Anthropic setup)
    news_manager = NewsManager()
    
    # Initialize ContentGenerationManager with NewsManager instance
    manager = ContentGenerationManager(news_manager, celebrity_name="Han So-hee")
    
    # Generate and store content
    processed_batches = await manager.generate_and_store_content()
    print(f"Processed {processed_batches} batches of content")

if __name__ == "__main__":
    asyncio.run(main())