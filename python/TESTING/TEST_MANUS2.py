# Automated Verification Strategy for EHCO.ai

## Overview
This document outlines a comprehensive automated verification strategy for the EHCO.ai platform. The verification layer serves as a critical component to ensure factual accuracy, legal compliance, neutrality, and proper categorization before content is stored in the database or flagged for secondary review.

## Verification Components

### 1. Entity Verification

```python
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
```

### 2. Fact Consistency Checker

```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch

# Load NLI model
nli_model_name = "roberta-large-mnli"
nli_tokenizer = AutoTokenizer.from_pretrained(nli_model_name)
nli_model = AutoModelForSequenceClassification.from_pretrained(nli_model_name)

def check_fact_consistency(article_text, generated_summary):
    """
    Use Natural Language Inference to verify that the generated summary
    is entailed by (consistent with) the original article.
    """
    # Break article into chunks due to length constraints
    max_length = 512
    article_chunks = [article_text[i:i+max_length] for i in range(0, len(article_text), max_length)]
    
    # Check each sentence in summary against article chunks
    import nltk
    nltk.download('punkt')
    summary_sentences = nltk.sent_tokenize(generated_summary)
    
    results = []
    for sentence in summary_sentences:
        chunk_scores = []
        for chunk in article_chunks:
            # Prepare inputs for NLI model
            inputs = nli_tokenizer(chunk, sentence, return_tensors="pt", truncation=True)
            
            # Get NLI prediction
            with torch.no_grad():
                outputs = nli_model(**inputs)
                predictions = torch.softmax(outputs.logits, dim=1)
                
            # Get entailment score (index 0: contradiction, 1: neutral, 2: entailment)
            entailment_score = predictions[0, 2].item()
            chunk_scores.append(entailment_score)
        
        # Use maximum entailment score across chunks
        max_score = max(chunk_scores)
        results.append({
            "sentence": sentence,
            "entailment_score": max_score,
            "is_consistent": max_score > 0.7  # Threshold for consistency
        })
    
    # Overall consistency check
    is_consistent = all(result["is_consistent"] for result in results)
    avg_score = sum(result["entailment_score"] for result in results) / len(results)
    
    return {
        "is_consistent": is_consistent,
        "average_score": avg_score,
        "sentence_results": results
    }
```

### 3. Legal Qualifier Preservation

```python
import re

def check_legal_qualifiers(article_text, generated_content):
    """
    Verify that legal qualifiers in the original article are preserved
    in the generated content when appropriate.
    """
    # List of legal qualifiers to check
    legal_qualifiers = [
        "alleged", "allegedly", "reportedly", "report", "claimed", "claim",
        "according to", "said to", "suspected", "suspect", "under investigation",
        "accused", "purported", "rumored", "rumour", "speculation"
    ]
    
    # Check for qualifiers in article
    article_qualifiers = {}
    for qualifier in legal_qualifiers:
        matches = re.finditer(r'\b' + qualifier + r'\b', article_text.lower())
        for match in matches:
            # Get context (20 words around qualifier)
            start = max(0, match.start() - 100)
            end = min(len(article_text), match.end() + 100)
            context = article_text[start:end]
            
            if qualifier not in article_qualifiers:
                article_qualifiers[qualifier] = []
            article_qualifiers[qualifier].append(context)
    
    # Check if qualifiers are preserved in generated content
    preserved_qualifiers = {}
    missing_qualifiers = {}
    
    for qualifier, contexts in article_qualifiers.items():
        if re.search(r'\b' + qualifier + r'\b', generated_content.lower()):
            preserved_qualifiers[qualifier] = contexts
        else:
            missing_qualifiers[qualifier] = contexts
    
    return {
        "has_legal_qualifiers": len(article_qualifiers) > 0,
        "all_preserved": len(missing_qualifiers) == 0,
        "preserved_qualifiers": preserved_qualifiers,
        "missing_qualifiers": missing_qualifiers
    }
```

### 4. Neutrality & Tone Analysis

```python
from transformers import pipeline

# Load sentiment analysis pipeline
sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")

# Load toxicity detection pipeline
toxicity_detector = pipeline("text-classification", model="unitary/toxic-bert")

def analyze_tone_and_neutrality(text):
    """
    Analyze the tone and neutrality of the generated content.
    """
    # Check sentiment (should be neutral)
    sentiment_results = sentiment_analyzer(text)
    
    # Check for toxic or biased language
    toxicity_results = toxicity_detector(text)
    
    # Check for subjective language
    subjective_words = [
        "beautiful", "ugly", "amazing", "terrible", "awesome", "awful",
        "wonderful", "horrible", "excellent", "poor", "great", "bad",
        "best", "worst", "perfect", "fantastic", "incredible", "outstanding"
    ]
    
    subjective_count = 0
    for word in subjective_words:
        subjective_count += len(re.findall(r'\b' + word + r'\b', text.lower()))
    
    # Calculate neutrality score (0-1, higher is more neutral)
    sentiment_neutrality = 1.0 - abs(sentiment_results[0]["score"] - 0.5) * 2
    toxicity_neutrality = 1.0 - toxicity_results[0]["score"]
    subjective_neutrality = 1.0 - min(1.0, subjective_count / 10)
    
    overall_neutrality = (sentiment_neutrality + toxicity_neutrality + subjective_neutrality) / 3
    
    return {
        "is_neutral": overall_neutrality > 0.8,  # Threshold for neutrality
        "overall_neutrality": overall_neutrality,
        "sentiment_neutrality": sentiment_neutrality,
        "toxicity_neutrality": toxicity_neutrality,
        "subjective_neutrality": subjective_neutrality,
        "subjective_word_count": subjective_count
    }
```

