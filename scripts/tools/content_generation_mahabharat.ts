import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
let MAHABHARAT_BOOK_ID = '';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const cleanText = (text: string, chapter: number, verse: number) => {
    if (!text) return "";
    let cleaned = text;
    const numberingRegex = new RegExp(`(\\b|\\s|\\()${chapter}\\.${verse}(\\b|\\s|\\))`, 'g');
    cleaned = cleaned.replace(numberingRegex, ` Chapter ${chapter} Section ${verse} `);
    cleaned = cleaned.replace(/Welcome to today's lesson\.?/gi, "");
    cleaned = cleaned.replace(/We are in Chapter \d+ Section \d+\.?/gi, "");
    cleaned = cleaned.replace(/Jai Shri Krishna/gi, "");
    cleaned = cleaned.replace(/जय श्री कृष्ण/g, "");
    return cleaned.trim().replace(/\s+/g, ' ');
};

const validateHindiTransliteration = (text: string) => {
    const forbiddenWords = ['डेटा', 'रिपोर्ट', 'टीम', 'ऑफिस', 'प्रोजेक्ट', 'क्लाइंट', 'बिजनेस', 'मैनेजमेंट', 'लीडर', 'प्रोफेशनल', 'सीनियर', 'अथॉरिटी', 'डेटाबेस'];
    return forbiddenWords.filter(word => text.includes(word));
};

const generateEnhancedContent = async (chapter: number, verse: number, storyBrief: string) => {
    const promptTemplate = fs.readFileSync(path.join(__dirname, 'mahabharat_prompt.md'), 'utf-8');
    const prompt = promptTemplate
        .replace('{{chapter}}', chapter.toString())
        .replace('{{verse}}', verse.toString())
        .replace('{{brief}}', storyBrief);

    let retryCount = 0;
    while (retryCount < 5) {
        try {
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            }, { timeout: 60000 });

            const text = response.data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(text);

            const getWordCount = (langData: any) => {
                 const combinedText = [
                    langData.translation,
                    langData.commentary,
                    langData.daily_life_application || langData.dailyLifeApplication || ""
                ].join(' ');
                return combinedText.split(/\s+/).filter(word => word.length > 0).length;
            };

            const enWordCount = getWordCount(parsed.en);
            const hiWordCount = getWordCount(parsed.hi);

            console.log(`Word Count Check - EN: ${enWordCount}, HI: ${hiWordCount}`);

            if (enWordCount < 500 || hiWordCount < 500) {
                console.warn(`Retry ${retryCount + 1}: Word count too low. Target: 600+ total.`);
                retryCount++;
                continue;
            }

            const combinedHindiText = [
                parsed.hi.translation,
                parsed.hi.commentary,
                parsed.hi.daily_life_application || parsed.hi.dailyLifeApplication || "",
                ...(parsed.hi.practical_examples || parsed.hi.practicalExamples || [])
            ].join(' ');

            const forbiddenFound = validateHindiTransliteration(combinedHindiText);
            if (forbiddenFound.length > 0) {
                console.warn(`Retry ${retryCount + 1}: Found forbidden transliterations: ${forbiddenFound.join(', ')}`);
                retryCount++;
                continue;
            }

            return parsed;
        } catch (err: any) {
            retryCount++;
            console.error(`Gemini Error (Attempt ${retryCount}):`, err.message);
            if (retryCount >= 5) throw err;
            await delay(5000 * retryCount);
        }
    }
};

const processVerse = async (verseRow: any) => {
    const { verse_id, chapter_no, verse_no } = verseRow;
    console.log(`\n--- Processing MB Ch ${chapter_no} Sec ${verse_no} ---`);

    try {
        const { data: existingEn } = await supabase
            .from('verse_content')
            .select('*')
            .eq('verse_id', verse_id)
            .eq('language', 'en')
            .single();

        if (!existingEn || !existingEn.translation) {
            console.warn(`Skipping: No source text found.`);
            return;
        }

        const sourceBrief = `Title: ${existingEn.title}\nStory: ${existingEn.translation}\nCommentary: ${existingEn.commentary}`;
        const enhanced = await generateEnhancedContent(chapter_no, verse_no, sourceBrief);

        for (const lang of ['en', 'hi'] as const) {
            const data = enhanced[lang];
            const title = cleanText(data.title, chapter_no, verse_no) || existingEn.title;
            const translation = cleanText(data.translation, chapter_no, verse_no);
            const commentary = cleanText(data.commentary, chapter_no, verse_no);
            const dailyLife = cleanText(data.daily_life_application || data.dailyLifeApplication, chapter_no, verse_no);
            const rawExamples = data.practical_examples || data.practicalExamples || [];
            const examples = rawExamples.map((ex: string) => cleanText(ex, chapter_no, verse_no));

            console.log(`Saving ${lang} content...`);
            await supabase.from('verse_content').upsert({
                verse_id: verse_id,
                language: lang,
                title: title,
                translation: translation,
                commentary: commentary,
                daily_life_application: dailyLife,
                practical_examples: examples,
                updated_at: new Date().toISOString()
            }, { onConflict: 'verse_id,language' });
        }
        console.log(`✅ Success for MB Ch ${chapter_no} Sec ${verse_no}`);
    } catch (err: any) {
        console.error(`❌ Failed MB Ch ${chapter_no} Sec ${verse_no}:`, err.message);
        throw err;
    }
};

const run = async () => {
    console.log('🚀 Starting Mahabharat Content Generation...');
    const { data: book } = await supabase.from('books').select('book_id').eq('slug', 'mahabharat').single();
    if (!book) return;

    const { data: verses, error } = await supabase
        .from('verses')
        .select('verse_id, chapter_no, verse_no')
        .eq('book_id', book.book_id)
        .order('chapter_no', { ascending: true })
        .order('verse_no', { ascending: true });

    if (error || !verses) return;

    for (const v of verses) {
        let success = false;
        let retries = 0;
        while (!success && retries < 3) {
            try {
                await processVerse(v);
                success = true;
            } catch (e) {
                retries++;
                await delay(2000);
            }
        }
        await delay(1000); 
    }
    console.log('\n🎉 DONE!');
};

run();
