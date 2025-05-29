import spacy
from transformers import pipeline

# # Load English model
# nlp = spacy.load("en_core_web_sm")  # You can also use "en_core_web_md" or "en_core_web_lg" for more accuracy

# # Sample text
# # text = "The World Health Organization announced on Monday that malaria cases in Africa decreased by 15% last year. The results were published in Nature journal after researchers analyzed data from 25 countries. The treatment costs approximately $50 per patient, and the third phase of trials will begin next spring."
# text = "If today is April 23rd, what date is this Friday?"

# # Process the text
# doc = nlp(text)

# # Extract named entities
# for ent in doc.ents:
#     print(f"Entity: {ent.text}, Type: {ent.label_}")

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

original_text = """S Korea-pop culture SEOUL, April 7 (Yonhap) -- Foreigners who have experienced South Korean pop culture associate the country with its popular music, dubbed K-pop, more than any other form of content, a government report showed Monday. The annual report by the Ministry of Culture, Sports and Tourism and its affiliate, the Korean Foundation for International Cultural Exchange, showed that 17.8 percent of respondents with prior exposure to Korean pop culture said they first thought of K-pop when thinking of South Korea. This was the eighth consecutive year in which K-pop topped the category. Korean cuisine, or hansik, ranked second with 11.8 percent, followed by K-drama at 8.7 percent. The chart-topping boy group BTS ranked as the favorite K-pop act for the seventh straight year with 24.6 percent of support from respondents, with the girl group BLACKPINK coming in second place for the sixth straight year. Jungkook, a member of BTS, ranked sixth. This June 24, 2024, file photo provided by BigHit Music shows Jungkook, a member of the K-pop group BTS. (PHOTO NOT FOR SALE) (Yonhap) The report was based on an online survey of 26,400 people in 28 countries from Nov. 29 to Dec. 27, including China, Japan, Thailand, Malaysia, the United States, Canada and South Africa. The ministry said the Philippines and Hong Kong were included for the first time. 'Squid Game', a popular Netflix series, ranked as the favorite Korean TV series for the fourth straight year. The Oscar-winning film 'Parasite' claimed the top spot among films for the fifth straight year. Nearly 60 percent of the respondents said they were willing to purchase Korean products or services after experiencing the country's cultural content. Also in the report, 70.3 percent of respondents viewed Korean pop culture content favorably, up 1.5 percentage points from a year ago, with countries such as the Philippines (88.9 percent), Indonesia (86.5 percent) and India (84.5 percent) doing the heavy lifting. On the flip side, negative perceptions of the global boom of Korean culture, known as 'hallyu,' also went up, from 32.6 percent last year to 37.5 percent this year. People cited excessive commercialism (15 percent) and North Korean threats (13.2 percent) as reasons. (END)"""

focused_text = "Summarize this text focusing on BLACKPINK: " + original_text

summary = summarizer(
    focused_text,
    max_length=150,           # Maximum length of the summary in tokens
    min_length=50,            # Minimum length of the summary in tokens
    do_sample=True,           # Use sampling instead of greedy decoding
    temperature=0.7,          # Control randomness (lower = more deterministic)
    top_k=50,                 # Limit to top k tokens with highest probability
    top_p=0.95,               # Nucleus sampling parameter
    num_beams=4,              # Number of beams for beam search
    early_stopping=True,      # Stop beam search when suitable candidates are found
    no_repeat_ngram_size=2    # Avoid repeating ngrams of this size
)

print(summary[0]['summary_text'])