### 5. Category & Taxonomy Validation

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def validate_category_assignment(article_text, category, subcategory):
    """
    Validate that the assigned category and subcategory are appropriate
    for the article content.
    """
    # Define category keywords
    category_keywords = {
        "Career": [
            "film", "movie", "drama", "series", "music", "album", "single", "release", 
            "concert", "tour", "collaboration", "collab", "featuring", "award", "win", 
            "agency", "contract", "debut", "retirement", "variety", "show", "tv show"
        ],
        "Promotion": [
            "brand", "ambassador", "endorsement", "commercial", "advertisement", "ad", 
            "media", "appearance", "interview", "fan", "event", "fansign", "meet", 
            "press", "conference", "festival", "showcase"
        ],
        "Personal Life": [
            "relationship", "dating", "marriage", "wedding", "health", "hospital", 
            "philanthropy", "donation", "charity", "lifestyle", "home", "education", 
            "school", "university", "military", "service", "business", "company"
        ],
        "Controversy": [
            "legal", "lawsuit", "court", "investigation", "police", "scandal", 
            "controversy", "political", "statement", "misconduct", "behavior", 
            "privacy", "invasion", "rumor", "speculation"
        ]
    }
    
    # Define subcategory mapping
    subcategory_mapping = {
        "Career": [
            "Film", "Drama-Series", "Music Release", "Concert-Tour", 
            "Collaboration", "Awards", "Agency", "Debut-Retirement", "Variety-TV Show"
        ],
        "Promotion": [
            "Brand Collaboration", "Media Appearance", "Fan Event", 
            "Press-Interview", "Festival-Show Event"
        ],
        "Personal Life": [
            "Relationship-Marriage", "Health", "Philanthropy", 
            "Lifestyle", "Education-Military", "Personal Business"
        ],
        "Controversy": [
            "Legal Issue", "Scandal", "Political", 
            "Personal Misconduct", "Privacy-Rumor"
        ]
    }
    
    # Check if category is valid
    if category not in category_keywords:
        return {
            "is_valid": False,
            "error": f"Invalid category: {category}"
        }
    
    # Check if subcategory is valid for the category
    if subcategory not in subcategory_mapping.get(category, []):
        return {
            "is_valid": False,
            "error": f"Invalid subcategory '{subcategory}' for category '{category}'"
        }
    
    # Calculate relevance score for assigned category
    category_score = 0
    for keyword in category_keywords[category]:
        if re.search(r'\b' + keyword + r'\b', article_text.lower()):
            category_score += 1
    
    # Calculate relevance scores for all categories
    category_scores = {}
    for cat, keywords in category_keywords.items():
        score = 0
        for keyword in keywords:
            if re.search(r'\b' + keyword + r'\b', article_text.lower()):
                score += 1
        category_scores[cat] = score
    
    # Find category with highest score
    best_category = max(category_scores, key=category_scores.get)
    
    # Check if assigned category matches best category
    category_match = category == best_category
    
    # If scores are close (within 2 points), consider it ambiguous and valid
    is_ambiguous = abs(category_scores[category] - category_scores[best_category]) <= 2
    
    return {
        "is_valid": category_match or is_ambiguous,
        "confidence": category_scores[category] / (sum(category_scores.values()) or 1),
        "assigned_category": category,
        "best_matching_category": best_category,
        "category_scores": category_scores,
        "is_ambiguous": is_ambiguous
    }
```

### 6. Format Validation

```python
def validate_format(content_json):
    """
    Validate that the generated content adheres to format requirements.
    """
    format_issues = []
    
    # Check for required fields
    required_fields = ["celebrity", "date", "category", "subcategory", "headline", "summary"]
    for item in content_json:
        for field in required_fields:
            if field not in item:
                format_issues.append(f"Missing required field: {field}")
    
    # Check headline length (≤15 words)
    for item in content_json:
        if "headline" in item:
            headline_words = item["headline"].split()
            if len(headline_words) > 15:
                format_issues.append(f"Headline exceeds 15 words: {len(headline_words)} words")
    
    # Check summary length (2-3 sentences)
    for item in content_json:
        if "summary" in item:
            import nltk
            nltk.download('punkt')
            summary_sentences = nltk.sent_tokenize(item["summary"])
            if len(summary_sentences) < 2 or len(summary_sentences) > 3:
                format_issues.append(f"Summary should be 2-3 sentences, found {len(summary_sentences)} sentences")
    
    # Check date format (YYYY-MM-DD)
    for item in content_json:
        if "date" in item:
            import re
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', item["date"]):
                format_issues.append(f"Invalid date format: {item['date']}, should be YYYY-MM-DD")
    
    return {
        "is_valid": len(format_issues) == 0,
        "issues": format_issues
    }
