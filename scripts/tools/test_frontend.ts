import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const fetchVerseAudio = async (bookId: string, verseId: string, language: string) => {
    const { data, error } = await supabase
        .from('verse_audio')
        .select('storage_path, storage_bucket, asset_type, is_canonical, status')
        .match({
            book_id: bookId,
            verse_id: verseId,
            language,
            is_primary_playback: true,
            status: 'ready'
        })
        .maybeSingle();

    if (error) {
        console.error('Error fetching primary verse audio:', error);
    }
    return { data, error };
};

const run = async () => {
    // A known Gita verse
    const bookId = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9';
    const verseId = '00589753-4a30-4528-bbb9-bc24af46e084'; // bg-13-6 from earlier output
    
    console.log(`Testing fetchVerseAudio for ${verseId} in English...`);
    const enResult = await fetchVerseAudio(bookId, verseId, 'en');
    console.log("EN Result:", JSON.stringify(enResult, null, 2));

    console.log(`Testing fetchVerseAudio for ${verseId} in Hindi...`);
    const hiResult = await fetchVerseAudio(bookId, verseId, 'hi');
    console.log("HI Result:", JSON.stringify(hiResult, null, 2));
};

run().catch(console.error);
