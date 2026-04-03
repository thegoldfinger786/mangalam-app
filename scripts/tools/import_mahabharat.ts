import { createClient } from '@supabase/supabase-js';
import * as csv from 'csv-parse/sync';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CSV Paths ──────────────────────────────────────────────────────────────────
const STORY_BRIEFS_CSV = path.join(__dirname, 'data', 'mahabharat', 'story_briefs.csv');
const TRANSLATIONS_CSV = path.join(__dirname, 'data', 'mahabharat', 'translations.csv');

const GENERATE_AUDIO = false; // Set to true to also generate TTS audio after import

// ── Main Import ────────────────────────────────────────────────────────────────
const run = async () => {
    console.log('🚀 Starting Mahabharat data import...\n');

    // ── 1. Validate CSV files ──
    if (!fs.existsSync(STORY_BRIEFS_CSV)) {
        console.error(`❌ story_briefs.csv not found at: ${STORY_BRIEFS_CSV}`);
        process.exit(1);
    }
    if (!fs.existsSync(TRANSLATIONS_CSV)) {
        console.error(`❌ translations.csv not found at: ${TRANSLATIONS_CSV}`);
        process.exit(1);
    }

    // ── 2. Create / find Mahabharat book ──
    console.log('📖 Setting up Mahabharat book entry...');
    let bookId: string;

    const { data: existingBook } = await supabase
        .from('books')
        .select('book_id')
        .eq('slug', 'mahabharat')
        .single();

    if (existingBook) {
        bookId = existingBook.book_id;
        console.log(`   ✅ Found existing Mahabharat book: ${bookId}`);
    } else {
        const { data: newBook, error: bookErr } = await supabase
            .from('books')
            .insert({
                slug: 'mahabharat',
                title_en: 'Mahabharat',
                title_hi: 'महाभारत',
                content_type: 'verse',
                is_active: true
            })
            .select('book_id')
            .single();

        if (bookErr || !newBook) {
            console.error('❌ Failed to create Mahabharat book:', bookErr?.message);
            process.exit(1);
        }
        bookId = newBook.book_id;
        console.log(`   ✅ Created Mahabharat book: ${bookId}`);
    }

    // ── 3. Parse CSV files ──
    console.log('\n📄 Parsing CSV files...');
    const briefsRaw = fs.readFileSync(STORY_BRIEFS_CSV, 'utf-8');
    const translationsRaw = fs.readFileSync(TRANSLATIONS_CSV, 'utf-8');

    const storyBriefs: any[] = csv.parse(briefsRaw, { columns: true, skip_empty_lines: true });
    const translations: any[] = csv.parse(translationsRaw, { columns: true, skip_empty_lines: true });

    console.log(`   Found ${storyBriefs.length} story briefs and ${translations.length} translations`);

    // ── 4. Build translation lookup: chapter_no:verse_no:lang → content ──
    const transMap: { [key: string]: any } = {};
    for (const row of translations) {
        const key = `${row.chapter_no}:${row.verse_no}:${row.language}`;
        transMap[key] = row;
    }

    // ── 5. Import story briefs → verses + verse_content ──
    let successCount = 0;
    let errorCount = 0;

    for (const brief of storyBriefs) {
        const chNo = parseInt(brief.chapter_no);
        const vNo = parseInt(brief.verse_no);
        console.log(`\n--- Processing Ch ${chNo} Verse ${vNo}: ${brief.ref} ---`);

        // 5a. Upsert verse row
        let verseId: string;
        const { data: existingVerse } = await supabase
            .from('verses')
            .select('verse_id')
            .eq('book_id', bookId)
            .eq('chapter_no', chNo)
            .eq('verse_no', vNo)
            .single();

        if (existingVerse) {
            verseId = existingVerse.verse_id;
            console.log(`   ✅ Verse already exists: ${verseId}`);
        } else {
            const { data: newVerse, error: verseErr } = await supabase
                .from('verses')
                .insert({
                    book_id: bookId,
                    chapter_no: chNo,
                    verse_no: vNo,
                    ref: `Ch ${chNo} - ${vNo}`,
                    sanskrit: null
                })
                .select('verse_id')
                .single();

            if (verseErr || !newVerse) {
                console.error(`   ❌ Failed to create verse:`, verseErr?.message);
                errorCount++;
                continue;
            }
            verseId = newVerse.verse_id;
            console.log(`   ✅ Created verse: ${verseId}`);
        }

        // 5b. Insert verse_content
        const langs = ['en', 'hi'] as const;
        for (const lang of langs) {
            const t = transMap[`${chNo}:${vNo}:${lang}`];
            if (!t) {
                console.warn(`   ⚠️  No ${lang} translation for Ch ${chNo} Verse ${vNo}`);
                continue;
            }

            // Handle practical_examples if it's a JSON string
            let practicalExamples: string[] = [];
            try {
                if (t.practical_examples) {
                    const parsed = JSON.parse(t.practical_examples);
                    if (parsed.examples && Array.isArray(parsed.examples)) {
                        practicalExamples = parsed.examples.map((ex: any) => `${ex.title}: ${ex.example}`);
                    }
                    if (parsed.closing) {
                        practicalExamples.push(parsed.closing);
                    }
                }
            } catch (e) {
                if (t.practical_examples) {
                    practicalExamples = [t.practical_examples];
                }
            }

            const { error: vcErr } = await supabase
                .from('verse_content')
                .upsert({
                    verse_id: verseId,
                    language: lang,
                    title: brief.ref || null,
                    translation: t.translation || null,
                    commentary: t.commentary || null,
                    daily_life_application: t.daily_life_application || null,
                    practical_examples: practicalExamples.length > 0 ? practicalExamples : null
                }, { onConflict: 'verse_id,language' });

            if (vcErr) {
                console.error(`   ❌ Failed to save ${lang} verse_content:`, vcErr.message);
                errorCount++;
            } else {
                console.log(`   ✅ Saved ${lang} verse_content`);
            }
        }

        successCount++;
    }

    // ── 6. Summary ──
    console.log('\n═══════════════════════════════════════════');
    console.log(`✅ Import complete!`);
    console.log(`   Total entries:  ${storyBriefs.length}`);
    console.log(`   Succeeded:      ${successCount}`);
    console.log(`   Errors:         ${errorCount}`);
    console.log('═══════════════════════════════════════════\n');
};

run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
