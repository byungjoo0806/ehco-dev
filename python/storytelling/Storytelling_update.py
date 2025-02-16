from datetime import datetime
from typing import List, Dict, Optional
import asyncio
from rate_limiter import APIRateLimiter
from Storytelling_fetch_firebase import NewsManager
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud import firestore


class IncrementalContentManager:
    def __init__(self, news_manager, celebrity_name: Optional[str] = None):
        self.news_manager = news_manager
        self.celebrity_name = celebrity_name
        self.collection_name = "celebrities"
        self.rate_limiter = APIRateLimiter()
        self._changes = []

    @staticmethod
    async def fetch_celebrity_names(db):
        """Fetch all celebrity names from the celebrities collection"""
        try:
            # Query the celebrities collection
            celebrities_ref = db.collection("celebrities")
            docs = celebrities_ref.stream()  # Use stream() instead of get()

            # Extract celebrity names from the documents
            celebrity_names = []
            for doc in docs:
                data = doc.to_dict()
                if "name" in data:  # Make sure the field exists
                    celebrity_names.append(data["name"])

            return celebrity_names
        except Exception as e:
            print(f"Error fetching celebrity names: {e}")
            return []

    def get_celebrity_doc_id(self):
        """Generate document ID for a celebrity"""
        if not self.celebrity_name:
            raise ValueError("Celebrity name is required")
        return self.celebrity_name.lower().replace(" ", "").replace("-", "")

    async def fetch_all_content_refs(self) -> Dict[str, List[str]]:
        """Fetch all content references from the generated content"""
        try:
            celebrity_doc_id = self.get_celebrity_doc_id()
            content_ref = (
                self.news_manager.db.collection(self.collection_name)
                .document(celebrity_doc_id)
                .collection("content")
            )

            docs = content_ref.stream()
            content_refs = {}
            for doc in docs:
                data = doc.to_dict()
                if "source_articles" in data:
                    content_refs[doc.id] = list(set(data["source_articles"]))

            return content_refs
        except Exception as e:
            print(f"Error fetching content references: {e}")
            self._log_error("fetch_content_refs", str(e))
            raise

    async def fetch_current_articles(self) -> List[str]:
        """Fetch URLs of all current articles for the celebrity"""
        try:
            celebrity_name_lower = (
                self.celebrity_name.lower().replace(" ", "").replace("-", "")
            )

            # Use where() instead of filter()
            articles = (
                self.news_manager.db.collection("news")
                .where("celebrity", "==", celebrity_name_lower)
                .stream()
            )

            return [article.to_dict().get("url") for article in articles]
        except Exception as e:
            print(f"Error fetching current articles: {e}")
            raise

    async def fetch_existing_content(self):
        """Fetch existing generated content from Firebase"""
        try:
            celebrity_doc_id = self.get_celebrity_doc_id()
            content_ref = (
                self.news_manager.db.collection(self.collection_name)
                .document(celebrity_doc_id)
                .collection("content")
            )

            docs = content_ref.stream()
            existing_content = {}
            for doc in docs:
                existing_content[doc.id] = doc.to_dict()
            return existing_content
        except Exception as e:
            print(f"Error fetching existing content: {e}")
            raise

    async def fetch_new_articles(self):
        """Fetch articles that haven't been processed yet"""
        try:
            celebrity_name_lower = (
                self.celebrity_name.lower().replace(" ", "").replace("-", "")
            )

            # Use where() instead of filter()
            articles = (
                self.news_manager.db.collection("news")
                .where("celebrity", "==", celebrity_name_lower)
                .where("generated_content_ref", "==", None)
                .stream()
            )

            new_articles = []
            for article in articles:
                data = article.to_dict()
                new_articles.append(
                    {
                        "url": data.get("url"),
                        "content": data.get("content"),
                        "category": data.get("category"),
                        "subcategory": data.get("subcategory"),
                        "formatted_date": data.get("formatted_date"),
                    }
                )

            return new_articles
        except Exception as e:
            print(f"Error fetching new articles: {e}")
            raise

    def create_update_prompt(
        self, existing_content: str, new_articles: List[Dict]
    ) -> str:
        """Create prompt for updating existing content with new articles"""
        prompt = f"""You are a professional wiki content writer. You have existing content about {self.celebrity_name} 
and need to incorporate new information from additional articles. Analyze the new articles and update the existing 
content while maintaining consistency and chronological order.

Existing content:
{existing_content}

New articles to incorporate:
"""
        for article in new_articles:
            prompt += f"\nURL: {article.get('url')}"
            prompt += f"\nDate: {article.get('formatted_date')}"
            prompt += f"\nSubcategory: {article.get('subcategory', 'general')}"
            prompt += f"\nContent: {article.get('content')}\n"

        prompt += """
Please update the content following these guidelines:
1. Maintain the same structure as the existing content
2. Incorporate new information chronologically
3. Add source citations for new information
4. Update dates and statistics if newer data is available
5. Preserve existing information unless contradicted by newer sources
6. Note any conflicts between existing and new information
"""
        return prompt

    def create_deletion_update_prompt(
        self, existing_content: str, deleted_urls: List[str]
    ) -> str:
        """Create prompt for updating content after article deletions"""
        prompt = f"""You are a professional wiki content writer. Some source articles have been deleted, 
and you need to update the existing content to remove information that was solely sourced from these deleted articles. 
Maintain accuracy and consistency while removing content from deleted sources.

Existing content:
{existing_content}

URLs of deleted articles to remove:
{', '.join(deleted_urls)}

Please update the content following these guidelines:
1. Remove information that was exclusively sourced from the deleted articles
2. Maintain the same structure and format
3. Adjust any statistics or summaries that included data from deleted articles
4. Preserve all information from remaining valid sources
5. Ensure content remains coherent and well-organized after removals
6. Update any sections that referenced the deleted articles
"""
        return prompt

    async def detect_and_handle_deletions(self):
        """Detect deleted articles and update content accordingly"""
        try:
            print("\nChecking for deleted articles...")

            # Get all content references and current articles
            content_refs = await self.fetch_all_content_refs()
            current_articles = set(
                await self.fetch_current_articles()
            )  # Use set for O(1) lookups

            # Track updates needed
            updates_needed = {}
            for section_id, referenced_urls in content_refs.items():
                deleted_urls = [
                    url for url in referenced_urls if url not in current_articles
                ]
                if deleted_urls:
                    updates_needed[section_id] = deleted_urls
                    self._log_change("deletion", section_id, deleted_urls)

            if not updates_needed:
                print("No deleted articles detected")
                return 0

            # Handle updates one by one instead of in a transaction
            for section_id, deleted_urls in updates_needed.items():
                try:
                    await self._update_section_without_transaction(
                        section_id, deleted_urls
                    )
                except Exception as e:
                    print(f"Error updating section {section_id}: {e}")
                    continue

            return len(updates_needed)

        except Exception as e:
            print(f"Error handling deletions: {e}")
            self._log_error("handle_deletions", str(e))
            raise

    async def _update_section_without_transaction(
        self, section_id: str, deleted_urls: List[str]
    ):
        """Update section content without using a transaction"""
        try:
            celebrity_doc_id = self.get_celebrity_doc_id()
            content_ref = (
                self.news_manager.db.collection(self.collection_name)
                .document(celebrity_doc_id)
                .collection("content")
                .document(section_id)
            )

            # Get current content
            doc = content_ref.get()
            if not doc.exists:
                raise ValueError(f"Section {section_id} not found")

            current_content = doc.to_dict()

            # Update source articles list
            current_urls = set(current_content.get("source_articles", []))
            updated_urls = list(current_urls - set(deleted_urls))

            # Create prompt for content regeneration
            updated_content = await self._regenerate_content_after_deletion(
                section_id, current_content, deleted_urls, updated_urls
            )

            # Update content in Firestore
            content_ref.set(updated_content, merge=True)

        except Exception as e:
            print(f"Error updating section {section_id}: {e}")
            raise

    async def update_section(
        self, section_id: str, existing_content: Dict, new_articles: List[Dict]
    ) -> Dict:
        """Update a specific section with new article information"""
        try:
            prompt = self.create_update_prompt(
                existing_content["raw_content"], new_articles
            )

            await self.rate_limiter.wait_for_tokens(prompt)
            response = self.news_manager.client.messages.create(
                model=self.news_manager.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )

            content = (
                response.content[0].text
                if isinstance(response.content, list)
                else response.content
            )

            # Extract sections using the same logic as in ContentGenerationManager
            def extract_section(content, tag):
                import re

                pattern = f"<{tag}>(.*?)</{tag}>"
                match = re.search(pattern, content, re.DOTALL)
                return match.group(1).strip() if match else ""

            updated_content = {
                **existing_content,
                "raw_content": content,
                "last_updated": datetime.now().isoformat(),
            }

            # Update specific sections based on content type
            if section_id == "overall_summary":
                updated_content.update(
                    {
                        "overall_overview": extract_section(
                            content, "overall_overview"
                        ),
                        "key_findings": extract_section(content, "key_findings"),
                        "key_works": extract_section(content, "key_works"),
                    }
                )
            else:
                updated_content.update(
                    {
                        "subcategory_overview": extract_section(
                            content, "subcategory_overview"
                        ),
                        "chronological_developments": extract_section(
                            content, "chronological_developments"
                        ),
                        "key_implications": extract_section(
                            content, "key_implications"
                        ),
                    }
                )

            return updated_content
        except Exception as e:
            print(f"Error updating section {section_id}: {e}")
            raise

    async def process_incremental_update(self):
        """Main method to process incremental updates"""
        try:
            print("\nStarting incremental content update...")

            # First handle any deletions
            num_deletion_updates = await self.detect_and_handle_deletions()

            # Then handle new articles
            existing_content = await self.fetch_existing_content()
            new_articles = await self.fetch_new_articles()

            if not new_articles and num_deletion_updates == 0:
                print("No updates needed - no new articles or deletions")
                return 0

            if new_articles:
                print(f"Found {len(new_articles)} new articles to process")

                # Group new articles by subcategory
                from collections import defaultdict

                grouped_articles = defaultdict(list)
                for article in new_articles:
                    grouped_articles[article.get("subcategory", "general")].append(
                        article
                    )

                # Update overall summary first
                if "overall_summary" in existing_content:
                    print("\nUpdating overall summary...")
                    updated_summary = await self.update_section(
                        "overall_summary",
                        existing_content["overall_summary"],
                        new_articles,
                    )
                    await self.store_updated_content("overall_summary", updated_summary)

                # Update affected subcategories
                for subcategory, articles in grouped_articles.items():
                    safe_subcategory_id = (
                        subcategory.replace("/", "_").replace(" ", "_").lower()
                    )
                    if safe_subcategory_id in existing_content:
                        print(f"\nUpdating subcategory: {subcategory}")
                        updated_content = await self.update_section(
                            safe_subcategory_id,
                            existing_content[safe_subcategory_id],
                            articles,
                        )
                        await self.store_updated_content(
                            safe_subcategory_id, updated_content
                        )

                        # Update article references using batch
                        batch = self.news_manager.db.batch()
                        for article in articles:
                            # Updated to use filter()
                            docs = (
                                self.news_manager.db.collection("news")
                                .filter(FieldFilter("url", "==", article["url"]))
                                .get()
                            )
                            for doc in docs:
                                batch.update(
                                    doc.reference,
                                    {
                                        "generated_content_ref": f"{self.collection_name}/{self.get_celebrity_doc_id()}/content/{safe_subcategory_id}"
                                    },
                                )
                        batch.commit()

            return len(new_articles) + 1  # +1 for overall summary

        except Exception as e:
            print(f"Error in incremental update: {e}")
            raise

    async def store_updated_content(self, section_id: str, updated_content: Dict):
        """Store updated content back to Firebase"""
        try:
            celebrity_doc_id = self.get_celebrity_doc_id()
            content_ref = (
                self.news_manager.db.collection(self.collection_name)
                .document(celebrity_doc_id)
                .collection("content")
                .document(section_id)
            )

            content_ref.set(updated_content, merge=True)

            # Update last_updated timestamp in celebrity document
            celebrity_doc_ref = self.news_manager.db.collection(
                self.collection_name
            ).document(celebrity_doc_id)
            celebrity_doc_ref.set(
                {"last_updated": datetime.now().isoformat()}, merge=True
            )

        except Exception as e:
            print(f"Error storing updated content: {e}")
            raise

    def _log_change(self, change_type: str, section_id: str, urls: List[str]):
        """Track content changes for monitoring"""
        self._changes.append(
            {
                "type": change_type,
                "section_id": section_id,
                "urls": urls,
                "timestamp": datetime.now().isoformat(),
            }
        )

    def _log_error(self, operation: str, error_msg: str):
        """Log errors for debugging"""
        self._changes.append(
            {
                "type": "error",
                "operation": operation,
                "error": error_msg,
                "timestamp": datetime.now().isoformat(),
            }
        )

    async def _update_section_with_transaction(
        self, transaction, section_id: str, deleted_urls: List[str]
    ):
        """Update section content within a transaction"""
        celebrity_doc_id = self.get_celebrity_doc_id()
        content_ref = (
            self.news_manager.db.collection(self.collection_name)
            .document(celebrity_doc_id)
            .collection("content")
            .document(section_id)
        )

        # Get current content
        doc = content_ref.get(transaction=transaction)
        if not doc.exists:
            raise ValueError(f"Section {section_id} not found")

        current_content = doc.to_dict()

        # Update source articles list
        current_urls = set(current_content.get("source_articles", []))
        updated_urls = list(current_urls - set(deleted_urls))

        # Update content with transaction
        transaction.update(
            content_ref,
            {
                "source_articles": updated_urls,
                "last_updated": datetime.now().isoformat(),
            },
        )

    def get_changes(self) -> List[Dict]:
        """Get the log of all tracked changes"""
        return self._changes

    async def _regenerate_content_after_deletion(
        self,
        section_id: str,
        current_content: Dict,
        deleted_urls: List[str],
        remaining_urls: List[str],
    ) -> Dict:
        """Regenerate content after removing deleted articles"""
        try:
            # Fetch remaining articles' content
            remaining_articles = []
            for url in remaining_urls:
                # Query the news collection for the remaining article
                articles = (
                    self.news_manager.db.collection("news")
                    .where("url", "==", url)
                    .stream()
                )

                for article in articles:
                    data = article.to_dict()
                    remaining_articles.append(
                        {
                            "url": data.get("url"),
                            "content": data.get("content"),
                            "category": data.get("category"),
                            "subcategory": data.get("subcategory"),
                            "formatted_date": data.get("formatted_date"),
                        }
                    )

            # Create deletion update prompt
            prompt = self.create_deletion_update_prompt(
                current_content["raw_content"], deleted_urls
            )

            # Get AI response for content regeneration
            await self.rate_limiter.wait_for_tokens(prompt)
            response = self.news_manager.client.messages.create(
                model=self.news_manager.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )

            content = (
                response.content[0].text
                if isinstance(response.content, list)
                else response.content
            )

            # Extract sections using helper function
            def extract_section(content, tag):
                import re

                pattern = f"<{tag}>(.*?)</{tag}>"
                match = re.search(pattern, content, re.DOTALL)
                return match.group(1).strip() if match else ""

            # Create updated content dictionary
            updated_content = {
                **current_content,
                "raw_content": content,
                "source_articles": remaining_urls,
                "last_updated": datetime.now().isoformat(),
            }

            # Update specific sections based on content type
            if section_id == "overall_summary":
                updated_content.update(
                    {
                        "overall_overview": extract_section(
                            content, "overall_overview"
                        ),
                        "key_findings": extract_section(content, "key_findings"),
                        "key_works": extract_section(content, "key_works"),
                    }
                )
            else:
                updated_content.update(
                    {
                        "subcategory_overview": extract_section(
                            content, "subcategory_overview"
                        ),
                        "chronological_developments": extract_section(
                            content, "chronological_developments"
                        ),
                        "key_implications": extract_section(
                            content, "key_implications"
                        ),
                    }
                )

            return updated_content

        except Exception as e:
            print(f"Error regenerating content after deletion: {e}")
            raise

    def create_deletion_update_prompt(self, existing_content: str, deleted_urls: List[str]) -> str:
        """Create improved prompt for updating content after article deletions"""
        prompt = f"""You are a professional wiki content writer. Some source articles about {self.celebrity_name} have been deleted, 
    and you need to rewrite the existing content to remove information that was solely sourced from these deleted articles. 
    Maintain accuracy, consistency, and the narrative flow while removing content from deleted sources.

    Existing content:
    {existing_content}

    The following source URLs have been deleted and their information should be removed:
    {', '.join(deleted_urls)}

    Please rewrite the content following these guidelines:
    1. Remove all information that was exclusively sourced from the deleted articles
    2. Maintain the original structure and format of the content
    3. Ensure proper flow and coherence after removing the deleted information
    4. Preserve all information from remaining valid sources
    5. If a claim was supported by multiple sources including a deleted one, keep the claim but remove the deleted source
    6. Update any statistics or summaries that included data from deleted articles
    7. Rewrite transitions and connections between paragraphs if needed to maintain flow
    8. Keep the same section structure but adjust content within each section as needed

    The output should be complete and self-contained, maintaining the same XML tag structure as the input.
    """
        return prompt

