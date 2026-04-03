import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { processToSsml } from './lib/tts_processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const RAPID_API_KEY = process.env.RAPID_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_API_KEY = process.env.TTS_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const GITA_BOOK_ID = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9';

console.log('DEBUG: TTS_API_KEY length:', (process.env.TTS_API_KEY || '').length);
console.log('DEBUG: TTS_API_KEY starts with:', (process.env.TTS_API_KEY || '').substring(0, 10));

let FORCE_REGENERATE = false; // Set to true to overwrite existing content/audio

const cleanText = (text: string, chapter: number, verse: number) => {
    if (!text) return "";
    let cleaned = text;
    // Remove robotic numbering like "2.47" or "Verse 2.47"
    const numberingRegex = new RegExp(`(\\b|\\s|\\()${chapter}\\.${verse}(\\b|\\s|\\))`, 'g');
    cleaned = cleaned.replace(numberingRegex, ` Chapter ${chapter} Verse ${verse} `);

    // Remove redundant welcome messages if AI generated them anyway
    cleaned = cleaned.replace(/Welcome to today's lesson\.?/gi, "");
    cleaned = cleaned.replace(/We are in Chapter \d+ Verse \d+\.?/gi, "");
    cleaned = cleaned.replace(/आज के पाठ में आपका स्वागत है।?/g, "");
    cleaned = cleaned.replace(/हम अध्याय \d+ श्लोक \d+ में हैं।?/g, "");

    return cleaned.trim().replace(/\s+/g, ' ');
};

const sleep = (ms: number) => new Uint8Array(new SharedArrayBuffer(4)); // This is a hack for older node, using standard setTimeout is better in async
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const VOICES = {
    en: {
        male: 'en-IN-Neural2-B',   // Clear Indian English Male
        female: 'en-IN-Neural2-A'  // Clear Indian English Female
    },
    hi: {
        male: 'hi-IN-Neural2-B',   // Deep Hindi Male
        female: 'hi-IN-Neural2-A'  // Traditional Hindi Female
    }
};

const fetchSanskritVerse = async (chapter: number, verse: number) => {
    const options = {
        method: 'GET',
        url: `https://bhagavad-gita3.p.rapidapi.com/v2/chapters/${chapter}/verses/${verse}/`,
        headers: {
            'x-rapidapi-key': RAPID_API_KEY,
            'x-rapidapi-host': 'bhagavad-gita3.p.rapidapi.com'
        }
    };
    const response = await axios.request({ ...options, timeout: 15000 });
    return response.data;
};

const validateHindiTransliteration = (text: string) => {
    const forbiddenWords = ['डेटा', 'रिपोर्ट', 'टीम', 'ऑफिस', 'प्रोजेक्ट', 'क्लाइंट', 'बिजनेस', 'मैनेजमेंट', 'लीडर', 'प्रोफेशनल', 'सीनियर', 'अथॉरिटी', 'डेटाबेस'];
    const foundWords = forbiddenWords.filter(word => text.includes(word));
    return foundWords;
};

const generateEnhancedContent = async (chapter: number, verse: number, sanskritText: string) => {
    const promptTemplate = fs.readFileSync(path.join(__dirname, 'gemini_prompt.md'), 'utf-8');
    const prompt = promptTemplate
        .replace('{{chapter}}', chapter.toString())
        .replace('{{verse}}', verse.toString())
        .replace('{{sanskrit}}', sanskritText);

    let retryCount = 0;
    while (retryCount < 5) {
        try {
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            }, { timeout: 30000 });

            const text = response.data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(text);

            // Validate Hindi content for transliterations
            if (parsed.hi) {
                const combinedHindiText = [
                    parsed.hi.translation,
                    parsed.hi.commentary,
                    parsed.hi.daily_life_application || parsed.hi.dailyLifeApplication,
                    ...(parsed.hi.practical_examples || parsed.hi.practicalExamples || [])
                ].join(' ');

                const forbiddenFound = validateHindiTransliteration(combinedHindiText);
                if (forbiddenFound.length > 0) {
                    console.warn(`Retry ${retryCount + 1}: Found forbidden transliterations in Hindi: ${forbiddenFound.join(', ')}`);
                    retryCount++;
                    continue;
                }
            }

            return parsed;
        } catch (err: any) {
            retryCount++;
            console.error(`Gemini Generation Error (Attempt ${retryCount}):`, err.message);
            if (retryCount >= 5) throw err;
            await delay(5000 * retryCount); // Exponential backoff
        }
    }
};


