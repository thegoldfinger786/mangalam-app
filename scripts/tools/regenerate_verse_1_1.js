#!/usr/bin/env node
/**
 * Regenerate Verse 1.1 of Mahabharat from scratch using CSV source.
 * - Reads the base story from chapter_1_source.csv
 * - Expands using Gemini 2.5 Flash (no break tags)
 * - Saves English + Hindi content to Supabase
 * - Triggers TTS for both languages/genders
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yhuvjcmemsqjkttizxem.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GEMINI_API_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── 1. Read CSV ────────────────────────────────────────────────────────────
function readVerse11FromCSV() {
  const csvPath = path.join(__dirname, 'data/mahabharat/chapter_1_source.csv');
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split('\n');
  
  for (const line of lines) {
    const parts = line.split(';');
    if (parts[1] === '1' && parts[2] === '1' && parts[3] === 'en') {
      return {
        translation: parts[5] || '',
        commentary: parts[6] || '',
        daily_life_application: parts[7] || '',
      };
    }
  }
  throw new Error('Verse 1.1 not found in CSV');
}

// ─── 2. Gemini Prompt ────────────────────────────────────────────────────────
const PROMPT_TEMPLATE = `
You are an expert Vedic scholar and modern life coach. Your task is to RECREATE and EXPAND an existing story from the Mahabharat into a comprehensive narrative-style script for a 5-6 minute audio session.

## Input Data
- Chapter: 1
- Verse Number: 1
- Base Source Story (English): {{base_en}}
- Base Source Commentary (English): {{base_commentary}}
- Base Source Daily Life (English): {{base_daily}}

## CRITICAL RULES - READ CAREFULLY
1. DO NOT use any SSML tags. NO <break time="500ms"/>, NO <break/> of any kind. Use natural sentence endings (periods, commas, dashes) for pacing.
2. DO NOT use markdown formatting like **bold**. Write plain prose.
3. Write in short, spoken sentences suitable for audio. One action or emotion per sentence.

## Output Requirements
1. Title: 4-5 words maximum
2. Translation (Main Story): STRICTLY 500-700 words. Expand the base story with:
   - Sensory details (sights, sounds, smells of Naimisha forest)
   - Character inner thoughts and feelings (Saunaka, Sauti, the assembled sages)
   - Short, punchy sentences. No rambling.
3. Commentary: 100-150 words. Focus on 1 main learning.
4. Daily Life Application: A SINGLE STRING of 100-150 words with exactly TWO examples:
   - Example 1: A workplace/office scenario
   - Example 2: A home/general life scenario
   - DO NOT return an object or numbered list. Write as flowing prose that naturally includes both examples.
5. Practical Examples: An array with exactly ONE string: the religious sign-off.

## Hindi Requirements
- Pure Modern Hindi only. No Urdu words like जरूरत, कोशिश, जिंदगी, साफ, मदद. Use आवश्यकता, प्रयत्न, जीवन, स्वच्छ, सहायता.
- No English words or characters in Hindi fields.
- NO SSML tags in Hindi either.

Return a JSON object with keys "en" and "hi". Each with: "title", "translation", "commentary", "daily_life_application" (string), "practical_examples" (array with 1 string for "Jai Shri Krishna" / "जय श्री कृष्ण").
`;

// ─── 3. Generate ────────────────────────────────────────────────────────────
async function generateContent(base) {
  const prompt = PROMPT_TEMPLATE
    .replace('{{base_en}}', base.translation)
    .replace('{{base_commentary}}', base.commentary)
    .replace('{{base_daily}}', base.daily_life_application);

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`\nAttempt ${attempt}/5 - Calling Gemini 2.5 Flash...`);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: 'application/json' },
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Gemini error ${resp.status}: ${err}`);
      }

      const data = await resp.json();
      const raw = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(raw);
      
      // Validate: no break tags allowed
      const allText = JSON.stringify(parsed);
      if (allText.includes('<break')) {
        console.warn(`Warning: break tags found in output, retrying...`);
        continue;
      }
      
      // Validate Hindi - no English chars in Hindi fields
      const hiText = [parsed.hi.translation, parsed.hi.commentary, parsed.hi.daily_life_application].join(' ');
      if (/[a-zA-Z]/.test(hiText)) {
        const matches = hiText.match(/[a-zA-Z]+/g);
        console.warn(`Warning: English chars in Hindi (${matches?.slice(0,5).join(',')}), retrying...`);
        continue;
      }

      // Validate word count
      const enWords = parsed.en.translation.split(/\s+/).length;
      console.log(`English story word count: ${enWords}`);
      if (enWords < 400) {
        console.warn(`Too short (${enWords} words), retrying...`);
        continue;
      }

      return parsed;
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message);
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
  throw new Error('Failed after 5 attempts');
}

// ─── 4. Clean text helper ───────────────────────────────────────────────────
function clean(text) {
  if (!text) return '';
  return text
    .replace(/<break[^>]*\/>/gi, '')
    .replace(/\*\*/g, '')
    .replace(/Jai Shri Krishna/gi, '')
    .replace(/जय श्री कृष्ण/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── 5. Save to Supabase ────────────────────────────────────────────────────
async function saveToSupabase(content, verseId) {
  for (const lang of ['en', 'hi']) {
    const c = content[lang];
    const { error } = await supabase.from('verse_content').upsert({
      verse_id: verseId,
      language: lang,
      title: clean(c.title),
      translation: clean(c.translation),
      commentary: clean(c.commentary),
      daily_life_application: clean(c.daily_life_application || c.dailyLifeApplication),
      practical_examples: lang === 'en' ? ['Jai Shri Krishna'] : ['जय श्री कृष्ण'],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'verse_id,language' });
    
    if (error) throw new Error(`DB upsert error (${lang}): ${error.message}`);
    console.log(`✅ Saved ${lang} content`);
  }
}

// ─── 6. Trigger TTS ─────────────────────────────────────────────────────────
async function triggerTTS(verseId) {
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_ANON_KEY) {
    console.warn('SUPABASE_ANON_KEY not set, skipping TTS trigger. Run manually.');
    return;
  }
  
  const ttsUrl = `${SUPABASE_URL}/functions/v1/generate-tts`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };
  
  const combos = [
    { language: 'en', gender: 'male' },
    { language: 'en', gender: 'female' },
    { language: 'hi', gender: 'male' },
    { language: 'hi', gender: 'female' },
  ];
  
  for (const combo of combos) {
    console.log(`\nGenerating TTS: ${combo.language} ${combo.gender}...`);
    try {
      const r = await fetch(ttsUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ verse_id: verseId, ...combo, force: true }),
      });
      const result = await r.json();
      if (result.error) throw new Error(result.error);
      console.log(`✅ TTS ${combo.language}/${combo.gender}: ${result.path}`);
    } catch (err) {
      console.error(`❌ TTS ${combo.language}/${combo.gender} failed:`, err.message);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Regenerating Mahabharat Verse 1.1 ===\n');
  
  // Get verse_id
  const { data: bookData } = await supabase.from('books').select('book_id').eq('slug', 'mahabharat').single();
  if (!bookData) throw new Error('Mahabharat book not found');
  
  const { data: verseData } = await supabase.from('verses')
    .select('verse_id')
    .eq('book_id', bookData.book_id)
    .eq('chapter_no', 1)
    .eq('verse_no', 1)
    .single();
  
  if (!verseData) throw new Error('Verse 1.1 not found in DB');
  const verseId = verseData.verse_id;
  console.log(`Verse ID: ${verseId}`);
  
  // Read CSV
  console.log('\nReading from CSV...');
  const base = readVerse11FromCSV();
  console.log(`CSV story length: ${base.translation.split(/\s+/).length} words`);
  
  // Generate
  const content = await generateContent(base);
  console.log('\n=== Generated Content Preview ===');
  console.log('EN Title:', content.en.title);
  console.log('EN Story words:', content.en.translation.split(/\s+/).length);
  console.log('EN Commentary words:', content.en.commentary.split(/\s+/).length);
  console.log('HI Title:', content.hi.title);
  console.log('HI Story words:', content.hi.translation.split(/\s+/).length);
  console.log('\nEN Story (first 200 chars):', content.en.translation.substring(0, 200));
  console.log('\nHI Story (first 200 chars):', content.hi.translation.substring(0, 200));
  console.log('\nEN Daily Life:', content.en.daily_life_application);
  
  // Save
  console.log('\n=== Saving to Supabase ===');
  await saveToSupabase(content, verseId);
  
  // TTS
  console.log('\n=== Generating TTS ===');
  await triggerTTS(verseId);
  
  console.log('\n✅ All done! Verse 1.1 regenerated successfully.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