async def main():
    try:
        news_manager = NewsManager()

        # Use fetch_celebrity_names instead of get_celebrities_to_update
        celebrity_names = await IncrementalContentManager.fetch_celebrity_names(
            news_manager.db
        )

        if not celebrity_names:
            print("No celebrities found in the database")
            return

        print(f"Found {len(celebrity_names)} celebrities to process")

        for celebrity_name in celebrity_names:
            print(f"\nProcessing updates for {celebrity_name}")
            content_manager = IncrementalContentManager(
                news_manager=news_manager, celebrity_name=celebrity_name
            )

            try:
                # Handle deletions
                num_deletion_updates = (
                    await content_manager.detect_and_handle_deletions()
                )
                if num_deletion_updates > 0:
                    print(f"Processed {num_deletion_updates} deletion updates")

                # Handle new articles
                new_articles = await content_manager.fetch_new_articles()
                if new_articles:
                    print(f"Found {len(new_articles)} new articles")
                    updates = await content_manager.process_incremental_update()
                    print(f"Processed {updates} content updates")
                elif num_deletion_updates == 0:
                    print("No updates needed - no new articles or deletions")

                # Log changes
                changes = content_manager.get_changes()
                if changes:
                    print("\nChange log:")
                    for change in changes:
                        timestamp = change["timestamp"]
                        change_type = change["type"]
                        if change_type == "error":
                            print(
                                f"⚠️ {timestamp}: Error in {change['operation']}: {change['error']}"
                            )
                        else:
                            section = change["section_id"]
                            urls = len(change["urls"])
                            print(
                                f"✓ {timestamp}: {change_type} - {urls} URLs in section {section}"
                            )

            except Exception as e:
                print(f"Error processing {celebrity_name}: {e}")
                continue

        print("\nContent update process completed")

    except Exception as e:
        print(f"Fatal error in main process: {e}")
        raise


if __name__ == "__main__":
    try:
        # Set up event loop
        loop = asyncio.get_event_loop()
        loop.run_until_complete(main())

        # Clean up pending tasks
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()

        # Run until all tasks are cancelled
        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

        # Close the event loop
        loop.close()

    except KeyboardInterrupt:
        print("\nProcess interrupted by user")
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise
    finally:
        # Allow the Firebase Admin SDK to clean up its resources naturally
        try:
            from firebase_admin import _apps

            for app in _apps.values():
                app.delete()
        except:
            pass
