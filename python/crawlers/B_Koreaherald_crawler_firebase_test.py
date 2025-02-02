from langchain_ollama import OllamaLLM
import pandas as pd
from datetime import datetime
from typing import Dict, Optional, List
import json
import os

class CelebrityIdentifier:
    def __init__(self, stage_name: str, korean_name: str):
        self.stage_name = stage_name
        self.korean_name = korean_name

class NewsAnalyzer:
    def __init__(self, celebrity: CelebrityIdentifier):
        print(f"Initializing analyzer for {celebrity.stage_name}...")
        self.celebrity = celebrity
        self.llm = OllamaLLM(model="llama3.2:latest")
        
        # Category definitions
        self.categories = {
            'Music': ['Album Release', 'Collaboration', 'Performance', 'Tour/concert', 'Music Awards'],
            'Acting': ['Drama/series', 'Film', 'OTT', 'Film/TV/drama Awards', 'Variety show'],
            'Promotion': ['Fan meeting', 'Media appearance', 'Social media', 'Interviews', 'Brand activities'],
            'Social': ['Donation', 'Health/diet', 'Daily fashion', 'Airport fashion', 'Family', 'Friends/companion', 
                      'Marriage/relationship', 'Pets', 'Company/representation', 'Political stance', 'Social Recognition', 'Real estate'],
            'Controversy': ['Plagiarism', 'Romance', 'Political Controversy']
        }

    def _create_initial_prompt(self, article: Dict) -> str:
        categories_str = "\n".join([
            f"- {cat}: {', '.join(subs)}" for cat, subs in self.categories.items()
        ])
        
        prompt = f"""TASK: Analyze this article for {self.celebrity.stage_name} ({self.celebrity.korean_name}) content.

STEP 1: Check if {self.celebrity.stage_name} is mentioned.
If {self.celebrity.stage_name} is NOT mentioned, return exactly:
{{
    "main_category": "None",
    "sub_category": "None",
    "heading": "No {self.celebrity.stage_name} Content",
    "subheading": "Article does not mention {self.celebrity.stage_name}"
}}

STEP 2: If {self.celebrity.stage_name} IS mentioned:
1. Choose ONE category and subcategory from:
{categories_str}

2. Create heading that MUST:
- Describe one main action
- Use active voice
- Be specific and factual
- NOT use words like "star," "singer," "actress"

3. Create subheading that MUST:
- Add new information
- Include context
- Use simple language

Article text:
{article['content']}

Return ONLY a JSON object like this:
{{
    "main_category": "exact category name",
    "sub_category": "exact subcategory name",
    "heading": "heading starting with {self.celebrity.stage_name}",
    "subheading": "subheading starting with {self.celebrity.stage_name}"
}}"""

        return prompt

    def analyze_article(self, article: Dict) -> Optional[Dict]:
        try:
            print(f"\nAnalyzing article: {article['title'][:100]}...")
            response = self.llm.invoke(self._create_initial_prompt(article))
            
            try:
                result = json.loads(response)
                
                # Skip if not about the celebrity
                if result['main_category'] == 'None':
                    print("Article not relevant - skipping")
                    return None
                
                return {
                    'Date': article.get('date', ''),
                    'Title': article['title'],
                    'Content': article['content'],
                    'Source': article.get('source', ''),
                    'URL': article.get('url', ''),
                    'MainCategory': result['main_category'],
                    'SubCategory': result['sub_category'],
                    'GeneratedHeading': result['heading'],
                    'GeneratedSubheading': result['subheading']
                }
            except json.JSONDecodeError:
                print("Error: Invalid JSON response from LLM")
                print(f"Raw response: {response[:200]}...")
                return None
                
        except Exception as e:
            print(f"Error during analysis: {str(e)}")
            return None

    def process_csv(self, input_file: str) -> pd.DataFrame:
        try:
            print(f"Reading articles from {input_file}")
            df = pd.read_csv(input_file)
            articles = df.to_dict('records')
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            # Phase 1: Initial Analysis
            print("\nPhase 1: Initial Analysis")
            results = []
            
            for idx, article in enumerate(articles, 1):
                print(f"\nProcessing article {idx}/{len(articles)}")
                result = self.analyze_article(article)
                if result:
                    results.append(result)
                    print(f"Successfully categorized as: {result['MainCategory']}/{result['SubCategory']}")
                    print(f"Generated heading: {result['GeneratedHeading']}")

            if not results:
                print("No relevant articles found")
                return pd.DataFrame()
            
            # Save results
            output_df = pd.DataFrame(results)
            output_file = f'analyzed_{self.celebrity.stage_name.lower().replace(" ", "")}_{timestamp}.csv'
            output_df.to_csv(output_file, index=False, encoding='utf-8-sig')
            
            print(f"\nProcessed {len(results)} articles")
            print(f"Results saved to: {output_file}")
            
            return output_df
            
        except Exception as e:
            print(f"Error processing CSV: {str(e)}")
            return pd.DataFrame()

def main():
    input_file = "/Users/byungjoopark/Desktop/Coding/ehco-dev/python/crawlers/python/backup/raw_koreaherald_iu_20250120_183837.csv"
    
    celebrity = CelebrityIdentifier(
        stage_name="IU",
        korean_name="아이유"
    )
    
    analyzer = NewsAnalyzer(celebrity)
    
    if not os.path.exists(input_file):
        print(f"Error: Input file not found at {input_file}")
        print("Please ensure your CSV file is in the correct location")
        return
        
    analyzer.process_csv(input_file)

if __name__ == "__main__":
    main()