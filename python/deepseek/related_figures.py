# fixed_related_figures.py

import firebase_admin
from firebase_admin import firestore
from firebase_admin.firestore import FieldFilter
from collections import defaultdict
import operator
import argparse
from setup_firebase_deepseek import NewsManager
import asyncio

class RelatedFiguresUpdater:
    def __init__(self):
        """
        Initializes the updater, connects to Firebase, and creates the
        essential name-to-ID lookup maps.
        """
        print("Initializing RelatedFiguresUpdater...")
        self.db = NewsManager().db
        
        # Create the lookup maps upon initialization
        self.name_to_id_map, self.id_to_name_map = self._create_figure_lookup_maps()
        print("✓ RelatedFiguresUpdater is ready.")

    def _create_figure_lookup_maps(self):
        """
        Creates translation maps between figure names and their document IDs.
        """
        print("  -> Creating figure name-to-ID lookup maps...")
        name_to_id = {}
        id_to_name = {}
        
        figures_ref = self.db.collection('selected-figures')
        for figure in figures_ref.stream():
            figure_id = figure.id
            figure_name = figure.to_dict().get('name')
            if figure_name:
                name_to_id[figure_name] = figure_id
                id_to_name[figure_id] = figure_name

        if not name_to_id:
            raise Exception("Could not create lookup maps. 'selected-figures' might be empty.")
            
        print(f"  ✓ Lookup maps created with {len(name_to_id)} entries.")
        return name_to_id, id_to_name

    def _get_all_name_variations(self, target_name: str):
        """
        Generate common case variations of a name
        """
        variations = [
            target_name,  # Original
            target_name.upper(),  # ALL CAPS
            target_name.lower(),  # all lowercase
            target_name.title(),  # Title Case
            target_name.capitalize(),  # First letter only
        ]
        
        # Remove duplicates while preserving order
        unique_variations = []
        seen = set()
        for var in variations:
            if var not in seen:
                unique_variations.append(var)
                seen.add(var)
        
        return unique_variations

    def _find_exact_figure_match(self, article_figure_name: str):
        """
        Find which selected figure this article figure name corresponds to.
        Returns (figure_id, exact_name) if found, (None, None) otherwise.
        """
        # Try exact match first
        if article_figure_name in self.name_to_id_map:
            return self.name_to_id_map[article_figure_name], article_figure_name
        
        # Try case-insensitive matching
        for selected_name, figure_id in self.name_to_id_map.items():
            if selected_name.lower() == article_figure_name.lower():
                return figure_id, selected_name
        
        return None, None

    def update_for_figure(self, figure_id: str):
        """
        Calculates and updates co-mention frequency for a single figure.
        """
        print(f"  -> Running co-mention count for figure: {figure_id}")
        
        # Get the exact name from our lookup
        target_figure_name = self.id_to_name_map.get(figure_id)
        if not target_figure_name:
            print(f"    ❌ Error: Could not find a name for ID '{figure_id}'. Skipping.")
            return

        print(f"  -> Target figure name from selected-figures: '{target_figure_name}'")
        
        # Generate all possible case variations
        name_variations = self._get_all_name_variations(target_figure_name)
        print(f"  -> Checking these name variations: {name_variations}")
        
        related_counts = defaultdict(int)
        total_articles_found = 0
        
        # Check each variation
        for variation in name_variations:
            print(f"  -> Searching for articles containing: '{variation}'")
            
            try:
                query = self.db.collection('newsArticles').where(
                    filter=FieldFilter('public_figures', 'array_contains', variation)
                )
                
                articles_for_this_variation = 0
                for article in query.stream():
                    articles_for_this_variation += 1
                    total_articles_found += 1
                    
                    names_in_article = article.to_dict().get('public_figures', [])
                    
                    for other_name in names_in_article:
                        # Skip if it's the same as our target (any variation)
                        if other_name.lower() == variation.lower():
                            continue
                        
                        # Find which selected figure this corresponds to
                        other_figure_id, other_exact_name = self._find_exact_figure_match(other_name)
                        
                        if other_figure_id and other_figure_id != figure_id:
                            related_counts[other_figure_id] += 1
                
                print(f"    -> Found {articles_for_this_variation} articles with '{variation}'")
                
            except Exception as e:
                print(f"    -> No articles found with '{variation}' (this is normal)")
                continue

        print(f"  -> Total articles found across all variations: {total_articles_found}")

        if not related_counts:
            print(f"    ⚠️  No co-mentions found for '{target_figure_name}'. This could mean:")
            print(f"       - The figure is never mentioned in articles")
            print(f"       - The figure name in articles uses different spelling/format")
            print(f"       - The figure is mentioned but never with other selected figures")
            return

        # Sort and update
        sorted_related = sorted(related_counts.items(), key=operator.itemgetter(1), reverse=True)
        firestore_map = {related_id: count for related_id, count in sorted_related}
        
        # Show top 10 for debugging
        print(f"  -> Top 10 related figures:")
        for i, (related_id, count) in enumerate(sorted_related[:10], 1):
            related_name = self.id_to_name_map.get(related_id, 'Unknown')
            print(f"    {i:2d}. {related_name} ({related_id}): {count} co-mentions")

        figure_ref = self.db.collection('selected-figures').document(figure_id)
        figure_ref.update({'related_figures': firestore_map})
        print(f"    ✓ Successfully updated related figures for '{figure_id}' with {len(firestore_map)} related figures.")

# This main block allows the script to still be run standalone if needed
async def main():
    parser = argparse.ArgumentParser(description="Standalone runner for updating related figures.")
    parser.add_argument("-f", "--figure", required=True, type=str, help="The ID of the public figure to process.")
    args = parser.parse_args()
    
    updater = RelatedFiguresUpdater()
    updater.update_for_figure(args.figure)

if __name__ == '__main__':
    asyncio.run(main())