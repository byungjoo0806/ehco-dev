import spacy
from thefuzz import fuzz
from korean_name_normalizer import normalize_korean_name

# Load NER model
nlp = spacy.load("en_core_web_trf")  # Using transformer-based model for higher accuracy

def verify_celebrity_entities(article_text, extracted_celebrities):
    """
    Verify that extracted celebrities are actually mentioned in the article
    and normalize their names to standard format.
    """
    # Process article with NER
    doc = nlp(article_text)
    
    # Extract all PERSON entities from article
    article_persons = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    
    verified_celebrities = []
    for celebrity in extracted_celebrities:
        # Check if celebrity name appears in article persons with fuzzy matching
        best_match = None
        best_score = 0
        
        for person in article_persons:
            score = fuzz.token_sort_ratio(celebrity.lower(), person.lower())
            if score > 85 and score > best_score:  # 85% threshold for match
                best_match = person
                best_score = score
        
        if best_match:
            # Normalize Korean name to standard format
            normalized_name = normalize_korean_name(celebrity)
            verified_celebrities.append({
                "original": celebrity,
                "normalized": normalized_name,
                "confidence": best_score / 100
            })
        
    return verified_celebrities
