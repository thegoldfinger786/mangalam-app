import { createClient } from '@supabase/supabase-js';
import * as csv from 'csv-parse/sync';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CSV_PATH = '/Users/sandeep/Downloads/mangalam_mahabharat_8cols_output.csv';

const run = async () => {
    console.log('🚀 Starting Bulk Mahabharat CSV Import...\n');

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV not found at: ${CSV_PATH}`);
        process.exit(1);
    }

    // ── 1. Find Mahabharat book ──
    const { data: book } = await supabase
        .from('books')
        .select('book_id')
        .eq('slug', 'mahabharat')
        .single();

    if (!book) {
        console.error('❌ Mahabharat book not found in database.');
        process.exit(1);
    }
    const bookId = book.book_id;
    console.log(`📖 Using Mahabharat book: ${bookId}`);

    // ── 2. Parse CSV ──
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = csv.parse(content, { columns: true, skip_empty_lines: true });
    console.log(`📄 Parsed ${records.length} records from CSV.`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of records) {
        const episodeNo = parseInt(row.episode_number);
        const lang = row.language;
        const title = row.title;

        console.log(`\n--- Processing Ep ${episodeNo} [${lang}]: ${title} ---`);

        try {
            // ── 3. Upsert verse ──
            const { data: verse, error: verseErr } = await supabase
                .from('verses')
                .upsert({
                    book_id: bookId,
                    chapter_no: 1,
                    verse_no: episodeNo,
                    ref: `Story ${episodeNo}`,
                    sanskrit: row.opening_line || null
                }, { onConflict: 'book_id,chapter_no,verse_no' })
                .select('verse_id')
                .single();

            if (verseErr || !verse) {
                console.error(`   ❌ Failed to upsert verse ${episodeNo}:`, verseErr?.message);
                errorCount++;
                continue;
            }
            const verseId = verse.verse_id;

            // ── 4. Upsert verse_content ──
            const { error: vcErr } = await supabase
                .from('verse_content')
                .upsert({
                    verse_id: verseId,
                    language: lang,
                    title: title || null,
                    translation: row.translation || null,
                    commentary: row.commentary || null,
                    daily_life_application: row.daily_life_application || null,
                    practical_examples: row.practical_example ? [row.practical_example] : null
                }, { onConflict: 'verse_id,language' });

            if (vcErr) {
                console.error(`   ❌ Failed to save verse_content:`, vcErr.message);
                errorCount++;
            } else {
                console.log(`   ✅ Succeeded!`);
                successCount++;
            }
        } catch (err: any) {
            console.error(`   ❌ Unexpected error:`, err.message);
            errorCount++;
        }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log(`✅ Bulk Import Final Summary:`);
    console.log(`   Succeeded:      ${successCount}`);
    console.log(`   Errors:         ${errorCount}`);
    console.log('═══════════════════════════════════════════\n');
};

run().catch(console.error);
