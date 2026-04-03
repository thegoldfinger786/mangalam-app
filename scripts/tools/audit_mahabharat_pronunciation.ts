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
    console.log('🔍 Auditing pronunciation in Mahabharat content...\n');

    // 1. Fetch Mahabharat book ID
    const { data: book } = await supabase.from('books').select('book_id').eq('slug', 'mahabharat').single();
    if (!book) return console.error('Mahabharat book not found');

    // 2. Fetch some samples from Mahabharat (verse_content for en)
    const { data: contents, error } = await supabase
        .from('verse_content')
        .select(`
            title, 
            translation, 
            commentary,
            verses!inner(book_id)
        `)
        .eq('language', 'en')
        .eq('verses.book_id', book.book_id)
        .limit(20);

    if (error) {
        console.error('❌ Error fetching content:', error.message);
        return;
    }

    const allText = contents.map(c => 
        [c.title, c.translation, c.commentary].join(' ')
    ).join('\n\n');

    // 2. Use Gemini to identify Sanskrit names/terms
    console.log('🤖 Asking Gemini to identify potential pronunciation issues...');
    const prompt = `
    The following is English content from a Mahabharat app. 
    A Google Cloud TTS (English Male 'en-IN-Neural2-B') is reading this. 
    It often mispronounces Sanskrit names (e.g., 'Kuru' as 'Kuroo', 'Yagn' as 'Yagna').
    
    Identify all Sanskrit names (characters, places, objects) and terms (like Dharma, Akshauhini) in this text that are likely to be mispronounced.
    For each, suggest a phonetic spelling (alias/phonetic spelling) to improve pronunciation.
    Crucially, add a trailing 'a' or double vowels if it helps with softness/correctness for this specific TTS voice.
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