const validateHindiContent = (text: string, fieldName: string) => {
    if (/[a-zA-Z]/.test(text)) {
        throw new Error(`CRITICAL: English characters detected in Hindi field ${fieldName}: "${text.match(/[a-zA-Z]+/g)?.join(', ')}"`);
    }
};

const processVerse = async (chapter: number, verse: number) => {
    try {
        console.log(`\n--- Processing BG ${chapter}.${verse} (Force: ${FORCE_REGENERATE}) ---`);

        // 1. Get Verse Metadata
        let { data: dbVerse, error: fetchErr } = await supabase
            .from('verses')
            .select('*')
            .eq('book_id', GITA_BOOK_ID)
            .eq('chapter_no', chapter)
            .eq('verse_no', verse)
            .single();

        if (fetchErr && fetchErr.code !== 'PGRST116') {
            console.error(`Fetch Error BG ${chapter}.${verse}:`, fetchErr.code, fetchErr.message, fetchErr.details);
        }

        if ((fetchErr && fetchErr.code === 'PGRST116') || !dbVerse) {
            console.log(`Verse BG ${chapter}.${verse} not found or duplicate check failed. Upserting entry...`);
            const apiData = await fetchSanskritVerse(chapter, verse);
            const { data: newVerse, error: insErr } = await supabase
                .from('verses')
                .upsert({
                    book_id: GITA_BOOK_ID,
                    chapter_no: chapter,
                    verse_no: verse,
                    ref: `BG ${chapter}.${verse}`,
                    sanskrit: apiData.text
                }, { onConflict: 'book_id,chapter_no,verse_no' })
                .select()
                .single();

            if (insErr) throw insErr;
            dbVerse = newVerse;
        }
        const verseUuid = dbVerse.verse_id;
        let sanskritText = dbVerse.sanskrit;

        // 2. Fetch Sanskrit if missing
        if (!sanskritText) {
            console.log('Sanskrit missing. Fetching from RapidAPI...');
            const apiData = await fetchSanskritVerse(chapter, verse);
            sanskritText = apiData.text;
            await supabase.from('verses').update({ sanskrit: sanskritText }).eq('verse_id', verseUuid);
            console.log('Sanskrit saved.');
        }

        const langs = ['en', 'hi'] as const;
        const genders = ['male', 'female'] as const;
        const enhanced: any = {};

        // 3. Process Text Content
        if (FORCE_REGENERATE) {
            console.log('Force active: Wiping existing text content...');
            await supabase.from('verse_content').delete().eq('verse_id', verseUuid);
        }

        for (const lang of langs) {
            const { data: existingText } = await supabase
                .from('verse_content')
                .select('*')
                .eq('verse_id', verseUuid)
                .eq('language', lang)
                .single();

            if (existingText && !FORCE_REGENERATE) {
                console.log(`${lang} narratives already exist.`);
                enhanced[lang] = {
                    translation: existingText.translation,
                    commentary: existingText.commentary,
                    dailyLifeApplication: existingText.daily_life_application,
                    practicalExamples: existingText.practical_examples,
                    updatedAt: existingText.updated_at,
                    fullNarrative: [
                        lang === 'en'
                            ? `Welcome to today's lesson. We are in Chapter ${chapter} Verse ${verse}.`
                            : `आज के पाठ में आपका स्वागत है। हम अध्याय ${chapter} श्लोक ${verse} में हैं।`,
                        sanskritText,
                        existingText.translation,
                        existingText.commentary,
                        existingText.daily_life_application,
                        ...existingText.practical_examples
                    ].join('\n\n')
                };
            } else {
                if (!enhanced.en) {
                    console.log('Generating dual-language narratives via Gemini...');
                    const genData = await generateEnhancedContent(chapter, verse, sanskritText);
                    enhanced.en = genData.en;
                    enhanced.hi = genData.hi;

                    // VALIDATE HINDI CONTENT
                    console.log('Validating Hindi content for English words...');
                    validateHindiContent(enhanced.hi.translation, 'translation');
                    validateHindiContent(enhanced.hi.commentary, 'commentary');
                    validateHindiContent(enhanced.hi.dailyLifeApplication || enhanced.hi.daily_life_application, 'dailyLifeApplication');
                    const hiPosEx = enhanced.hi.practicalExamples || enhanced.hi.practical_examples || [];
                    hiPosEx.forEach((ex: string, i: number) => validateHindiContent(ex, `practicalExamples[${i}]`));
                }

                // Normalize and clean fields (handle both formats from Gemini)
                const translation = cleanText(enhanced[lang].translation, chapter, verse);
                const commentary = cleanText(enhanced[lang].commentary, chapter, verse);
                const dailyLife = cleanText(enhanced[lang].dailyLifeApplication || enhanced[lang].daily_life_application, chapter, verse);
                const rawExamples = enhanced[lang].practicalExamples || enhanced[lang].practical_examples || [];
                const examples = rawExamples.map((ex: string) => cleanText(ex, chapter, verse));

                // Construct fullNarrative manually to ensure perfect sync with UI
                const intro = lang === 'en'
                    ? `Welcome to today's lesson. We are in Chapter ${chapter} Verse ${verse}.`
                    : `आज के पाठ में आपका स्वागत है। हम अध्याय ${chapter} श्लोक ${verse} में हैं।`;

                enhanced[lang].fullNarrative = [
                    intro,
                    sanskritText,
                    translation,
                    commentary,
                    dailyLife,
                    ...examples
                ].join('\n\n');

                console.log(`Saving ${lang} text content...`);
                await supabase.from('verse_content').upsert({
                    verse_id: verseUuid,
                    language: lang,
                    translation: translation,
                    commentary: commentary,
                    daily_life_application: dailyLife,
                    practical_examples: examples
                }, { onConflict: 'verse_id,language' });
                
                enhanced[lang].updatedAt = new Date().toISOString();
            }
        }

        // 4. Process Audio Content
        if (FORCE_REGENERATE) {
            console.log('Force active: Wiping existing audio cache...');
            await supabase.from('audio_cache').delete().match({
                content_type: 'verse',
                content_id: verseUuid
            });
        }

        for (const lang of langs) {
            for (const gender of genders) {
                console.log(`   🔊 Syncing Edge Function for ${lang}/${gender}...`);
                const { data, error } = await supabase.functions.invoke('generate-tts', {
                    body: {
                        verse_id: verseUuid,
                        language: lang,
                        gender: gender,
                        force: FORCE_REGENERATE
                    }
                });

                if (error) {
                    console.error(`   ❌ Failed ${lang}/${gender}:`, error);
                } else {
                    const status = data.status === 'skipped' ? '✅ Up to date' : '✅ Regenerated';
                    console.log(`   ${status}: ${data.path}`);
                }
            }
        }

        console.log(`\nSUCCESS: BG ${chapter}.${verse} fully processed!`);
    } catch (err: any) {
        if (axios.isAxiosError(err)) {
            console.error('FATAL ERROR:', err.config?.url, err.response?.status, err.response?.data);
        } else {
            console.error('FATAL ERROR:', err.message);
        }
        // Repropagate error to batch processor
        throw err;
    }
};

