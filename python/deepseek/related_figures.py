# related_figures.py

import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin.firestore import FieldFilter
from collections import defaultdict
import operator
import os
from dotenv import load_dotenv
import argparse

def initialize_firebase():
    """Initializes the Firebase Admin SDK and returns a Firestore client instance."""
    load_dotenv()
    try:
        config_path = os.getenv('FIREBASE_CONFIG_PATH')
        database_url = os.getenv('FIREBASE_DEFAULT_DATABASE_URL')
        
        if not all([config_path, database_url]):
            raise ValueError("FIREBASE_CONFIG_PATH or FIREBASE_DATABASE_URL not found in environment variables.")
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Service account key not found at: {config_path}")
        
        if not firebase_admin._apps:
            cred = credentials.Certificate(config_path)
            firebase_admin.initialize_app(cred, {'databaseURL': database_url})
            print("✓ Firebase initialized successfully.")
        else:
            print("✓ Using existing Firebase app.")

        return firestore.client()

    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {e}")
        raise

def create_figure_lookup_maps(db):
    """
    Fetches all documents from 'selected-figures' to create translation maps
    between figure names and their document IDs.
    """
    print("Creating figure name-to-ID lookup maps...")
    name_to_id_map = {}
    id_to_name_map = {}
    
    figures_ref = db.collection('selected-figures')
    figures = figures_ref.stream()
    
    for figure in figures:
        figure_id = figure.id
        data = figure.to_dict()
        figure_name = data.get('name')
        
        if figure_name:
            name_to_id_map[figure_name] = figure_id
            id_to_name_map[figure_id] = figure_name
        else:
            print(f"Warning: Figure with ID '{figure_id}' is missing a 'name' field. Skipping.")

    if not name_to_id_map:
        raise Exception("Could not create lookup maps. 'selected-figures' might be empty or documents are missing 'name' fields.")
        
    print(f"✓ Lookup maps created successfully with {len(name_to_id_map)} entries.")
    return name_to_id_map, id_to_name_map


def process_all_figures(db, name_to_id_map):
    """
    Calculates co-mention frequency for ALL public figures using the lookup map.
    """
    print("\n--- Running in FULL BATCH mode for all figures ---")
    
    articles_ref = db.collection('newsArticles')
    articles = articles_ref.stream()

    co_mention_map = defaultdict(lambda: defaultdict(int))
    article_count = 0
    
    print("Processing articles with name-to-ID translation...")
    for article in articles:
        article_count += 1
        article_data = article.to_dict()
        names_in_article = article_data.get('public_figures', [])
        
        ids_in_article = [name_to_id_map.get(name) for name in names_in_article if name_to_id_map.get(name)]

        if len(ids_in_article) > 1:
            for i in range(len(ids_in_article)):
                for j in range(i + 1, len(ids_in_article)):
                    id_a = ids_in_article[i]
                    id_b = ids_in_article[j]
                    co_mention_map[id_a][id_b] += 1
                    co_mention_map[id_b][id_a] += 1
    
    if article_count == 0:
        print("Warning: No articles found.")
        return

    print(f"Finished processing {article_count} articles. Preparing batch update...")
    batch = db.batch()
    for figure_id, related_counts in co_mention_map.items():
        sorted_related = sorted(related_counts.items(), key=operator.itemgetter(1), reverse=True)
        firestore_map = {related_id: count for related_id, count in sorted_related}
        # CORRECTED LINE:
        figure_ref = db.collection('selected-figures').document(figure_id)
        batch.update(figure_ref, {'related_figures': firestore_map})
    batch.commit()
    print(f"✅ Successfully updated {len(co_mention_map)} public figure documents.")


def process_single_figure(db, figure_id, name_to_id_map, id_to_name_map):
    """
    Calculates co-mention frequency for a single figure using the lookup maps.
    """
    print(f"\n--- Running in SINGLE mode for figure: {figure_id} ---")

    target_figure_name = id_to_name_map.get(figure_id)
    if not target_figure_name:
        print(f"❌ Error: Could not find a name corresponding to the ID '{figure_id}'. Aborting.")
        return

    articles_ref = db.collection('newsArticles')
    # UPDATED QUERY SYNTAX: Resolves the UserWarning
    query = articles_ref.where(filter=FieldFilter('public_figures', 'array_contains', target_figure_name))
    articles = query.stream()

    related_counts = defaultdict(int)
    article_count = 0

    print(f"Processing articles containing the name '{target_figure_name}'...")
    for article in articles:
        article_count += 1
        article_data = article.to_dict()
        names_in_article = article_data.get('public_figures', [])
        
        for other_name in names_in_article:
            if other_name != target_figure_name:
                other_id = name_to_id_map.get(other_name)
                if other_id:
                    related_counts[other_id] += 1

    if article_count == 0:
        print(f"Warning: No articles found mentioning '{target_figure_name}'. No update needed.")
        return

    sorted_related = sorted(related_counts.items(), key=operator.itemgetter(1), reverse=True)
    firestore_map = {related_id: count for related_id, count in sorted_related}

    # CORRECTED LINE:
    figure_ref = db.collection('selected-figures').document(figure_id)
    figure_ref.update({'related_figures': firestore_map})
    
    print(f"✅ Successfully processed {article_count} articles and updated document for '{figure_id}'.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Update 'related_figures' for public figures.")
    parser.add_argument("-f", "--figure", type=str, help="Optional: The ID of a single public figure to process.")
    args = parser.parse_args()

    try:
        db_client = initialize_firebase()
        
        name_map, id_map = create_figure_lookup_maps(db_client)
        
        if args.figure:
            process_single_figure(db_client, args.figure, name_map, id_map)
        else:
            process_all_figures(db_client, name_map)
            
        print("\nScript finished successfully.")

    except Exception as e:
        print(f"\n❌ A critical error occurred: {e}")