```

## Integrated Verification Pipeline

```python
def verify_content(article_text, generated_json):
    """
    Run the complete verification pipeline on generated content.
    """
    verification_results = {}
    flag_reasons = []
    
    # 1. Entity Verification
    celebrities = [item["celebrity"] for item in generated_json]
    entity_results = verify_celebrity_entities(article_text, celebrities)
    verification_results["entity_verification"] = entity_results
    
    # Check if any celebrities failed verification
    if len(entity_results) < len(celebrities):
        flag_reasons.append("Some celebrities could not be verified in the article")
    
    # 2. Fact Consistency Check
    for item in generated_json:
        fact_results = check_fact_consistency(article_text, item["summary"])
        if "fact_consistency" not in verification_results:
            verification_results["fact_consistency"] = []
        verification_results["fact_consistency"].append({
            "celebrity": item["celebrity"],
            "results": fact_results
        })
        
        if not fact_results["is_consistent"]:
            flag_reasons.append(f"Fact inconsistency detected for {item['celebrity']}")
    
    # 3. Legal Qualifier Preservation
    for item in generated_json:
        # Combine headline and summary for checking
        generated_content = item["headline"] + " " + item["summary"]
        legal_results = check_legal_qualifiers(article_text, generated_content)
        if "legal_qualifiers" not in verification_results:
            verification_results["legal_qualifiers"] = []
        verification_results["legal_qualifiers"].append({
            "celebrity": item["celebrity"],
            "results": legal_results
        })
        
        if legal_results["has_legal_qualifiers"] and not legal_results["all_preserved"]:
            flag_reasons.append(f"Legal qualifiers not preserved for {item['celebrity']}")
    
    # 4. Neutrality & Tone Analysis
    for item in generated_json:
        # Combine headline and summary for checking
        generated_content = item["headline"] + " " + item["summary"]
        tone_results = analyze_tone_and_neutrality(generated_content)
        if "tone_analysis" not in verification_results:
            verification_results["tone_analysis"] = []
        verification_results["tone_analysis"].append({
            "celebrity": item["celebrity"],
            "results": tone_results
        })
        
        if not tone_results["is_neutral"]:
            flag_reasons.append(f"Non-neutral tone detected for {item['celebrity']}")
    
    # 5. Category & Taxonomy Validation
    for item in generated_json:
        category_results = validate_category_assignment(
            article_text, item["category"], item["subcategory"]
        )
        if "category_validation" not in verification_results:
            verification_results["category_validation"] = []
        verification_results["category_validation"].append({
            "celebrity": item["celebrity"],
            "results": category_results
        })
        
        if not category_results["is_valid"]:
            flag_reasons.append(f"Invalid category assignment for {item['celebrity']}")
    
    # 6. Format Validation
    format_results = validate_format(generated_json)
    verification_results["format_validation"] = format_results
    
    if not format_results["is_valid"]:
        flag_reasons.append("Format validation failed")
    
    # Overall verification result
    needs_secondary_review = len(flag_reasons) > 0
    
    return {
        "verification_passed": not needs_secondary_review,
        "needs_secondary_review": needs_secondary_review,
        "flag_reasons": flag_reasons,
        "detailed_results": verification_results
    }
```

## Verification Workflow

1. **Initial Processing**:
   - Article is processed by DeepSeek model
   - JSON output is generated

2. **Automated Verification**:
   - Run verification pipeline on generated JSON
   - Calculate verification scores and identify issues

3. **Decision Logic**:
   - If verification passes (no flags): Store directly in database
   - If minor issues detected: Send to secondary QA model
   - If major issues detected: Flag for human review

4. **Feedback Loop**:
   - Track verification results over time
   - Identify patterns in issues
   - Use insights to improve prompts and models

## Implementation Considerations

1. **Performance Optimization**:
   - Cache NLP models in memory
   - Use batch processing for efficiency
   - Implement parallel verification when possible

2. **Dependency Management**:
   - Use lightweight models where possible
   - Consider containerization for consistent environments
   - Document version requirements for all libraries

3. **Monitoring & Logging**:
   - Log all verification results
   - Track verification metrics over time
   - Set up alerts for unusual failure patterns

4. **Scalability**:
   - Design for horizontal scaling
   - Consider serverless functions for verification components
   - Implement queue-based processing for high volume

This automated verification strategy provides a robust, multi-layered approach to ensure the accuracy, neutrality, legal compliance, and proper formatting of content in the EHCO.ai platform.
