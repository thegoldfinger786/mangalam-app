import * as csv from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = '/Users/sandeep/Downloads/mangalam_mahabharat_8cols_output.csv';
const BOOK_ID = '181ce2df-ca9f-4d98-af57-e98f31354717';
const PROJECT_ID = 'yhuvjcmemsqjkttizxem';

const escapeSql = (str: string | null | undefined) => {
    if (str === null || str === undefined) return 'NULL';
    return "'" + str.replace(/'/g, "''") + "'";
};

const run = async () => {
    console.log('🚀 Starting Bulk Mahabharat Import via SQL Generator...\n');

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV not found at: ${CSV_PATH}`);
        process.exit(1);
    }

    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = csv.parse(content, { columns: true, skip_empty_lines: true });
    
    // Group records by episode_number to handle verses first
    const episodeGroups = new Map<number, any[]>();
    records.forEach((r: any) => {
        const ep = parseInt(r.episode_number);
        if (!episodeGroups.has(ep)) episodeGroups.set(ep, []);
        episodeGroups.get(ep)!.push(r);
    });

    const episodes = Array.from(episodeGroups.keys()).sort((a, b) => a - b);
    const BATCH_SIZE = 2; // Smaller batches for safety with large text
    
    console.log(`📦 Processing ${episodes.length} stories in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
        const batchEpisodes = episodes.slice(i, i + BATCH_SIZE);
        console.log(`\n🔹 Processing Batch ${Math.floor(i / BATCH_SIZE) + 1} (Episodes ${batchEpisodes[0]} - ${batchEpisodes[batchEpisodes.length - 1]})...`);

        let sql = `BEGIN;\n\n`;

        // 1. Upsert Verses for this batch
        sql += `INSERT INTO public.verses (book_id, chapter_no, verse_no, ref, sanskrit)\nVALUES\n`;
        const verseValues: string[] = [];
        batchEpisodes.forEach(ep => {
            const firstRow = episodeGroups.get(ep)![0];
            verseValues.push(`(${escapeSql(BOOK_ID)}, 1, ${ep}, 'Story ${ep}', ${escapeSql(firstRow.opening_line)})`);
        });
        sql += verseValues.join(',\n') + `\n`;
        sql += `ON CONFLICT (book_id, chapter_no, verse_no) \nDO UPDATE SET sanskrit = EXCLUDED.sanskrit, updated_at = now();\n\n`;

        // 2. Upsert Verse Content for this batch
        sql += `WITH verse_mapping AS (\n  SELECT verse_id, verse_no FROM public.verses WHERE book_id = ${escapeSql(BOOK_ID)} AND chapter_no = 1 AND verse_no IN (${batchEpisodes.join(',')})\n)\n`;
        sql += `INSERT INTO public.verse_content (verse_id, language, title, translation, commentary, daily_life_application, practical_examples, updated_at, created_at)\nSELECT \n  m.verse_id, \n  t.language, \n  t.title, \n  t.translation, \n  t.commentary, \n  t.daily_life_application, \n  t.practical_examples,\n  now(),\n  now()\nFROM (\n  VALUES\n`;

        const contentValues: string[] = [];
        batchEpisodes.forEach(ep => {
            const rows = episodeGroups.get(ep)!;
            rows.forEach(r => {
                const practicalExamplesJson = JSON.stringify(r.practical_example ? [r.practical_example] : []);
                contentValues.push(`(${ep}, ${escapeSql(r.language)}, ${escapeSql(r.title)}, ${escapeSql(r.translation)}, ${escapeSql(r.commentary)}, ${escapeSql(r.daily_life_application)}, ${escapeSql(practicalExamplesJson)}::jsonb)`);
            });
        });

        sql += contentValues.join(',\n') + `\n) AS t(episode_no, language, title, translation, commentary, daily_life_application, practical_examples)\n`;
        sql += `JOIN verse_mapping m ON m.verse_no = t.episode_no\n`;
        sql += `ON CONFLICT (verse_id, language) \nDO UPDATE SET \n  title = EXCLUDED.title, \n  translation = EXCLUDED.translation, \n  commentary = EXCLUDED.commentary, \n  daily_life_application = EXCLUDED.daily_life_application, \n  practical_examples = EXCLUDED.practical_examples,\n  updated_at = now();\n\n`;

        sql += `COMMIT;`;

        // Save batch SQL for inspection or manual run if tool fails
        const batchFile = path.join('/tmp', `batch_mahabharat_${i}.sql`);
        fs.writeFileSync(batchFile, sql);
        console.log(`   ✅ SQL generated for Batch ${Math.floor(i / BATCH_SIZE) + 1} at ${batchFile}`);
    }

    console.log('\n✅ All batches generated! Please run them using the Supabase MCP tool.');
};

run().catch(console.error);
