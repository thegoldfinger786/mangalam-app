import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RAMAYAN_BOOK_ID = '5e9592af-6654-4680-ad14-027e2f279b9e';

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
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.data.candidates[0].content.parts[0].text.trim();
    } catch (err: any) {
        console.error('Gemini error:', err?.response?.data || err.message);
        return "";
    }
};

const run = async () => {
    console.log('--- Fetching Ramayan Content ---');
    const { data: verses, error } = await supabase
        .from('verses')
        .select(`
            verse_id,
            verse_content (id, language, commentary)
        `)
        .eq('book_id', RAMAYAN_BOOK_ID);

    if (error) throw error;
    console.log(`Found ${verses.length} Ramayan verses.`);

    const results: any[] = [];

    for (const v of verses) {
        for (const content of (v.verse_content as any[])) {
            console.log(`\nProcessing RAM ${v.verse_id} (${content.language}) [id: ${content.id}]...`);
            
            const newDaily = await generateDailyLifeApplication(content.commentary, content.language);
            if (!newDaily) {
                console.error(`  ❌ Failed to generate for ${content.id}`);
                continue;
            }

            results.push({
                id: content.id,
                language: content.language,
                daily_life_application: newDaily
            });

            console.log(`  ✅ Generated: ${newDaily.substring(0, 50).replace(/\n/g, ' ')}...`);
            await delay(1000);
        }
    }

    fs.writeFileSync('ramayan_updates.json', JSON.stringify(results, null, 2));
    console.log('\n--- SUCCESS: ramayan_updates.json created ---');
};

run().catch(err => console.error(err));
