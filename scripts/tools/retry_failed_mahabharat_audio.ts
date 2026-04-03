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
    console.log('🚀 Starting Mahabharat Audio Retry verification...\n');

    const { data: book } = await supabase.from('books').select('book_id').eq('slug', 'mahabharat').single();
    if (!book) return console.error('Mahabharat book not found');

    const { data: verses, error } = await supabase
        .from('verses')
        .select('verse_id, chapter_no, verse_no, verse_content(language)')
        .eq('book_id', book.book_id)
        .order('chapter_no', { ascending: true })
        .order('verse_no', { ascending: true });

    if (error || !verses) return console.error('❌ Error fetching verses:', error?.message);

    console.log(`Checking ${verses.length} verses for missing audio files...`);

    let missingCount = 0;

    for (const v of verses) {
        // we expect 4 audio records per verse (en_male, en_female, hi_male, hi_female)
        const { data: audioRecords } = await supabase
            .from('audio_cache')
            .select('language, voice_id')
            .eq('content_type', 'verse')
            .eq('content_id', v.verse_id);

        const foundEnMale = audioRecords?.some(r => r.language === 'en' && r.voice_id === 'en-IN-Wavenet-B');
        const foundEnFemale = audioRecords?.some(r => r.language === 'en' && r.voice_id === 'en-IN-Wavenet-A');
        const foundHiMale = audioRecords?.some(r => r.language === 'hi' && r.voice_id === 'hi-IN-Wavenet-C');
        const foundHiFemale = audioRecords?.some(r => r.language === 'hi' && r.voice_id === 'hi-IN-Wavenet-A');

        const targets = [];
        if (!foundEnMale) targets.push({ lang: 'en', gender: 'male' });
        if (!foundEnFemale) targets.push({ lang: 'en', gender: 'female' });
        if (!foundHiMale) targets.push({ lang: 'hi', gender: 'male' });
        if (!foundHiFemale) targets.push({ lang: 'hi', gender: 'female' });

        for (const t of targets) {
            missingCount++;
            console.log(`⚠️ Missing MB Ch ${v.chapter_no} Sec ${v.verse_no} for ${t.lang}/${t.gender}. Retrying...`);
            
            let success = false;
            let attempts = 0;
            while (!success && attempts < 3) {
                attempts++;
                try {
                    const { data, error: invokeError } = await supabase.functions.invoke('generate-tts', {
                        body: {
                            verse_id: v.verse_id,
                            language: t.lang,
                            gender: t.gender,
                            force: true 
                        }
                    });

                    if (invokeError) throw invokeError;
                    console.log(`   ✅ Success on attempt ${attempts}: ${data?.path}`);
                    success = true;
                } catch (err: any) {
                    console.error(`   ❌ Failed attempt ${attempts} for ${t.lang}/${t.gender}:`, err.message || err);
                    await delay(3000 * attempts); // Exponential backoff for rate limits
                }
            }
        }
    }

    if (missingCount === 0) {
        console.log('✅ All 84 verses have complete audio sets! No retries were necessary.');
    } else {
        console.log(`\n🎉 Processed ${missingCount} missing audio files.`);
    }
};

run().catch(console.error);
