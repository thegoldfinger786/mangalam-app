import google.generativeai as genai
import os
import json
import csv

# Setup Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

def get_csv_row(chapter, verse):
    csv_path = "/Users/sandeep/DailyShlokyaAG/scripts/data/mahabharat/chapter_1_source.csv"
    with open(csv_path, mode='r', encoding='utf-8') as f:
        # The CSV has some metadata on line 1, header on line 2
        lines = f.readlines()
        header = lines[1].strip().split(';')
        data_rows = lines[2:]
        reader = csv.DictReader(data_rows, fieldnames=header, delimiter=';')
        for row in reader:
            if row['chapter_no'] == str(chapter) and row['verse_no'] == str(verse):
                return row
    return None

def generate_preview():
    chapter = 1
    verse = 1
    row = get_csv_row(chapter, verse)
    if not row:
        print("Error: Could not find Verse 1.1 in source CSV.")
        return

    # Load Prompt Template
    with open("/Users/sandeep/DailyShlokyaAG/scripts/mahabharat_prompt.md", "r") as f:
        prompt_template = f.read()

    base_source = f"EN Story: {row['translation']}\nEN Commentary: {row['commentary']}\nEN Daily Life: {row['daily_life_application']}"
    
    prompt = prompt_template.replace("{{chapter}}", str(chapter))\
                           .replace("{{verse}}", str(verse))\
                           .replace("{{base_source}}", base_source)

    print(f"--- Generating English Preview for Verse {chapter}.{verse} ---")
    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    
    content = json.loads(response.text)
    en = content['en']
    
    print(f"\nTITLE: {en['title']}")
    print(f"\nSTORY (Length: {len(en['translation'].split())} words):\n")
    print(en['translation'])
    print(f"\nCOMMENTARY:\n{en['commentary']}")
    print(f"\nDAILY LIFE APPLICATION:\n{en['daily_life_application']}")
    print(f"\nPRACTICAL EXAMPLES:\n1. {en['practical_examples'][0]}\n2. {en['practical_examples'][1]}")

if __name__ == "__main__":
    generate_preview()
