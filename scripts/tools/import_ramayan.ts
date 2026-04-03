import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as csv from 'csv-parse/sync';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { processToSsml } from './lib/tts_processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: true });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const GOOGLE_CLOUD_API_KEY = process.env.TTS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CSV Paths ──────────────────────────────────────────────────────────────────
const EPISODES_CSV = path.join(process.env.HOME || '', 'Downloads', 'episodes.csv');
const EPISODE_CONTENT_CSV = path.join(process.env.HOME || '', 'Downloads', 'episode_content.csv');

const GENERATE_AUDIO = false; // Set to true to also generate TTS audio after import

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


// ── Main Import ────────────────────────────────────────────────────────────────
const run = async () => {
    console.log('🚀 Starting Ramayan data import...\n');

    // ── 1. Validate CSV files ──
    if (!fs.existsSync(EPISODES_CSV)) {
        console.error(`❌ episodes.csv not found at: ${EPISODES_CSV}`);
        process.exit(1);
    }
    if (!fs.existsSync(EPISODE_CONTENT_CSV)) {
        console.error(`❌ episode_content.csv not found at: ${EPISODE_CONTENT_CSV}`);
        process.exit(1);
    }

    // ── 2. Create / find Ramayan book ──
    console.log('📖 Setting up Ramayan book entry...');
    let bookId: string;

    const { data: existingBook } = await supabase
        .from('books')
        .select('book_id')
        .eq('slug', 'ramayan')
        .single();

    if (existingBook) {
        bookId = existingBook.book_id;
        console.log(`   ✅ Found existing Ramayan book: ${bookId}`);
    } else {
        const { data: newBook, error: bookErr } = await supabase
            .from('books')
            .insert({
                slug: 'ramayan',
                title_en: 'Ramayan',
                title_hi: 'रामायण',
                content_type: 'verse',
                is_active: true
            })
            .select('book_id')
            .single();

        if (bookErr || !newBook) {
            console.error('❌ Failed to create Ramayan book:', bookErr?.message);
            process.exit(1);
        }
        bookId = newBook.book_id;
        console.log(`   ✅ Created Ramayan book: ${bookId}`);
    }

    // ── 3. Parse CSV files ──
    console.log('\n📄 Parsing CSV files...');
    const episodesRaw = fs.readFileSync(EPISODES_CSV, 'utf-8');
    const contentRaw = fs.readFileSync(EPISODE_CONTENT_CSV, 'utf-8');

    const episodes: Array<{
        episode_id: string;
        book_slug: string;
        episode_no: string;
        title_en: string;
        title_hi: string;
        duration_min: string;
        is_published: string;
    }> = csv.parse(episodesRaw, { columns: true, skip_empty_lines: true });

    const episodeContents: Array<{
        id: string;
        episode_id: string;
        kind: string; // story | moral | practical_example
        lang: string; // en | hi
        content: string;
    }> = csv.parse(contentRaw, { columns: true, skip_empty_lines: true });

    // Filter to only ramayan episodes
    const ramayanEpisodes = episodes.filter(e => e.book_slug === 'ramayan');
    console.log(`   Found ${ramayanEpisodes.length} episodes and ${episodeContents.length} content rows`);

    // ── 4. Build content lookup: episode_id → { en: { story, moral, practical_example }, hi: { ... } } ──
    type ContentMap = {
        [episodeId: string]: {
            [lang: string]: {
                story?: string;
                moral?: string;
                practical_example?: string;
            }
        }
    };

    const contentMap: ContentMap = {};
    for (const row of episodeContents) {
        if (!contentMap[row.episode_id]) contentMap[row.episode_id] = {};
        if (!contentMap[row.episode_id][row.lang]) contentMap[row.episode_id][row.lang] = {};
        contentMap[row.episode_id][row.lang][row.kind as 'story' | 'moral' | 'practical_example'] = row.content;
    }

    // ── 5. Episode title lookup ──
    const episodeTitleMap: { [epId: string]: { title_en: string; title_hi: string } } = {};
    for (const ep of ramayanEpisodes) {
        episodeTitleMap[ep.episode_id] = { title_en: ep.title_en, title_hi: ep.title_hi };
    }

    // ── 6. Import episodes → verses + verse_content ──
    let successCount = 0;
    let errorCount = 0;

    for (const ep of ramayanEpisodes) {
        const epNo = parseInt(ep.episode_no);
        const ref = `BK ${epNo}`;
        console.log(`\n--- Processing episode ${epNo}: ${ep.title_en} ---`);

        // 6a. Upsert verse row
        let verseId: string;
        const { data: existingVerse } = await supabase
            .from('verses')
            .select('verse_id')
            .eq('book_id', bookId)
            .eq('chapter_no', 1)
            .eq('verse_no', epNo)
            .single();

        if (existingVerse) {
            verseId = existingVerse.verse_id;
            console.log(`   ✅ Verse already exists: ${verseId}`);
        } else {
            const { data: newVerse, error: verseErr } = await supabase
                .from('verses')
                .insert({
                    book_id: bookId,
                    chapter_no: 1,
                    verse_no: epNo,
                    ref: ref,
                    sanskrit: null  // No Sanskrit text; titles stored in verse_content
                })
                .select('verse_id')
                .single();

            if (verseErr || !newVerse) {
                console.error(`   ❌ Failed to create verse for episode ${epNo}:`, verseErr?.message);
                errorCount++;
                continue;
            }
            verseId = newVerse.verse_id;
            console.log(`   ✅ Created verse: ${verseId}`);
        }

        // 6b. Insert verse_content for EN and HI
        const langs = ['en', 'hi'] as const;
        for (const lang of langs) {
            const c = contentMap[ep.episode_id]?.[lang];
            if (!c) {
                console.warn(`   ⚠️  No ${lang} content for episode ${epNo}`);
                continue;
            }

            const title = lang === 'en' ? ep.title_en : ep.title_hi;
            const practicalExampleText = c.practical_example || '';
            const suffix = lang === 'en' ? 'Jai Shri Ram !' : 'जय श्री राम !';
            const practicalExamples = [practicalExampleText, suffix].filter(Boolean);

            const { error: vcErr } = await supabase
                .from('verse_content')
                .upsert({
                    verse_id: verseId,
                    language: lang,
                    title: title,
                    translation: c.story || null,
                    commentary: c.moral || null,
                    daily_life_application: null,
                    practical_examples: practicalExamples
                }, { onConflict: 'verse_id,language' });

            if (vcErr) {
                console.error(`   ❌ Failed to save ${lang} verse_content:`, vcErr.message);
                errorCount++;
            } else {
                console.log(`   ✅ Saved ${lang} verse_content`);
            }
        }

        // 6c. Optional: Generate TTS audio
        if (GENERATE_AUDIO) {
            console.log(`   🔊 Generating TTS audio...`);
            for (const lang of langs) {
                const c = contentMap[ep.episode_id]?.[lang];
                if (!c) continue;

                const title = lang === 'en' ? ep.title_en : ep.title_hi;
                const suffix = lang === 'en' ? 'Jai Shri Ram !' : 'जय श्री राम !';
                const fullNarrative = [
                    title,
                    c.story,
                    c.moral,
                    c.practical_example,
                    suffix
                ].filter(Boolean).join('\n\n');

                for (const gender of ['male', 'female'] as const) {
                    try {
                        console.log(`   🔊 Syncing Edge Function for ${lang}/${gender}...`);
                        const { data, error } = await supabase.functions.invoke('generate-tts', {
                            body: {
                                verse_id: verseId,
                                language: lang,
                                gender: gender,
                                force: false
                            }
                        });

                        if (error) throw error;
                        const status = data.status === 'skipped' ? '✅ Up to date' : '✅ Generated';
                        console.log(`   ${status}: ${data.path}`);
                        await delay(500); // Rate limit
                    } catch (audioErr: any) {
                        console.error(`   ❌ Audio ${lang}/${gender} failed:`, audioErr.message);
                    }
                }
            }
        }

        successCount++;
    }

    // ── 7. Summary ──
    console.log('\n═══════════════════════════════════════════');
    console.log(`✅ Import complete!`);
    console.log(`   Total episodes: ${ramayanEpisodes.length}`);
    console.log(`   Succeeded:      ${successCount}`);
    console.log(`   Errors:         ${errorCount}`);
    if (!GENERATE_AUDIO) {
        console.log('\n   ℹ️  Audio generation skipped. Set GENERATE_AUDIO = true to generate TTS audio.');
    }
    console.log('═══════════════════════════════════════════\n');
};

run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
