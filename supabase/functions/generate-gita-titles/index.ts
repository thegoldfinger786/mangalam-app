import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";

// ─── generate-gita-titles ──────────────────────────────────────────────────────
// One-purpose operator function: give every Bhagavad Gita verse a short
// human-readable title in English and Hindi.
//
// Scoped and non-destructive by design:
//   • Bhagavad Gita only (GITA_BOOK_ID hard-coded, same id used by import-content).
//   • Writes ONLY `title` (+ `updated_at`) via `.update()` on rows that already
//     exist — never translation / commentary / examples / audio, never inserts,
//     never another book.
//   • Writes the same language-specific title to the matching (verse_id, language)
//     row in BOTH `verse_content` (the app table, where Gita title was NULL) and
//     `content_master` (the canonical record, where Gita title was a mechanical
//     "Chapter N - Verse M" placeholder). Verified against production: Gita has a
//     clean 1:1 (verse_id, language) match — 1402 rows each, no orphans. Nothing
//     downstream reads the Gita content_master.title except one console.log.
//   • `mode: "missing"` (default) skips verses whose `verse_content` title is
//     already set, so repeated invocations resume where the last one stopped.
//
// Follows the import-content pattern: service-role client, `x-admin-secret`
// authorization, Gemini 2.5 Flash. Nothing in src/ invokes it.
// ──────────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const GITA_BOOK_ID = "80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9";

const DEVANAGARI = /[ऀ-ॿ]/;
const LATIN = /[A-Za-z]/;

const PROMPT = `You are a careful Vedic scholar writing for the Mangalam app — an inclusive spiritual-wellness product, not a religious or academic one.

Write a short, human-readable TITLE for one verse of the Bhagavad Gita, in English and in Hindi.

## Verse
- Chapter {{chapter}}, Verse {{verse}}
- Sanskrit: {{sanskrit}}
- English meaning: {{en_translation}}
- English commentary: {{en_commentary}}
- Hindi meaning: {{hi_translation}}

## What the title must be
- 4 to 9 words.
- Specific to THIS verse's idea — never a generic phrase, never just the chapter/verse number.
- Calm and reflective. Curiosity-friendly but NOT clickbait. No exclamation marks, no "You won't believe", no hype.
- Helps a reader understand why the verse matters.
- Grammatically correct and natural to read aloud.
- Supported by the verse and commentary above — invent nothing.
- The English and Hindi titles express the SAME underlying idea, each written naturally in its own language — NOT a word-for-word translation of the other.

## Hindi rules
- Pure, simple, modern Devanagari Hindi. No Urdu/Persian-derived words. No English words or Latin letters. No transliteration.

Return ONLY a JSON object: {"en": "<english title>", "hi": "<hindi title>"}`;

function trim(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim().slice(0, n);
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Returns a validated {en, hi} title pair, or throws. */
async function generateTitles(
  chapter: number,
  verse: number,
  sanskrit: string,
  en: { translation?: string; commentary?: string },
  hi: { translation?: string },
): Promise<{ en: string; hi: string }> {
  const prompt = PROMPT
    .replace("{{chapter}}", String(chapter))
    .replace("{{verse}}", String(verse))
    .replace("{{sanskrit}}", trim(sanskrit, 400))
    .replace("{{en_translation}}", trim(en.translation, 1200))
    .replace("{{en_commentary}}", trim(en.commentary, 800))
    .replace("{{hi_translation}}", trim(hi.translation, 1200));

  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
          GEMINI_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json", temperature: 0.7 },
          }),
        },
      );
      if (!resp.ok) throw new Error(`Gemini HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

      const data = await resp.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(raw);

      const enTitle = trim(parsed.en, 200);
      const hiTitle = trim(parsed.hi, 200);

      const problems: string[] = [];
      if (!enTitle) problems.push("empty en");
      if (!hiTitle) problems.push("empty hi");
      if (enTitle && DEVANAGARI.test(enTitle)) problems.push("devanagari in en");
      if (hiTitle && !DEVANAGARI.test(hiTitle)) problems.push("hi not devanagari");
      if (hiTitle && LATIN.test(hiTitle)) problems.push("latin in hi");
      if (enTitle && (wordCount(enTitle) < 3 || wordCount(enTitle) > 14)) problems.push("en length");
      if (hiTitle && hiTitle.length > 90) problems.push("hi too long");

      if (problems.length === 0) return { en: enTitle, hi: hiTitle };
      lastErr = problems.join(", ");
    } catch (err: any) {
      lastErr = err?.message ?? String(err);
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new Error(`title generation failed (${chapter}.${verse}): ${lastErr}`);
}

serve(async (req) => {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const mode: "missing" | "all" = body.mode === "all" ? "all" : "missing";
    const limit: number = Math.min(Math.max(Number(body.limit) || 40, 1), 120);
    const dryRun = body.dryRun === true;
    const chapterFrom = body.chapterFrom != null ? Number(body.chapterFrom) : null;
    const chapterTo = body.chapterTo != null ? Number(body.chapterTo) : null;

    let q = supabase
      .from("verses")
      .select("verse_id, chapter_no, verse_no, sanskrit, verse_content(language, title, translation, commentary)")
      .eq("book_id", GITA_BOOK_ID)
      .order("chapter_no", { ascending: true })
      .order("verse_no", { ascending: true });
    if (chapterFrom != null) q = q.gte("chapter_no", chapterFrom);
    if (chapterTo != null) q = q.lte("chapter_no", chapterTo);

    const { data: verses, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    let updated = 0;
    let skipped = 0;
    let attempts = 0;
    const failures: any[] = [];

    for (const v of verses || []) {
      if (attempts >= limit) break;

      const rows: any[] = v.verse_content || [];
      const en = rows.find((r) => r.language === "en") || {};
      const hi = rows.find((r) => r.language === "hi") || {};

      const enHas = !!(en.title && String(en.title).trim());
      const hiHas = !!(hi.title && String(hi.title).trim());
      if (mode === "missing" && enHas && hiHas) {
        skipped++;
        continue;
      }

      attempts++;
      try {
        const titles = await generateTitles(
          v.chapter_no,
          v.verse_no,
          v.sanskrit || "",
          { translation: en.translation, commentary: en.commentary },
          { translation: hi.translation },
        );

        if (!dryRun) {
          const now = new Date().toISOString();
          // The same generated title goes to the language-specific row in both
          // the app table (verse_content) and the canonical record
          // (content_master). Gita has a verified 1:1 (verse_id, language) match
          // between the two — see the function README.
          for (const [lang, title] of [["en", titles.en], ["hi", titles.hi]] as const) {
            for (const table of ["verse_content", "content_master"] as const) {
              const w = await supabase
                .from(table)
                .update({ title, updated_at: now })
                .eq("verse_id", v.verse_id)
                .eq("language", lang);
              if (w.error) throw w.error;
            }
          }
          updated++;
        }

        results.push({ ch: v.chapter_no, v: v.verse_no, en: titles.en, hi: titles.hi });
      } catch (err: any) {
        failures.push({ ch: v.chapter_no, v: v.verse_no, error: err?.message ?? String(err) });
      }

      await new Promise((r) => setTimeout(r, 250));
    }

    return new Response(
      JSON.stringify({
        mode,
        dryRun,
        totalGitaVerses: verses?.length ?? 0,
        attempted: attempts,
        succeeded: results.length,
        updated,
        skipped,
        failures,
        samples: dryRun ? results : results.slice(0, 8),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-gita-titles error:", err?.message ?? String(err));
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), { status: 500 });
  }
});
