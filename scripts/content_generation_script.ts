import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const RAPID_API_KEY = process.env.RAPID_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_API_KEY = process.env.TTS_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const GITA_BOOK_ID = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9';

const FORCE_REGENERATE = true; // Set to true to overwrite existing content/audio

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
    const response = await axios.request(options);
    return response.data;
};

const generateEnhancedContent = async (chapter: number, verse: number, sanskritText: string) => {
    const promptTemplate = fs.readFileSync(path.join(__dirname, 'gemini_prompt.md'), 'utf-8');
    const prompt = promptTemplate
        .replace('{{chapter}}', chapter.toString())
        .replace('{{verse}}', verse.toString())
        .replace('{{sanskrit}}', sanskritText);

    const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
    });

    const text = response.data.candidates[0].content.parts[0].text;
    return JSON.parse(text);
};

const generateTTS = async (text: string, languageCode: string, voiceName: string) => {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_CLOUD_API_KEY}`;

    // Split text into chunks to stay under 5000 byte limit (roughly 1500 chars for safety in Devanagari)
    const chunkSize = languageCode === 'hi-IN' ? 1200 : 4000;
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }

    console.log(`Generating TTS in ${chunks.length} chunks...`);
    const audioBuffers: Buffer[] = [];

    for (const chunk of chunks) {
        const data = {
            input: { text: chunk },
            voice: { languageCode, name: voiceName },
            audioConfig: { audioEncoding: 'MP3' }
        };

        const response = await axios.post(url, data);
        audioBuffers.push(Buffer.from(response.data.audioContent, 'base64'));
    }

    return Buffer.concat(audioBuffers);
};

const uploadToSupabase = async (buffer: Buffer, storagePath: string) => {
    const { data, error } = await supabase.storage
        .from('audio-content')
        .upload(storagePath, buffer, {
            contentType: 'audio/mpeg',
            upsert: true
        });

    if (error) throw error;
    return data.path;
};

const processVerse = async (chapter: number, verse: number) => {
    try {
        console.log(`\n--- Processing BG ${chapter}.${verse} (Force: ${FORCE_REGENERATE}) ---`);

        // 1. Get Verse Metadata
        let { data: dbVerse, error: fetchErr } = await supabase
            .from('verses')
            .select('*')
            .eq('chapter_no', chapter)
            .eq('verse_no', verse)
            .single();

        if (fetchErr || !dbVerse) {
            console.log(`Verse BG ${chapter}.${verse} not found. Creating entry...`);
            const apiData = await fetchSanskritVerse(chapter, verse);
            const { data: newVerse, error: insErr } = await supabase
                .from('verses')
                .insert({
                    book_id: GITA_BOOK_ID,
                    chapter_no: chapter,
                    verse_no: verse,
                    ref: `BG ${chapter}.${verse}`,
                    sanskrit: apiData.text
                })
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
                    fullNarrative: `${existingText.translation}\n\n${existingText.commentary}\n\n${existingText.daily_life_application}\n\n${existingText.practical_examples.join('\n')}`
                };
            } else {
                if (!enhanced.en) {
                    console.log('Generating dual-language narratives via Gemini...');
                    const genData = await generateEnhancedContent(chapter, verse, sanskritText);
                    enhanced.en = genData.en;
                    enhanced.hi = genData.hi;
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
                const voiceId = VOICES[lang][gender];
                const languageCode = lang === 'en' ? 'en-IN' : 'hi-IN';

                const { data: existingAudio } = await supabase
                    .from('audio_cache')
                    .select('storage_path')
                    .match({
                        content_type: 'verse',
                        content_id: verseUuid,
                        section: 'full_narrative',
                        language: lang,
                        voice_id: voiceId,
                        engine: 'google-tts'
                    })
                    .single();

                if (existingAudio && !FORCE_REGENERATE) {
                    console.log(`Audio for ${lang} (${gender}) already exists.`);
                    continue;
                }

                console.log(`Generating TTS for ${lang} (${gender}) using ${voiceId}...`);
                const audioBuffer = await generateTTS(enhanced[lang].fullNarrative, languageCode, voiceId);
                const storagePath = `verses/bg-${chapter}-${verse}/${lang}_${gender}.mp3`;
                const uploadedPath = await uploadToSupabase(audioBuffer, storagePath);

                await supabase.from('audio_cache').upsert({
                    content_type: 'verse',
                    content_id: verseUuid,
                    section: 'full_narrative',
                    language: lang,
                    voice_id: voiceId,
                    engine: 'google-tts',
                    storage_path: uploadedPath
                }, { onConflict: 'content_type,content_id,section,language,voice_id,engine' });
                console.log(`Audio for ${lang} (${gender}) saved.`);
            }
        }

        console.log(`\nSUCCESS: BG ${chapter}.${verse} fully processed!`);
    } catch (err: any) {
        if (axios.isAxiosError(err)) {
            console.error('FATAL ERROR:', err.config?.url, err.response?.status, err.response?.data);
        } else {
            console.error('FATAL ERROR:', err.message);
        }
    }
};

const processBatch = async (chapter: number, startVerse: number, endVerse: number) => {
    console.log(`\n🚀 STARTING BATCH: Chapter ${chapter}, Verses ${startVerse}-${endVerse}`);
    for (let v = startVerse; v <= endVerse; v++) {
        await processVerse(chapter, v);
        if (v < endVerse) {
            console.log(`Waiting 3 seconds before next verse...`);
            await delay(3000);
        }
    }
    console.log(`\n✅ BATCH COMPLETE!`);
};

// Execute Batch
// Example: Process Chapter 2, Verses 47 to 50
processBatch(2, 47, 50);
