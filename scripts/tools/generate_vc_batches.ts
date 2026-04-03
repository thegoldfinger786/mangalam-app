#!/usr/bin/env tsx
/**
 * Generates batched DO blocks for verse_content inserts.
 * Each batch is ~200KB which should fit in Supabase MCP tool limits.
 */
import * as csv from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const BOOK_ID = '5e9592af-6654-4680-ad14-027e2f279b9e';
const HOME = process.env.HOME || '';
const EPISODES_CSV = path.join(HOME, 'Downloads', 'episodes.csv');
const CONTENT_CSV = path.join(HOME, 'Downloads', 'episode_content.csv');

const esc = (s: string | null | undefined): string => {
    if (s === null || s === undefined) return 'NULL';
    return `$q$${s}$q$`;
};

const episodes = csv.parse(fs.readFileSync(EPISODES_CSV, 'utf-8'), { columns: true, skip_empty_lines: true }) as Array<{
    episode_id: string; book_slug: string; episode_no: string;
    title_en: string; title_hi: string;
}>;

const contents = csv.parse(fs.readFileSync(CONTENT_CSV, 'utf-8'), { columns: true, skip_empty_lines: true }) as Array<{
    id: string; episode_id: string; kind: string; lang: string; content: string;
}>;

type ContentMap = { [epId: string]: { [lang: string]: { [kind: string]: string } } };
const cmap: ContentMap = {};
for (const row of contents) {
    cmap[row.episode_id] = cmap[row.episode_id] || {};
    cmap[row.episode_id][row.lang] = cmap[row.episode_id][row.lang] || {};
    cmap[row.episode_id][row.lang][row.kind] = row.content;
}

const ramayanEps = episodes.filter(e => e.book_slug === 'ramayan');
const BATCH_SIZE = 3;

for (let batchNum = 0; batchNum < Math.ceil(ramayanEps.length / BATCH_SIZE); batchNum++) {
    const batchEps = ramayanEps.slice(batchNum * BATCH_SIZE, (batchNum + 1) * BATCH_SIZE);
    const lines: string[] = [];

    lines.push(`DO $$`);
    lines.push(`DECLARE v_id UUID;`);
    lines.push(`BEGIN`);

    for (const ep of batchEps) {
        const n = parseInt(ep.episode_no);
        const c_en = cmap[ep.episode_id]?.['en'] || {};
        const c_hi = cmap[ep.episode_id]?.['hi'] || {};

        lines.push(`  -- Ep ${n}: ${ep.title_en.substring(0, 40)}`);
        lines.push(`  SELECT verse_id INTO v_id FROM public.verses WHERE book_id = ${esc(BOOK_ID)} AND chapter_no = 1 AND verse_no = ${n};`);

        for (const [lang, c, title] of [
            ['en', c_en, ep.title_en],
            ['hi', c_hi, ep.title_hi],
        ] as [string, typeof c_en, string][]) {
            const suffix = lang === 'en' ? 'Jai Shri Ram !' : 'जय श्री राम !';
            lines.push(`  INSERT INTO public.verse_content (verse_id, language, title, translation, commentary, daily_life_application, practical_examples)`);
            lines.push(`  VALUES (v_id, '${lang}', ${esc(title)}, ${esc(c['story'])}, ${esc(c['moral'])}, ${esc(c['practical_example'])}, jsonb_build_array(${esc(c['practical_example'] || '')}, $q$${suffix}$q$))`);
            lines.push(`  ON CONFLICT (verse_id, language) DO UPDATE SET title = EXCLUDED.title, translation = EXCLUDED.translation, commentary = EXCLUDED.commentary, daily_life_application = EXCLUDED.daily_life_application, practical_examples = EXCLUDED.practical_examples;`);
        }
        lines.push('');
    }

    lines.push(`END $$;`);

    const sql = lines.join('\n');
    const outPath = `/tmp/vc_batch_${batchNum + 1}.sql`;
    fs.writeFileSync(outPath, sql);
    const epRange = `${batchEps[0].episode_no}-${batchEps[batchEps.length - 1].episode_no}`;
    console.log(`Batch ${batchNum + 1} (eps ${epRange}): ${outPath} (${sql.length.toLocaleString()} bytes)`);
}

console.log('✅ Done generating batches.');
