import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GEMINI_API_KEY) {
    console.error('❌ Missing credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const run = async () => {
    console.log('🔍 Auditing pronunciation in Ramayan content...\n');

    // 1. Fetch some samples from Ramayan (verse_content for en)
    const { data: contents, error } = await supabase
        .from('verse_content')
        .select('title, translation, commentary, daily_life_application')
        .eq('language', 'en')
        .limit(20);

    if (error) {
        console.error('❌ Error fetching content:', error.message);
        return;
    }

    const allText = contents.map(c => 
        [c.title, c.translation, c.commentary, c.daily_life_application].join(' ')
    ).join('\n\n');

    // 2. Use Gemini to identify Sanskrit names/terms that might be mispronounced by a naive TTS
    console.log('🤖 Asking Gemini to identify potential pronunciation issues...');
    const prompt = `
    The following is English content from a Ramayan app. 
    A Google Cloud TTS (English Male 'en-IN-Neural2-B') is reading this. 
    It often mispronounces Sanskrit names (e.g., 'Sumitra' as 'Sumit', 'Vishwamitr' as 'Vishwamit').
    
    Identify all Sanskrit names, places, and terms in this text that are likely to be mispronounced.
    For each, suggest a phonetic spelling (alias) to improve pronunciation.
    Format your response as a JSON object: { "term": "phonetic_alias" }.
    
    Text:
    ${allText}
    `;

    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
        });

        const result = JSON.parse(response.data.candidates[0].content.parts[0].text);
        console.log('\n✅ Potential additions to PRONUNCIATION_ATLAS:');
        console.log(JSON.stringify(result, null, 2));
    } catch (err: any) {
        console.error('❌ Gemini Error:', err.message);
    }
};

run();
