import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const RAPID_API_KEY = Deno.env.get("RAPID_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const GITA_BOOK_ID = "80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9";

const MAHABHARAT_PROMPT = `
# Gemini Prompt Template for Mahabharat Refinement

You are an expert Vedic scholar and modern life coach. Your task is to **RECREATE and EXPAND** an existing short story from the Mahabharat into a comprehensive narrative-style script for a 5-6 minute audio session.

## Input Data
- **Chapter**: {{chapter}}
- **Verse Number**: {{verse}}
- **Base Source Story**: {{base_source}}

## Output Requirements & STRICT Word Counts
1.  **Title**: Provide a title in **4-5 words** only.
2.  **Translation (Main Story)**: Expand the "Base Source Story" into a rich narrative **STRICTLY between 500-700 words**. 
    *   **Sensory Immersion**: Describe the sights, sounds, smells, and textures of the setting in great detail. 
    *   **Inner Monologue**: Describe the thoughts and feelings of the characters (e.g., Saunaka or Sauti).
    *   **Sentence Structure**: Use ONLY short, straightforward, spoken sentences. One action or emotion per sentence. 
    *   **Natural Pauses**: Use natural punctuation (periods, commas, dashes) to indicate pauses. DO NOT use explicit SSML tags like <break/>.
    *   **Crucial**: If the draft is under 500 words, add a paragraph about the historical significance of the location or the lineage of the characters. Do NOT repeat yourself.
3.  **Commentary**: Re-write into 100-150 words. Focus on 1 main (max 2) learnings. Use simple and modern language.
4.  **Daily Life Application**: This MUST be a SINGLE STRING (100-150 words) with exactly TWO distinct examples:
    *   Example 1: A specific scenario in an office/workplace.
    *   Example 2: A specific scenario in general life or at home.
    *   **Sentence style**: Keep these simple and straightforward as well.
    *   **DO NOT return an object.**

## Practical Examples
- Provide exactly ONE string in the practical_examples array: "Jai Shri Krishna" for English and "जय श्री कृष्ण" for Hindi. 

## Hindi Quality Rules
- **Pure Modern Hindi**: Use simple, pure, and modern Devanagari Hindi. 
- **STRICTLY NO URDU**: No words like 'ज़रूरत', 'कोशिश', 'इस्तेमाल', 'ज़िन्दगी', 'साफ', 'शुक्रिया', 'मदद', 'इंतज़ार', 'अफ़सोस', 'मुश्किल'. Use 'आवश्यकता', 'प्रयत्न', 'उपयोग', 'जीवन', 'स्वच्छ', 'धन्यवाद', 'सहायता', 'प्रतीक्षा', 'खेद', 'कठिन'.
- **NO ENGLISH**: No English words, English characters, or English transliterations (e.g., no 'डेटा', 'मैनेजमेंट', 'टीम', 'ऑफिस', 'प्रोजेक्ट').
- **Natural Flow**: Ensure the Hindi sounds like a natural, respectful narration.

## Pronunciation Guidelines (for English fields)
- Use standard English possessives (e.g., "Ram's", "Sita's"). The audio system will handle the specific pronunciation formatting. 

Return the output as a JSON object with keys "en" and "hi". Each with: "title", "translation", "commentary", "daily_life_application" (string), "practical_examples" (array with 1 string).
`;

const GEMINI_PROMPT = `
You are an expert Vedic scholar and modern life coach. Your task is to generate a comprehensive, narrative-style script based on a specific verse from the Bhagavad Gita or other epic. This script will be used for a 5-6 minute audio session.

## Input Data
- **Chapter**: {{chapter}}
- **Verse Number**: {{verse}}
- **Sanskrit Text**: {{sanskrit}}

## Output Requirements & Word Counts
1.  **Title**: Provide a title for the verse in **4-7 words**. Avoid "The" at start if possible.
2.  **Translation (Main Story)**: This must be the core narrative, between **500-700 words**. 
3.  **Commentary**: This should be **100-150 words** focusing on exactly 1 main or at maximum 2 learnings from the story.
4.  **Daily Life Application**: This should be **100-150 words** explaining how the teachings apply to modern life.

## Practical Examples (Exactly 2)
You must provide exactly two practical examples:
- One specific office/workplace example.
- One specific general life/home example.
These should be returned as an array of 2 strings. Do NOT include them inside the daily life application text.

## Tone, Style & Formatting
- **Short, Spoken Sentences**: Write in short, straightforward, spoken sentences suitable for audio narration. Avoid long, complex, or flowery sentences.
- **Natural Pauses**: Use natural punctuation (periods, commas, dashes) to indicate pauses. DO NOT use explicit SSML tags unless absolutely necessary.
- **Emotional Action**: Do not combine multiple emotional actions into one sentence. One action or emotion per sentence.
- **Transitions**: Ensure a smooth transition from the story into the commentary. No abrupt headers.
- **NO INTRO/SIGN-OFF**: DO NOT include any "Welcome" or "Jai Shri Krishna" messages. These are handled by the system.
- **Hindi Content Quality**:
    *   **NO URDU**: Absolutely no Urdu or Persian-derived words.
    *   **PURE HINDI**: Use simple, pure, accessible Devanagari Hindi. 
    *   **NO ENGLISH**: Do NOT use English words or English characters (A-Z) in Hindi fields. Do not transliterate English words (like 'डेटा', 'मैनेजमेंट').

Return the output as a JSON object with two top-level keys: "en" and "hi".
Each language object MUST contain: "title", "translation", "commentary", "daily_life_application", "practical_examples".
`;

async function validateHindiTransliteration(text: string) {
  const textWithoutTags = text.replace(/<[^>]*>/g, "");
  const forbiddenWords = ["डेटा", "रिपोर्ट", "टीम", "ऑफिस", "प्रोजेक्ट", "क्लाइंट", "बिजनेस", "मैनेजमेंट", "लीडर", "प्रोफेशनल", "सीनियर", "अथॉरिटी", "डेटाबेस"];
  const foundWords = forbiddenWords.filter((word) => textWithoutTags.includes(word));
  const englishCheck = /[a-zA-Z]/g;
  if (englishCheck.test(textWithoutTags)) {
    const matches = textWithoutTags.match(/[a-zA-Z]+/g);
    foundWords.push("ENGLISH_CHARS(" + (matches ? matches.join(",") : "unknown") + ")");
  }
  return foundWords;
}

function cleanText(text: string, chapter: number, verse: number) {
  if (!text) return "";
  let cleaned = text;
  const numberingRegex = new RegExp("(?:\\\\b|\\\\s|\\\\()" + chapter + "\\\\." + verse + "(?:\\\\b|\\\\s|\\\\))", "g");
  cleaned = cleaned.replace(numberingRegex, " Chapter " + chapter + " Verse " + verse + " ");
  cleaned = cleaned.replace(/Welcome to today\'s lesson\\.?/gi, "");
  cleaned = cleaned.replace(/We are in Chapter \\d+ Verse \\d+\\.?/gi, "");
  cleaned = cleaned.replace(/Jai Shri Krishna/gi, "");
  cleaned = cleaned.replace(/<break[^>]*\/>/gi, "");
  cleaned = cleaned.replace(/जय श्री कृष्ण/g, "");
  return cleaned.trim().replace(/\s+/g, " ");
}

async function generateEnhancedContent(chapter: number, verse: number, sanskritText: string, bookSlug: string, existingContent?: any, externalBase?: any) {
  let promptTemplate = GEMINI_PROMPT;
  let baseSource = "";

  if (bookSlug === 'mahabharat') {
    promptTemplate = MAHABHARAT_PROMPT;
    if (externalBase && externalBase.translation) {
        baseSource = `EN Story: ${externalBase.translation}\nEN Commentary: ${externalBase.commentary || ""}\nEN Daily Life: ${externalBase.daily_life_application || ""}`;
    } else if (existingContent && existingContent.length > 0) {
        const hi = existingContent.find((c: any) => c.language === 'hi');
        const en = existingContent.find((c: any) => c.language === 'en');
        baseSource = `EN Story: ${en?.translation || ""}\nEN Commentary: ${en?.commentary || ""}\nHI Story: ${hi?.translation || ""}\nHI Commentary: ${hi?.commentary || ""}`;
    } else {
        baseSource = "No existing story found. Use general Mahabharat context for Chapter " + chapter + " Verse " + verse + " focused on '" + sanskritText + "'";
    }
  }

  const prompt = promptTemplate
    .replace("{{chapter}}", chapter.toString())
    .replace("{{verse}}", verse.toString())
    .replace("{{sanskrit}}", sanskritText)
    .replace("{{meaning}}", sanskritText)
    .replace("{{base_source}}", baseSource);

  for (let retry = 0; retry < 5; retry++) {
    try {
      const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
      });
      
      if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Gemini HTTP ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      const rawResponse = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(rawResponse);

      const combinedHindiText = [
        parsed.hi.title,
        parsed.hi.translation,
        parsed.hi.commentary,
        parsed.hi.daily_life_application || parsed.hi.dailyLifeApplication || "",
        ...(parsed.hi.practical_examples || parsed.hi.practicalExamples || []),
      ].join(" ");

      const forbidden = await validateHindiTransliteration(combinedHindiText);
      if (forbidden.length === 0) return parsed;
      console.warn("Retry " + (retry + 1) + ": Found issues: " + forbidden.join(", "));
    } catch (err: any) {
      console.error("Verse " + chapter + "." + verse + " - Attempt " + (retry + 1) + " Error:", err.message);
      await new Promise(r => setTimeout(r, 2000 * (retry + 1)));
    }
  }
  throw new Error("Failed to generate valid content after 5 attempts.");
}

