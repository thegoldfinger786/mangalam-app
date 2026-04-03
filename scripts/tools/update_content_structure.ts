import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RAMAYAN_BOOK_ID = '5e9592af-6654-4680-ad14-027e2f279b9e';
const MAHABHARAT_BOOK_ID = '181ce2df-ca9f-4d98-af57-e98f31354717';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const generateDailyLifeApplication = async (commentary: string, lang: string) => {
    const prompt = `
    Based on the following spiritual commentary, generate 2-3 concise and practical examples of how this lesson can be applied in daily life today.
    The response must be in ${lang === 'hi' ? 'Hindi (Devanagari script)' : 'English'}.
    Keep it relevant to modern life (work, family, self-improvement).
    
    Commentary: "${commentary}"
    
    Return ONLY the generated examples as a single string. No prefixes or explanations.
    `;

    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.data.candidates[0].content.parts[0].text.trim();
    } catch (err: any) {
        console.error('Gemini error:', err.message);
        return "";
    }
};

const updateMahabharat = async () => {
    console.log('--- Updating Mahabharat Content ---');
    const { data: verses, error } = await supabase
        .from('verses')
        .select(`
            verse_id,
            verse_content (id, language, daily_life_application, practical_examples)
        `)
        .eq('book_id', MAHABHARAT_BOOK_ID);

    if (error) throw error;
    console.log(`Found ${verses.length} Mahabharat verses.`);

    for (const v of verses) {
        for (const content of (v.verse_content as any[])) {
            console.log(`\nProcessing MB ${v.verse_id} (${content.language}) [id: ${content.id}]...`);
            
            const currentDaily = content.daily_life_application;
            const currentEx = content.practical_examples || [];
            
            const newDaily = Array.isArray(currentEx) ? currentEx.join('\n\n') : currentEx;
            const greeting = content.language === 'hi' ? 'जय श्री कृष्ण' : 'Jai Shri Krishna';
            const newEx = [greeting];

            console.log(`  Updating... newDaily: ${newDaily.substring(0, 50)}... newEx: ${JSON.stringify(newEx)}`);

            const { data: updData, error: updErr } = await supabase
                .from('verse_content')
                .update({
                    daily_life_application: newDaily,
                    practical_examples: newEx,
                    updated_at: new Date().toISOString()
                })
                .eq('id', content.id)
                .select();

            if (updErr) {
                console.error(`  ❌ Failed update for content ${content.id}:`, updErr.message);
            } else {
                console.log(`  ✅ Successfully updated ${content.id}. Result:`, JSON.stringify(updData));
            }
        }
    }
};

const updateRamayan = async () => {
    console.log('--- Updating Ramayan Content ---');
    const { data: verses, error } = await supabase
        .from('verses')
        .select(`
            verse_id,
            verse_content (id, language, commentary)
        `)
        .eq('book_id', RAMAYAN_BOOK_ID);

    if (error) throw error;
    console.log(`Found ${verses.length} Ramayan verses.`);

    for (const v of verses) {
        for (const content of (v.verse_content as any[])) {
            console.log(`\nProcessing RAM ${v.verse_id} (${content.language}) [id: ${content.id}]...`);
            
            console.log(`  Generating Daily Life Application for: ${content.commentary.substring(0, 50)}...`);
            const newDaily = await generateDailyLifeApplication(content.commentary, content.language);
            const greeting = content.language === 'hi' ? 'जय श्री राम' : 'Jai Shri Ram';
            const newEx = [greeting];

            console.log(`  Updating... newDaily: ${newDaily.substring(0, 50).replace(/\n/g, ' ')}...`);

            const { data: updData, error: updErr } = await supabase
                .from('verse_content')
                .update({
                    daily_life_application: newDaily,
                    practical_examples: newEx,
                    updated_at: new Date().toISOString()
                })
                .eq('id', content.id)
                .select();

            if (updErr) {
                console.error(`  ❌ Failed update for content ${content.id}:`, updErr.message);
            } else {
                console.log(`  ✅ Successfully updated ${content.id}.`);
            }
            
            await delay(1000); // Rate limiting for Gemini
        }
    }
};

(async () => {
    try {
        await updateMahabharat();
        await updateRamayan();
        console.log('--- ALL UPDATES COMPLETE ---');
    } catch (err: any) {
        console.error('Migration failed:', err.message);
    }
})();
