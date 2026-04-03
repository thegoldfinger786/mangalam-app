import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PRONUNCIATION_ATLAS } from './lib/pronunciation_atlas.js';

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

const run = async () => {
    console.log('🔍 Identifying Ramayan verses requiring audio regeneration...\n');

    // 1. Get Ramayan book ID
    const { data: book } = await supabase.from('books').select('book_id').eq('slug', 'ramayan').single();
    if (!book) {
        console.error('❌ Ramayan book not found');
        return;
    }

    // 2. Fetch all English content for Ramayan
    const { data: verses, error } = await supabase
        .from('verses')
        .select(`
            verse_id,
            verse_no,
            verse_content!inner (
                title,
                translation,
                commentary,
                daily_life_application
            )
        `)
        .eq('book_id', book.book_id)
        .eq('verse_content.language', 'en');

    if (error) {
        console.error('❌ Error fetching verses:', error.message);
        return;
    }

    const atlasTerms = Object.keys(PRONUNCIATION_ATLAS);
    const toFix: Array<{ id: string, no: number, terms: string[] }> = [];

    for (const v of verses as any) {
        const content = v.verse_content[0];
        const fullText = [content.title, content.translation, content.commentary, content.daily_life_application].join(' ');
        
        const foundTerms = atlasTerms.filter(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'i');
            return regex.test(fullText);
        });

        if (foundTerms.length > 0) {
            toFix.push({
                id: v.verse_id,
                no: v.verse_no,
                terms: foundTerms
            });
        }
    }

    console.log(`✅ Found ${toFix.length} verses containing atlas terms:`);
    toFix.sort((a, b) => a.no - b.no).forEach(f => {
        console.log(`   - Episode ${f.no}: [${f.terms.join(', ')}] (ID: ${f.id})`);
    });

    // Output raw IDs for use in fix_ramayan_audio.ts
    console.log('\nCopy these IDs into fix_ramayan_audio.ts:');
    console.log(JSON.stringify(toFix.map(f => f.id), null, 2));
};

run();
