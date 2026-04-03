import requests
import csv
import json
import os

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

CSV_PATH = "/Users/sandeep/DailyShlokyaAG/scripts/data/mahabharat/chapter_1_source.csv"

def get_csv_row(chapter, verse):
    with open(CSV_PATH, mode='r', encoding='utf-8') as f:
        # The CSV uses semicolon as delimiter
        reader = csv.DictReader(f, delimiter=';')
        # Skip the first garbage line if necessary, but DictReader might handle it if we adjust
        # Actually the first line is "adi_parva_1_84_v2_translations_final;;;;;;;;"
        # Let's read lines manually to find the header
        f.seek(0)
        lines = f.readlines()
        header_line = lines[1] # book_slug;chapter_no;verse_no;...
        data_lines = lines[2:]
        
        reader = csv.DictReader(data_lines, fieldnames=header_line.strip().split(';'), delimiter=';')
        for row in reader:
            if row['chapter_no'] == str(chapter) and row['verse_no'] == str(verse):
                return row
    return None

def test_verse_1_1():
    row = get_csv_row(1, 1)
    if not row:
        print("Error: Could not find Verse 1.1 in CSV")
        return

    payload = {
        "chapter": 1,
        "verse": 1,
        "book": "mahabharat",
        "base_content": {
            "translation": row['translation'],
            "commentary": row['commentary'],
            "daily_life_application": row['daily_life_application']
        }
    }

    print(f"Triggering import-content for Verse 1.1...")
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    resp = requests.post(f"{SUPABASE_URL}/functions/v1/import-content", json=payload, headers=headers)
    print(f"Status: {resp.status_code}")
    print(resp.text)

if __name__ == "__main__":
    test_verse_1_1()
