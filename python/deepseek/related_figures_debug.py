# debug_figure_names.py
import firebase_admin
from firebase_admin import firestore
from firebase_admin.firestore import FieldFilter
from setup_firebase_deepseek import NewsManager
from collections import Counter

class FigureNameDebugger:
    def __init__(self):
        self.db = NewsManager().db
    
    def check_figure_name_variations(self, target_name: str):
        """
        Check all variations of a figure name in the database
        """
        print(f"🔍 Checking variations of '{target_name}' in the database...")
        
        # First, check what's in selected-figures collection
        print("\n1. Checking 'selected-figures' collection:")
        figures_ref = self.db.collection('selected-figures')
        selected_figures = {}
        
        for figure in figures_ref.stream():
            figure_data = figure.to_dict()
            figure_name = figure_data.get('name', '')
            if target_name.lower() in figure_name.lower():
                selected_figures[figure.id] = figure_name
                print(f"   Found: ID='{figure.id}' -> Name='{figure_name}'")
        
        if not selected_figures:
            print(f"   ❌ No figures found with '{target_name}' in selected-figures")
            return
        
        # Now check newsArticles for each variation
        print(f"\n2. Checking 'newsArticles' collection for each variation:")
        
        for figure_id, figure_name in selected_figures.items():
            print(f"\n   Checking articles mentioning '{figure_name}':")
            
            # Check exact match
            query = self.db.collection('newsArticles').where(
                filter=FieldFilter('public_figures', 'array_contains', figure_name)
            )
            
            article_count = 0
            related_figures = Counter()
            
            for article in query.stream():
                article_count += 1
                article_data = article.to_dict()
                figures_in_article = article_data.get('public_figures', [])
                
                for other_figure in figures_in_article:
                    if other_figure != figure_name:
                        related_figures[other_figure] += 1
            
            print(f"     Articles found: {article_count}")
            if related_figures:
                print(f"     Top 5 co-mentioned figures:")
                for name, count in related_figures.most_common(5):
                    print(f"       - {name}: {count} times")
            else:
                print(f"     No co-mentioned figures found")
    
    def find_all_name_variations_in_articles(self, target_name: str):
        """
        Find all variations of a name that appear in newsArticles
        """
        print(f"\n3. Searching for ALL name variations containing '{target_name}' in newsArticles:")
        
        # Get all unique public_figures from all articles
        all_figures = set()
        
        # This might be slow for large collections, but necessary for debugging
        articles_ref = self.db.collection('newsArticles')
        
        count = 0
        for article in articles_ref.stream():
            count += 1
            if count % 100 == 0:  # Progress indicator
                print(f"     Processed {count} articles...")
            
            article_data = article.to_dict()
            figures = article_data.get('public_figures', [])
            all_figures.update(figures)
        
        # Find variations
        variations = [name for name in all_figures if target_name.lower() in name.lower()]
        variations.sort()
        
        print(f"\n   Found {len(variations)} name variations containing '{target_name}':")
        for variation in variations:
            print(f"     - '{variation}'")
        
        return variations

# Usage
if __name__ == '__main__':
    debugger = FigureNameDebugger()
    
    # Replace 'suga' with your target figure name
    target = 'suga'
    
    debugger.check_figure_name_variations(target)
    debugger.find_all_name_variations_in_articles(target)