const processBatch = async (chapter: number, startVerse: number, endVerse: number) => {
    console.log(`\n🚀 STARTING BATCH: Chapter ${chapter}, Verses ${startVerse}-${endVerse}`);
    const concurrency = 1;

    for (let v = startVerse; v <= endVerse; v++) {
        let retryCount = 0;
        const maxRetries = 2;
        let success = false;

        while (retryCount <= maxRetries && !success) {
            try {
                await processVerse(chapter, v);
                success = true;
            } catch (error: any) {
                if (error.message.includes('CRITICAL: English characters detected')) {
                    console.warn(`Attempt ${retryCount + 1} failed for BG ${chapter}.${v} due to English in Hindi. Retrying...`);
                    retryCount++;
                    await delay(1000); // Backoff
                } else {
                    console.error(`Stopping batch for BG ${chapter}.${v} due to error: ${error.message}`);
                    throw error; // Stop batch for other errors
                }
            }
        }

        if (!success) {
            console.error(`\n❌ FAILED to process BG ${chapter}.${v} after ${maxRetries} retries.`);
            throw new Error(`Batch failed at BG ${chapter}.${v}`);
        }

        console.log(`Waiting 2 seconds before next verse...`);
        await delay(2000);
    }
    console.log(`\n✅ BATCH COMPLETE!`);
};