serve(async (req) => {
  try {
    const { chapter, verse, book = "gita", base_content = null } = await req.json();
    if (!chapter || !verse) return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });

    let targetBookId = GITA_BOOK_ID;
    if (book !== 'gita') {
        const { data: bookRecord } = await supabase.from("books").select("book_id").eq("slug", book).single();
        if (bookRecord) targetBookId = bookRecord.book_id;
    }

    const { data: vRow } = await supabase.from("verses")
        .select("verse_id, sanskrit, verse_content(language, translation, commentary)")
        .eq("chapter_no", chapter)
        .eq("verse_no", verse)
        .eq("book_id", targetBookId)
        .maybeSingle();

    let sanskritText = vRow?.sanskrit || "जय श्री कृष्ण";
    const existingContent = vRow?.verse_content;

    const content = await generateEnhancedContent(chapter, verse, sanskritText, book, existingContent, base_content);
    
    let verseId = vRow?.verse_id;
    if (!verseId) {
        const { data: newV } = await supabase.from("verses")
            .upsert({ book_id: targetBookId, chapter_no: chapter, verse_no: verse, ref: (book.substring(0,2).toUpperCase() + " " + chapter + "." + verse), sanskrit: sanskritText }, { onConflict: "book_id,chapter_no,verse_no" })
            .select("verse_id").single();
        verseId = newV.verse_id;
    }

    for (const lang of ["en", "hi"]) {
      await supabase.from("verse_content").upsert({
        verse_id: verseId,
        language: lang,
        title: cleanText(content[lang].title, chapter, verse),
        translation: cleanText(content[lang].translation, chapter, verse),
        commentary: cleanText(content[lang].commentary, chapter, verse),
        daily_life_application: cleanText(content[lang].daily_life_application || content[lang].dailyLifeApplication, chapter, verse),
        practical_examples: (content[lang].practical_examples || content[lang].practicalExamples || []).map((t: string) => cleanText(t, chapter, verse)),
        updated_at: new Date().toISOString()
      }, { onConflict: "verse_id,language" });
    }

    return new Response(JSON.stringify({ success: true, verse_id: verseId }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Critical Error in import-content:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
