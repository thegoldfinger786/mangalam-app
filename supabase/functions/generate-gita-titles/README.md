# generate-gita-titles

Populates `verse_content.title` for **Bhagavad Gita** verses that don't have one
yet, in **English and Hindi**, using Gemini 2.5 Flash.

## Why it exists

Gita verses had `verse_content.title = NULL` for all 701 verses in both
languages (Ramayan already has titles). The Library verse list, the Community
Wisdom rows and the mini-player therefore showed raw Sanskrit or "BG 1.2"
instead of a human headline (tracker CONTENT-01 → LIB-03, COMM-02, MINI-01).

## Scope guarantees

- **Gita only** — `GITA_BOOK_ID` is hard-coded (same id `import-content` uses).
- **Title only** — writes `title` + `updated_at` via `.update()` on rows that
  already exist. Never touches `translation` / `commentary` / `practical_examples`
  / audio, never inserts rows, never touches another book.
- **Both tables, same value** — the generated language-specific title is written
  to the matching `(verse_id, language)` row in **`verse_content`** (the app
  table) *and* **`content_master`** (the canonical record). Verified once against
  production: Gita has a clean 1:1 `(verse_id, language)` match between the two —
  1402 rows each, no orphans either way. `content_master.title` for Gita was a
  mechanical `"Chapter N - Verse M"` placeholder (Ramayan/Mahabharat rows there
  already hold real headlines); nothing downstream reads that Gita value except
  one `console.log`. Ramayan / Mahabharat rows in either table are never touched.
- **Resumable** — `mode: "missing"` (default) skips verses where both `en` and
  `hi` `verse_content` titles are already set, so you can call it repeatedly.
- Same authorization as the other operator functions: `x-admin-secret` header
  (`ADMIN_API_SECRET`). Nothing in `src/` calls it.

## Deploy

```bash
supabase functions deploy generate-gita-titles --project-ref yhuvjcmemsqjkttizxem
```

`GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are already set as
project secrets. No new secret is needed.

## Run

Request body (all optional):

| field         | default     | meaning |
|---------------|-------------|---------|
| `mode`        | `"missing"` | `"missing"` skips verses that already have both titles; `"all"` regenerates. |
| `limit`       | `40`        | max verses to process this call (1–120). Keeps each invocation under the wall-clock limit. |
| `dryRun`      | `false`     | generate + validate but do not write. |
| `chapterFrom` / `chapterTo` | — | restrict to a chapter range. |

### 1. Sample check first

```bash
curl -s -X POST \
  "https://yhuvjcmemsqjkttizxem.supabase.co/functions/v1/generate-gita-titles" \
  -H "x-admin-secret: $ADMIN_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true, "limit": 8}' | jq
```

Eyeball `samples` — English is English, Hindi is Devanagari, each title matches
its chapter/verse. Also try a middle and a late chapter:

```bash
-d '{"dryRun": true, "limit": 4, "chapterFrom": 9, "chapterTo": 9}'
-d '{"dryRun": true, "limit": 4, "chapterFrom": 18, "chapterTo": 18}'
```

### 2. Full run

701 verses × ~1.5s ≈ well over a single invocation, so loop:

```bash
for i in $(seq 1 25); do
  echo "--- batch $i ---"
  curl -s -X POST \
    "https://yhuvjcmemsqjkttizxem.supabase.co/functions/v1/generate-gita-titles" \
    -H "x-admin-secret: $ADMIN_API_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"mode": "missing", "limit": 40}' | jq '{attempted, succeeded, updated, skipped, failures: (.failures | length)}'
  sleep 2
done
```

Stop when a call reports `attempted: 0` (nothing left missing). Re-run any
`failures` by calling again — `mode: "missing"` picks them up.

### 3. Verify

```sql
-- coverage: should be 701 / 701
select language, count(*) filter (where title is not null and btrim(title) <> '') as with_title, count(*) total
from verse_content vc join verses v on v.verse_id = vc.verse_id
where v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
group by language;

-- no Latin letters leaked into Hindi titles
select v.chapter_no, v.verse_no, vc.title
from verse_content vc join verses v on v.verse_id = vc.verse_id
where v.book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9'
  and vc.language = 'hi' and vc.title ~ '[A-Za-z]';

-- other books untouched
select b.slug, count(*) from verse_content vc
join verses v on v.verse_id = vc.verse_id join books b on b.book_id = v.book_id
where vc.updated_at > now() - interval '1 day' group by b.slug;   -- expect only gita
```

## Revert

`verse_content` back to NULL, `content_master` back to the placeholder:

```sql
update verse_content set title = null
where language in ('en','hi')
  and verse_id in (select verse_id from verses
                   where book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9');

update content_master
set title = 'Chapter ' || chapter_no || ' - Verse ' || verse_no
where book_id = '80ead5fd-bc3d-4726-ba8d-7cf00b6b75a9';
```

A row-level backup of both tables' Gita `title` columns is taken before the
first run (see the operator's scratchpad) — restore from that if an exact
rollback is needed.