const auditAudioSync = async () => {
    console.log(`\n🔍 AUDITING AUDIO SYNCHRONIZATION...`);
    const { data: missingAudio, error } = await supabase.rpc('audit_audio_sync');
    if (error) {
        console.error('Error running audit:', error.message);
        return;
    }
    
    if (!missingAudio || missingAudio.length === 0) {
        console.log('✅ All audio files are synced perfectly!');
        return;
    }

    console.log(`⚠️ Found ${missingAudio.length} missing audio files:`);
    missingAudio.forEach((item: any) => {
        console.log(`  - Book: ${item.book}, Chapter: ${item.chapter_no}, Verse: ${item.verse_no}, Lang: ${item.language}`);
    });
};

// Execute Batch
(async () => {
    const args = process.argv.slice(2);
    const chapterIndex = args.indexOf('--chapter');
    const chapterArg = args.find(a => a.startsWith('--chapter='))?.split('=')[1] || (chapterIndex !== -1 ? args[chapterIndex + 1] : undefined);
    const verseIndex = args.indexOf('--verse');
    const verseArg = args.find(a => a.startsWith('--verse='))?.split('=')[1] || (verseIndex !== -1 ? args[verseIndex + 1] : undefined);
    const endVerseIndex = args.indexOf('--endVerse');
    const endVerseArg = args.find(a => a.startsWith('--endVerse='))?.split('=')[1] || (endVerseIndex !== -1 ? args[endVerseIndex + 1] : undefined);
    const forceArg = args.includes('--force');
    const auditArg = args.includes('--audit');

    if (auditArg) {
        await auditAudioSync();
        return;
    }

    if (forceArg) {
        FORCE_REGENERATE = true;
        console.log('FORCE_REGENERATE set to true via CLI');
    }

    if (chapterArg && verseArg) {
        const chapter = parseInt(chapterArg);
        const startVerse = parseInt(verseArg);
        const endVerse = endVerseArg ? parseInt(endVerseArg) : (chapter === 10 ? 42 : (chapter === 9 ? 34 : (chapter === 2 ? 72 : 20))); 
        console.log(`Resuming BG ${chapter} from verse ${startVerse} to ${endVerse}`);
        await processBatch(chapter, startVerse, endVerse);
    } else if (chapterArg) {
        const chapter = parseInt(chapterArg);
        const endVerse = endVerseArg ? parseInt(endVerseArg) : (chapter === 10 ? 42 : (chapter === 9 ? 34 : (chapter === 2 ? 72 : 20))); 
        await processBatch(chapter, 1, endVerse);
    } else {
        // Default to Chapter 9 batch if no args
        await processBatch(9, 1, 34);
    }
})();

