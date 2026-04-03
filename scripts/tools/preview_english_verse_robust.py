import urllib.request
import json
import os

def generate_preview():
    api_key = "AIzaSyAsAhe1ioeVcPr9pRoXkDqBsj6spPmTg2I"
    chapter = 1
    verse = 1
    
    # Load Prompt Template
    with open("/Users/sandeep/DailyShlokyaAG/scripts/mahabharat_prompt.md", "r") as f:
        prompt_template = f.read()

    base_source = "EN Story: In the ancient and hallowed Naimisha forest, a profound twelve-year sacrifice was underway... (Verse 1.1)"
    
    prompt = prompt_template.replace("{{chapter}}", str(chapter))\
                           .replace("{{verse}}", str(verse))\
                           .replace("{{base_source}}", base_source)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    data = {
        "contents": [{"parts":[{"text": prompt}]}],
        "generation_config": {"response_mime_type": "application/json"}
    }
    
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            res_json = json.loads(res_body)
            content_text = res_json['candidates'][0]['content']['parts'][0]['text']
            parsed = json.loads(content_text)
            
            en = parsed['en']
            print("\nTITLE:", en['title'])
            print(f"\nSTORY (Words: {len(en['translation'].split())}):\n")
            print(en['translation'])
            print("\nCOMMENTARY:\n", en['commentary'])
            print("\nDAILY LIFE:\n", en['daily_life_application'])
            print("\nEXAMPLES:\n", en['practical_examples'])
            
    except Exception as e:
        print("Error:", e)
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8'))

if __name__ == "__main__":
    generate_preview()
