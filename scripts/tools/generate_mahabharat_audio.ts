import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const run = async () => {
    console.log('🚀 Starting Mahabharat Audio Generation (TTS)...\n');

    // 1. Get Mahabharat book ID
    const { data: book } = await supabase.from('books').select('book_id').eq('slug', 'mahabharat').single();
    if (!book) return console.error('Mahabharat book not found');

    // 2. Fetch all Mahabharat verse IDs
    const { data: verses, error } = await supabase
        .from('verses')
        .select('verse_id, chapter_no, verse_no')
        .eq('book_id', book.book_id)
        .order('chapter_no', { ascending: true })
        .order('verse_no', { ascending: true });

    if (error || !verses) {
        console.error('❌ Error fetching verses:', error?.message);
        return;
    }

    console.log(`Found ${verses.length} verses to process.\n`);

    for (const v of verses) {
        console.log(`--- Processing MB Ch ${v.chapter_no} Sec ${v.verse_no} ---`);
        for (const lang of ['en', 'hi'] as const) {
            for (const gender of ['male', 'female'] as const) {
                console.log(`   🔊 Generating TTS for ${lang}/${gender}...`);
                try {
                    const { data, error: invokeError } = await supabase.functions.invoke('generate-tts', {
                        body: {
                            verse_id: v.verse_id,
                            language: lang,
                            gender: gender,
                            force: true // Ensure we generate fresh audio after content generation
                        }
                    });

                    if (invokeError) throw invokeError;
                    console.log(`   ✅ Success: ${data.path}`);
                } catch (err: any) {
                    console.error(`   ❌ Failed:`, err.message || err);
                }
            }
        }
        await delay(200); // Small pause between verses to avoid hitting edge function rate limits
    }

    console.log('\n🎉 Mahabharat Audio Generation Complete!');
};

run().catch(console.error);
