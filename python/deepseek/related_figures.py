# related_figures.py (Refactored into a Class)

import firebase_admin
from firebase_admin import firestore
from firebase_admin.firestore import FieldFilter
from collections import defaultdict
import operator
import argparse
from setup_firebase_deepseek import NewsManager # Reuse existing Firebase setup
import asyncio

class RelatedFiguresUpdater:
    def __init__(self):
        """
        Initializes the updater, connects to Firebase, and creates the
        essential name-to-ID lookup maps.
        """
        print("Initializing RelatedFiguresUpdater...")
        # Use the existing NewsManager to get a DB client
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

    def update_for_figure(self, figure_id: str):
        """
        Calculates and updates co-mention frequency for a single figure.
        This is the method we'll call from the master script.
        """
        print(f"  -> Running co-mention count for single figure: {figure_id}")
        target_figure_name = self.id_to_name_map.get(figure_id)
        if not target_figure_name:
            print(f"    ❌ Error: Could not find a name for ID '{figure_id}'. Skipping.")
            return

        query = self.db.collection('newsArticles').where(
            filter=FieldFilter('public_figures', 'array_contains', target_figure_name)
        )
        related_counts = defaultdict(int)
        
        for article in query.stream():
            names_in_article = article.to_dict().get('public_figures', [])
            for other_name in names_in_article:
                if other_name != target_figure_name:
                    other_id = self.name_to_id_map.get(other_name)
                    if other_id:
                        related_counts[other_id] += 1

        if not related_counts:
            print(f"    ✓ No co-mentions found for '{target_figure_name}'. No update needed.")
            return

        sorted_related = sorted(related_counts.items(), key=operator.itemgetter(1), reverse=True)
        firestore_map = {related_id: count for related_id, count in sorted_related}

        figure_ref = self.db.collection('selected-figures').document(figure_id)
        figure_ref.update({'related_figures': firestore_map})
        print(f"    ✓ Successfully updated related figures for '{figure_id}'.")

# This main block allows the script to still be run standalone if needed
async def main():
    parser = argparse.ArgumentParser(description="Standalone runner for updating related figures.")
    parser.add_argument("-f", "--figure", required=True, type=str, help="The ID of the public figure to process.")
    args = parser.parse_args()
    
    updater = RelatedFiguresUpdater()
    updater.update_for_figure(args.figure)

if __name__ == '__main__':
    asyncio.run(main())