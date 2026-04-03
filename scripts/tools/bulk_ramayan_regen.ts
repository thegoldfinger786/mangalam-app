import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const run = async () => {
    console.log(`🚀 Bulk regenerating all Ramayan audio for instant experience...`);
    
    const { data: book } = await supabase.from('books').select('book_id').eq('slug', 'ramayan').single();
    if (!book) return console.error('Ramayan book not found');

    const { data: verses } = await supabase
        .from('verses')
        .select('verse_id, verse_no')
        .eq('book_id', book.book_id)
        .order('verse_no');
    
    if (!verses) return console.error('No verses found');

    const LANGS = ['en', 'hi'];
    const GENDERS = ['male', 'female'];

    for (const v of verses) {
        process.stdout.write(`V${v.verse_no}: `);
        for (const lang of LANGS) {
            for (const gender of GENDERS) {
                try {
                    const { data, error } = await supabase.functions.invoke('generate-tts', {
                        body: { verse_id: v.verse_id, language: lang, gender: gender, force: true }
                    });
                    
                    if (error) process.stdout.write(`❌ `);
                    else {
                        // Map ALL voices to the new path
                        const newPath = data.path;
                        await supabase
                            .from('audio_cache')
                            .update({ storage_path: newPath })
                            .eq('content_id', v.verse_id)
                            .eq('language', lang)
                            .like('voice_id', `${lang}-IN-%`);

                        process.stdout.write(`✅ `);
                    }
                } catch (err) {
                    process.stdout.write(`⚠️ `);
                }
            }
        }
        process.stdout.write(`\n`);
    }
    console.log(`\n🎉 Ramayan audio pre-generation (48 verses) is complete!`);
};

run();
