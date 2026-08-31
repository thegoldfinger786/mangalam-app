# Mangalam (DailyShlokyaAG) — Codebase Discovery Report

**Purpose:** Pure archaeology. This document records what exists and why, before any redesign discussion. Every claim below is labeled:

- **[FACT]** — directly observed in code/config/schema
- **[ASSUMPTION]** — inferred, not directly stated anywhere in the repo
- **[QUESTION]** — needs the maintainer's input, cannot be resolved from the repo alone

No recommendations are included by design.

---

## 1. Project Overview

**[FACT]** This is "Mangalam" (Expo app slug/package name `DailyShlokyaAG`, bundle id `com.dailyshlokyaag.mangalam`), a React Native/Expo mobile app that narrates Hindu scripture content (Bhagavad Gita, Ramayan, Mahabharat) as audio "episodes" — Sanskrit verse, translation/story, commentary, and a "daily life application" — in English or Hindi, with background ambient music, lock-screen playback controls, progress/streak tracking, and Google/Apple social login. Content generation (LLM scripting + text-to-speech) is a separate offline/admin pipeline, not something end users trigger.

**[FACT]** Stack: Expo SDK 54 / React Native 0.81 / React 19, TypeScript, Zustand for state, React Navigation (native-stack + bottom-tabs), Supabase (Postgres + Auth + Storage + Edge Functions) as the sole backend, Sentry for crash reporting, `expo-audio` for playback with background/lock-screen support.

**[FACT]** Single developer/solo-maintainer signal: no `CLAUDE.md`, no CONTRIBUTING doc, `README.md` is still the unmodified `create-expo-app` boilerplate, git history (`git log`) shows a linear sequence of "fix X", "UI updates", "phase N ... complete" commits by one author.

**[ASSUMPTION]** The product is monetized via voluntary donation (a static Stripe Payment Link), not a real subscription/entitlement system — see §4 and §5.

---

## 2. Architecture Map

```
┌─────────────────────────────────────────────────────────────────┐
│  Expo / React Native app  (App.tsx)                              │
│  ├─ AuthProvider (src/auth)         — Supabase session lifecycle  │
│  ├─ ThemeProvider (src/theme)       — light/dark design tokens    │
│  └─ AppNavigator (src/navigation)                                 │
│       ├─ Unauthenticated stack → LoginScreen                      │
│       └─ Authenticated stack                                      │
│            ├─ Welcome (first-run onboarding)                      │
│            ├─ BottomTabs: Home / Library / Streaks / Settings     │
│            ├─ modal screens: BookDashboard, Play, CommunityWisdom │
│            └─ push screens: About, SupportMangalam, WebView       │
│  Global stores (zustand)                                          │
│       ├─ useAppStore   — session, prefs, onboarding (persisted)   │
│       └─ useAudioStore — player + background-audio engine         │
└───────────────┬───────────────────────────────────────────────────┘
                │ @supabase/supabase-js (anon key, RLS-enforced)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase project                                                 │
│  ├─ Postgres (public schema): books, verses, verse_content,       │
│  │    verse_audio, audio_cache, user_progress, user_daily_usage,  │
│  │    user_bookmarks, activity_log, profiles, staging_* tables    │
│  ├─ Views: canonical_audio, canonical_gita/ramayan/mahabharat_audio│
│  │    verse_content_full                                          │
│  ├─ RPCs: increment_daily_usage, upsert_user_progress_resume,      │
│  │    get_top_content, generate_all_tts/_filtered/_range,          │
│  │    audit_audio_sync                                            │
│  ├─ Storage buckets: audio-content, verse-audio, background-audio │
│  │    (referenced), expo-audio (referenced string, likely unused) │
│  ├─ Edge Functions (Deno): generate-tts, import-content            │
│  └─ Auth: Google OAuth, Apple Sign-In, (legacy) email/password    │
└─────────────────────────────────────────────────────────────────┘

Offline/admin side (not shipped in the app bundle):
  scripts/tools/*.ts(.py)  — content generation, TTS batch jobs,
                             audio verification, one-off data fixes
  scripts/reference/*.sql/.json — hand-run content correction batches
```

**[FACT]** The app talks to Supabase directly from the client using the anon key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`) for all reads/writes gated by Row Level Security; there is no separate application server. The only server-side compute is two Supabase Edge Functions plus ad-hoc Postgres functions (RPCs).

**[FACT]** Content authoring/generation is a distinct, disconnected system from the runtime app: Node/Deno/Python scripts in `scripts/tools/` call Google's Gemini API to write narrative content and Google Cloud Text-to-Speech to synthesize audio, writing results back into the same Postgres tables the app reads. There is no in-app content-creation UI.

---

## 3. Database Model Documentation

**[FACT]** `src/lib/database.types.ts` is a Supabase-generated types file reflecting the *live* schema — this is the authoritative source of truth for current structure, not the migration files (see the gap noted below).

### Tables (public schema)

| Table | Key columns | Purpose (observed from usage) |
|---|---|---|
| `books` | `book_id` (PK), `slug`, `content_type`, `title`/`title_en`/`title_hi`, `is_active` | One row per scripture "collection" (Gita, Ramayan, Mahabharat, …). `slug` is the only classification field actually populated/used — see §5 on the `code` field. |
| `verses` | `verse_id` (PK), `book_id` (FK→books), `chapter_no`, `verse_no`, `ref`, `sanskrit` | One row per addressable unit of content (a "verse" — used for Gita verses, and also for Ramayan/Mahabharat "episodes", which are modeled as chapter/verse pairs). |
| `verse_content` | `id` (PK), `verse_id` (FK→verses), `language` (`en`/`hi`), `title`, `translation`, `commentary`, `daily_life_application`, `practical_examples` (JSONB array) | Per-language generated narrative content for a verse. Unique on `(verse_id, language)`. |
| `verse_audio` | `id` (PK), `book_id`, `verse_id`, `language`, `voice_id`, `asset_type` (`compiled_full_episode`/`spoken_episode`), `section`, `storage_bucket`, `storage_path`, `status` (`processing`/`ready`/`failed`), `is_canonical`, `is_primary_playback`, `is_active` | Current, "canonical" audio-asset registry — one row per (book, verse, language, voice, asset_type) combination, uploaded by the `generate-tts` edge function. |
| `audio_cache` | `content_type`, `content_id`, `section`, `language`, `voice_id`, `engine`, `storage_path` | **[FACT]** Older/legacy audio lookup table, explicitly called out as legacy in `src/lib/queries.ts` (`checkAudioCache` comment: "Use fetchVerseAudio for canonical books"). Still written to by `generate-tts` "for legacy compatibility" and still read as a fallback path for non-canonical content in `PlayScreen`. |
| `user_progress` | composite key `(user_id, book_id)`, `last_content_id`, `content_type`, `last_position_seconds`, `playback_speed`, `updated_at` | One row per (user, book) — resume position. Updated via the `upsert_user_progress_resume` RPC with a last-write-wins guard (`WHERE ... updated_at IS NULL OR EXCLUDED.updated_at >= ...`). |
| `user_daily_usage` | `(user_id, usage_date)`, `sessions_used` | Daily session counter, incremented via `increment_daily_usage` RPC. |
| `user_bookmarks` | `user_id`, `content_id`, `content_type` | Saved/bookmarked verses. |
| `activity_log` | `user_id` (nullable), `content_id`, `content_type`, `action_type` (`listen`/`share`/`bookmark`) | Event log, feeds the `get_top_content` RPC used by the "Community Wisdom" screen. |
| `profiles` | `id` (PK, FK→auth.users, cascade delete), `display_name`, `updated_at` | Minimal user profile — display name only. Created by migration `20260405_create_profiles.sql`. |
| `staging_mahabharat`, `staging_ramayan` | chapter/episode no., story, commentary, review_note, attempt_used | **[FACT]** Draft/review tables for the content pipeline, not read by the app at runtime (only referenced by `scripts/`). |

### Views

**[FACT]** `canonical_audio`, `canonical_gita_audio`, `canonical_mahabharat_audio`, `canonical_ramayan_audio`, `verse_content_full` — denormalized read views joining verses/books/verse_audio for reporting/debugging (referenced in `verify_canonical_audio.ts`, not used directly in app source as far as searched).

### RPCs (Postgres functions)

- `increment_daily_usage(user_id, date)` — atomic upsert-increment, `SECURITY DEFINER`, search_path hardened.
- `upsert_user_progress_resume(...)` — conditional upsert for resume state, `SECURITY INVOKER`.
- `get_top_content(action_type, limit)` — aggregate ranking query for Community Wisdom.
- `generate_all_tts`/`generate_tts_filtered`/`generate_tts_range`/`audit_audio_sync` — **[FACT]** present in the generated types (so they exist in the live DB) but their SQL bodies are **not** in any tracked migration file — see gap below.

### Migration history vs. live schema — a documented gap

**[FACT]** The tracked migrations in `supabase/migrations/` are all incremental (`ALTER TABLE`, `CREATE POLICY`, RLS hardening, one `DROP TABLE`) — none of them contain the original `CREATE TABLE` statements for `books`, `verses`, `verse_content`, `verse_audio`, `user_progress`, `activity_log`, `user_bookmarks`, `profiles` predecessors, or the `canonical_*` views/generate_tts* functions. The earliest tracked migration (`20260302_audio_cache.sql`) already assumes `verse_content` exists.

**[ASSUMPTION]** The base schema, the `canonical_*` views, and the `generate_tts*`/`audit_audio_sync` functions were created directly against the Supabase dashboard/SQL editor (or via a squashed/un-tracked migration) before this migrations folder was started, and were never backfilled into version control. `supabase/migrations/20260315113335_drop_episodes_tables.sql` (dropping `episodes`/`episode_content`) implies an earlier content model existed and was replaced by the current unified `verses`/`verse_content` model — but that earlier schema and the transition migration are not in the repo either.

**[FACT]** `scripts/reference/ramayan_updates.sql` / `.json` are one-off hand-run `UPDATE verse_content SET ...` batches (128 statements), not schema migrations — they live outside `supabase/migrations/` and represent manual content correction, not structural change.

**[QUESTION]** Is there a source of truth for the original schema (e.g., a Supabase project snapshot, a `pg_dump`, or dashboard history) anywhere outside this repo?

---

## 4. Feature Inventory

**[FACT]** Enumerated by walking `src/navigation`, `src/screens`, `src/store`, `src/lib/queries.ts`.

| Feature | Where | Notes |
|---|---|---|
| Google OAuth login | `src/lib/supabaseClient.ts` (`signInWithGoogle`), `AuthProvider` | Uses `expo-auth-session` + `expo-web-browser`, manually extracts tokens from the redirect URL and calls `setSession`. |
| Apple Sign-In | `src/services/auth/appleSignIn.ts` | Uses `expo-apple-authentication` + Supabase `signInWithIdToken`; on first login, best-effort/idempotent write of `display_name` to `profiles`. |
| Email/password auth | `src/screens/AuthScreen.tsx` | **[FACT]** Implemented (`signInWithPassword`/`signUp` from `supabaseClient.ts`) but **not wired into navigation** — `src/navigation/index.tsx` only routes to `LoginScreen`. Appears to be superseded, unused code. |
| Onboarding | `OnboardingScreen.tsx` | Five-step first-run flow (welcome → language → intent → name → ready). Shown when the user has **no `profiles` row**; on finish it upserts the row and sets `hasCompletedOnboarding`. Language and (optional) intent + name are captured; intent persists locally as `useAppStore.onboardingIntent` for future personalisation. Replaced the single-screen `WelcomeScreen.tsx` (2026-08-31). |
| Book/Library browsing | `src/navigation/LibraryStack.tsx` → `screens/library/` (`LibraryBooksScreen` → `BookDetailScreen` → `ChapterVersesScreen`), `BookCard.tsx` | The Library tab is a real native-stack: book grid → book detail (hero + progress + search + chapter grid) → chapter verse list. iOS edge-swipe / Android hardware back unwind it; the tab bar stays visible. A book's verses are loaded once (`screens/library/useBookVerses.ts`, session cache keyed by book + language) and shared across the detail and chapter screens. Replaced the single `useState`-driven `LibraryScreen.tsx` (2026-08-31). `BookDashboardScreen.tsx` was removed earlier (PR #49). |
| Home "continue journey" | `HomeScreen.tsx` | Resolves last book/verse/position from `user_progress` + local `completedVerses`, shows a resume CTA; also lists "coming soon" books (Shiv Puran, Upanishads) that have no real content yet. |
| Audio playback | `PlayScreen.tsx`, `useAudioStore.ts` | Narration + looping background ambience mixed via two `expo-audio` players, cross-fades, lock-screen metadata/controls, seek/skip-15s, variable playback speed (0.75×–2×), auto-scrolling transcript synced to playback position via a custom character-weighted progress estimator. |
| Resume/progress sync | `useAudioStore.syncRemoteProgress`, `upsert_user_progress_resume` RPC | Periodic (15s) + event-based (pause/background/track-change/complete/unmount) sync, with local `AsyncStorage` position cache as a fallback. |
| Bookmarks | `toggleBookmark`/`fetchIsBookmarked` (`queries.ts`) | Per-verse bookmark toggle from PlayScreen. |
| Sharing | `PlayScreen.handleShare` | Native share sheet with a message + platform-specific store link; logs an `activity_log` "share" event. |
| Streaks / usage stats | `StreaksScreen.tsx`, `user_daily_usage` | 7-day tracker, "sessions today", and an estimated "total time" (`streakCount * 10m` — not measured, just multiplied). |
| Community Wisdom | `CommunityWisdomScreen.tsx`, `get_top_content` RPC | Cross-user aggregate "most listened/shared/bookmarked" leaderboards, ranked with medal icons for top 3. |
| Voice preference | `SettingsScreen.tsx`, `VoiceOptionCard.tsx`, `useAppStore.voicePreference` | 4 options: English/Hindi × Male/Female, mapped to specific Google TTS voice IDs. |
| Background music toggle/volume, narration volume | `SettingsScreen.tsx`, `useAudioStore` | Persisted to `AsyncStorage` under `audio_settings`. |
| Dark mode | `SettingsScreen.tsx`, `useAppStore.themeMode`, `ThemeProvider` | Persisted via zustand `persist` middleware. |
| Support/donation | `SupportMangalamScreen.tsx` | Static Stripe Payment Link opened via `Linking.openURL` — no in-app purchase, no webhook, no entitlement change observed anywhere in the repo. |
| Free-tier session cap UI | `PlayScreen.tsx` ("Daily Limit Reached" / `isAllowed`) | **[FACT]** UI branch exists and references "3 sessions today", but `isAllowed` is initialized to `true` and never set to `false` anywhere in the current code — see §5. |
| Crash/error reporting | `src/lib/logger.ts`, `App.tsx` (`Sentry.init`/`Sentry.wrap`) | Errors always logged to Sentry in non-dev builds; user id attached to Sentry scope on auth state change. |
| Deep linking | `app.json` (`scheme: mangalamapp`, `associatedDomains`), `src/navigation/index.tsx` | Custom scheme for OAuth callback + universal links via `mangalamapp.com`. |
| OTA updates | `expo-updates`, `app.json.updates` | Configured against an EAS project (`7416da99-...`), channel-based builds in `eas.json` (`test`, `aab`, `preview`, `production`). |

---

## 5. Technical Debt Inventory

**[FACT]** unless noted otherwise.

1. **Hardcoded secret in source control** — `scripts/tools/preview_english_verse_robust.py:6` contains a plaintext Google Gemini API key, committed since the initial commit, not gitignored. (Flagged separately/urgently outside this doc.)
2. **Untracked/undocumented base schema** — see §3. The live DB schema (base tables, `canonical_*` views, `generate_tts*`/`audit_audio_sync` functions) has no corresponding `CREATE` migration in the repo; only post-hoc `ALTER`/hardening migrations exist.
3. **Dead/duplicated auth screen** — `src/screens/AuthScreen.tsx` implements a full email/password UI against Supabase but is not reachable from any navigator; `LoginScreen.tsx` is the live route.
4. **Non-functional free-tier gate** — `PlayScreen.tsx`'s `isAllowed` state (drives the "Daily Limit Reached" paywall screen) is hardcoded to `true` and never flipped to `false` by any code path; `incrementDailyUsage` errors are silently swallowed (`// Ignore usage error silently`). The UI for the limit still exists and points users at `SupportMangalam`, but nothing currently enforces the described "3 sessions/day" cap.
5. **`accountStatus` ('free'/'supporter') is a local-only placeholder** — it lives in `useAppStore` with a hardcoded default of `'free'`, is never read from or written to any Supabase table (`profiles` has no such column), and is never changed by the Stripe donation flow (which is a plain external payment link with no webhook back into the app).
6. **Legacy `audio_cache` table/path still live** — kept and written to in parallel with the newer `verse_audio` canonical registry "for legacy compatibility" (comment in `generate-tts/index.ts`); `PlayScreen` still falls back to `checkAudioCache` for non-canonical books.
7. **`code` field on books is effectively dead** — `src/lib/bookIdentity.ts`'s `BookCacheEntry.code` and the `getBookCode()`/`getBookByCode()` fallback logic (`book.code || book.slug`) reference a `code` column that does not exist in the current `books` schema (`database.types.ts` only has `slug`, not `code`); in practice `code` is always `undefined` and every lookup silently falls through to `slug`.
8. **Vestigial theme files** — `src/theme/spacing.ts` (and parts of `typography.ts`'s standalone exports, per the exploration pass) are not imported by `src/theme/index.tsx`, which defines its own inline `baseSpacing`/typography wiring instead.
9. **Unused Expo template scaffolding at repo root** — top-level `components/`, `hooks/`, `constants/` directories (e.g. `components/themed-text.tsx`, `hooks/use-color-scheme.ts`) are leftovers from `create-expo-app` and are not imported anywhere; the real app code lives entirely under `src/`.
10. **Rough/approximate metrics presented as real stats** — `StreaksScreen`'s "Total Time" stat is `streakCount * 10m`, not measured listening time; its "streak" is actually a count of usage-days in the last 30 (via `fetchStreakData`'s `limit(30)`), not a verified *consecutive*-day streak. A comment in `HomeScreen.tsx` (per the exploration pass) explicitly calls this a placeholder: `// Basic streak calculation for MVP...(Real logic would check for gaps...)`.
11. **Stray/leftover comments indicating incomplete edits** — e.g. `StreaksScreen.tsx` contains `// ... (loadStreakData remains same)`, an artifact of a prior partial edit left in the shipped file.
12. **Heavy inline diagnostic/dead code in `useAudioStore.ts`** — numerous empty `try {} catch (e) {}` blocks and stray blank statements (visible as odd blank lines/braces in the file) appear to be remnants of stripped `console.log` diagnostics (consistent with `scripts/cleanup_logging.js`, a repo-local script whose explicit job is to strip `console.*` calls file-by-file and replace with `logger`).
13. **`RAPID_API_KEY`** is read in `supabase/functions/import-content/index.ts` but never referenced again in that file's logic shown — **[ASSUMPTION]** likely a leftover from an earlier/experimental content-source integration that was not completed or was removed.
14. **Duplicate/parallel one-off scripts** — `scripts/tools/preview_english_verse.ts`, `.py`, `_robust.py`, and `test_verse_1_1_new_source.py` appear to be successive iterations of the same manual preview task, all still present in the tree (the `.ts` version is explicitly excluded from `tsconfig.json`'s `include`, suggesting it's known to not type-check cleanly / not part of the app build).
15. **Multiple in-repo TTS retry/backfill scripts** (`retry_failed_mahabharat_audio.ts`, `retry_ramayan_audio.ts`, `run_vc_batches.ts`) each re-implement their own env-loading and Supabase-client bootstrap rather than sharing a common script utility.

---

## 6. Missing Documentation Inventory

**[FACT]** Absence confirmed by searching the repo.

- No `CLAUDE.md` or equivalent project-instructions file.
- No architecture/README beyond the default Expo boilerplate (`README.md` is unedited).
- No documented data model / ER diagram anywhere in-repo.
- No changelog.
- No documented environment variable reference (which vars are required for app vs. edge functions vs. scripts) — has to be reconstructed by grepping `process.env`/`Deno.env.get` (done for this report, see below).
- No tests of any kind found (no `__tests__`, `*.test.ts`, or test runner config in `package.json`).
- No CI configuration found (no `.github/workflows`, no other CI config).
- No documentation of the content-generation pipeline (prompt design, Gemini usage, TTS voice selection) outside inline prompt strings in `supabase/functions/import-content/index.ts` and `scripts/tools/mahabharat_prompt.md`.
- No documented list of Supabase Storage buckets/policies (bucket existence for `audio-content`/`verse-audio`/`background-audio` is only implied by string literals in code, not declared anywhere).
- No onboarding/setup doc for a new engineer (how to point at a Supabase project, seed data, run the content pipeline).

---

## 7. Environment Variables (as used)

**[FACT]** Reconstructed via `grep -rn "process.env\.\|Deno.env.get"`.

| Variable | Used by | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | App (`supabaseClient.ts`, `backgroundAudioUtils.ts`), most `scripts/tools/*` | Public — bundled into the client. `backgroundAudioUtils.ts` has a hardcoded fallback URL (`https://yhuvjcmemsqjkttizxem.supabase.co`) if the env var is missing. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | App, `scripts/tools/*` | Public anon key, relies entirely on RLS policies for protection. |
| `SUPABASE_SERVICE_ROLE_KEY` | `generate-tts`/`import-content` edge functions, `run_vc_batches.ts` | Privileged — server/script-only, bypasses RLS. Not present in `.env`/`.env.local` (redacted names checked) at the repo root, so presumably supplied via Supabase's function secrets and the operator's local shell/`~/.env` for scripts. |
| `TTS_API_KEY` | `generate-tts` edge function, several `scripts/tools/*` | Google Cloud Text-to-Speech API key. Present in `.env.local`. |
| `GEMINI_API_KEY` | `import-content` edge function, several `scripts/tools/*` | Google Gemini API key for content generation. Present in `.env.local`. Also hardcoded in plaintext in `scripts/tools/preview_english_verse_robust.py` (flagged in §5/urgent). |
| `RAPID_API_KEY` | `import-content` edge function | Present in `.env.local`; usage inside the function beyond declaration wasn't confirmed to be load-bearing (see §5 item 13). |
| `EXPO_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | `App.tsx` | Either name accepted; Sentry only enabled when not `__DEV__` and a DSN is present. |

**[FACT]** `.env` holds the two `EXPO_PUBLIC_*` Supabase values (bundled/public by Expo convention); `.env.local` holds the three server/script-only secrets (`RAPID_API_KEY`, `GEMINI_API_KEY`, `TTS_API_KEY`) — a deliberate public/private split by filename, though `.env.local` is still a plaintext file on disk rather than a secrets manager.

---

## 8. Authentication Model

**[FACT]**

- Backed entirely by Supabase Auth. Session persisted client-side via `AsyncStorage` (`supabaseClient.ts`), `autoRefreshToken: true`, `detectSessionInUrl: false` (URL-based OAuth completion is handled manually instead).
- **Google**: `expo-auth-session` + `expo-web-browser` build the OAuth URL via `supabase.auth.signInWithOAuth`, open it in an in-app browser session, then manually parse `access_token`/`refresh_token` off the redirect URL fragment and call `setSession` — a workaround for `detectSessionInUrl` being disabled.
- **Apple**: `expo-apple-authentication` native flow → `supabase.auth.signInWithIdToken({ provider: 'apple' })`. First-time name/email from Apple's credential is persisted to `profiles` "out of band" (fire-and-forget, idempotent — only writes if `display_name` is still empty).
- **Email/password**: implemented in `supabaseClient.ts` (`signInWithPassword`/`signUp`) and `AuthScreen.tsx`, but not routed — effectively dead (§5).
- Session bootstrap uses a "single source of truth" pattern: `getSession()` handles the initial session; `onAuthStateChange` explicitly ignores the redundant `INITIAL_SESSION` event to avoid a double-apply race — documented in code comments as an intentional fix for a prior bug class.
- A `refresh_token_not_found` error is specifically detected and triggers a forced local sign-out, to avoid a "stuck logged-in-but-broken" state.
- Sign-out order is deliberate and documented in comments: stop audio & force a final progress sync *before* clearing local auth state, then attempt (best-effort) server-side sign-out — local state is always cleared regardless of network success.
- **`profiles` row presence** is the "has onboarded" signal (updated 2026-08-31 — was `profiles.display_name` presence). Rows are created lazily by the app on onboarding completion (there is no signup trigger), so a row means the user finished onboarding even if they skipped the optional name. Drives whether `OnboardingScreen` or the main tabs render after login.

---

## 9. Storage Strategy

**[FACT]**

- Three Supabase Storage buckets appear in code as string literals: `audio-content` (Gita "compiled_full_episode" audio), `verse-audio` (Ramayan/Mahabharat "spoken_episode" audio), and `background-audio` (looping ambience beds, e.g. `mangalam_bed_calm_8min.mp3`, referenced directly via a public storage URL pattern built in `backgroundAudioUtils.ts`). A fourth literal, `expo-audio`, appears once (in the bucket-name grep) but its context wasn't load-bearing in the reviewed code — **[ASSUMPTION]** likely a coincidental string match rather than a real 4th bucket.
- Bucket contents are addressed by a structured path convention: `${bookSlug}/chapter-${chapterNo}/verse-${verseNo}/${language}/${assetType}/${voiceId}.mp3` (built in `generate-tts/index.ts`).
- Playback URLs are resolved via `supabase.storage.from(bucket).getPublicUrl(path)` — **[FACT]** buckets are treated as public-read; a cache-busting `?t=timestamp` query param is appended for freshly generated audio.
- Background ambience audio is pre-downloaded to local `expo-file-system` cache (`FileSystem.downloadAsync`) before playback, specifically to work around an observed native player bug (documented in code comments) where streaming an un-downloaded remote file caused iOS to silently drop playback.
- Local persistence (not Supabase Storage) also plays a role: `AsyncStorage` stores playback-position fallback (`progress_<url>` keys), audio volume/background-toggle preferences (`audio_settings` key), and the whole `useAppStore` (session, prefs, onboarding, streak/progress) under the `mangalam-storage` key via zustand's `persist` middleware.

---

## 10. AI / Content Generation Pipeline

**[FACT]**

- Runs entirely outside the shipped app, via TypeScript/Python scripts in `scripts/tools/` invoked manually by the maintainer, plus one edge function (`import-content`) that can also be triggered as an HTTP call.
- **Text generation**: Google Gemini (`gemini-2.5-flash`, sometimes `gemini-1.5-flash` in older scripts) via direct `fetch`/`axios` calls to `generativelanguage.googleapis.com`, using large hand-written prompt templates (`GEMINI_PROMPT` for Gita, `MAHABHARAT_PROMPT` for Mahabharat, embedded in `import-content/index.ts` and mirrored in `scripts/tools/mahabharat_prompt.md`). Prompts specify strict word counts (500–700 word "translation"/story, 100–150 word commentary, exactly 2 practical examples for Gita / 1 for Mahabharat), tone rules ("short, spoken sentences", "no SSML"), and Hindi-purity rules (an explicit forbidden-word list banning Urdu-origin loanwords like "ज़रूरत", "मदद", "मुश्किल" and any English/Latin characters).
- **Validation loop**: `import-content/index.ts` retries generation up to 5 times if `validateHindiTransliteration()` finds forbidden words or Latin characters in the Hindi output, with exponential backoff between attempts.
- **Post-processing**: `cleanText()` strips known artifacts (verse-numbering patterns, "Welcome to today's lesson", "Jai Shri Krishna"/"जय श्री कृष्ण" sign-offs, stray `<break/>` tags) before persisting to `verse_content`.
- **Text-to-speech**: Google Cloud TTS (`texttospeech.googleapis.com`), driven by the `generate-tts` edge function. Voice IDs are fixed per language (`en-IN-Neural2-B/A`, `hi-IN-Neural2-B/A` for male/female).
- **SSML construction**: `processToSsml()` in `generate-tts/index.ts` builds an SSML document with a large hardcoded `PRONUNCIATION_ATLAS` dictionary (`<sub alias="...">` substitutions) correcting English TTS mispronunciation of ~60 Sanskrit/mythological proper nouns (e.g., "Dhritarashtra" → "Dhrutaraashtra", "Draupadi" → "Droupadee"), plus Hindi-specific spacing fixes and possessive-apostrophe workarounds.
- **Chunking**: `generateChunkedTTS()` splits SSML into ≤3500-char (English) / ≤1200-char (Hindi) chunks at sentence boundaries (`।`, `|`, `.`, paragraph breaks), synthesizes each separately, and concatenates the raw MP3 byte buffers.
- **Per-book assembly rules**: Gita audio includes a spoken intro ("Welcome to today's lesson...") that Ramayan/Mahabharat audio explicitly omits; asset type differs by book (`compiled_full_episode` for Gita vs `spoken_episode` for Ramayan/Mahabharat), which also determines the storage bucket.
- **Idempotency/caching**: before regenerating, `generate-tts` checks `verse_audio` for an existing `status='ready'` row newer than the source content's `updated_at`, skipping regeneration unless `force: true` is passed.
- **State machine**: `verse_audio.status` moves `processing → ready` or `→ failed`, with old canonical/primary-playback rows demoted (`is_canonical/is_primary_playback = false`) before the new one is promoted.
- **Content correction outside the pipeline**: `scripts/reference/ramayan_updates.sql`/`.json` show that content is also sometimes corrected via direct, hand-authored SQL `UPDATE` statements against specific row IDs rather than by re-running the generation pipeline.

**[QUESTION]** Is `import-content`'s edge function actually invoked in production/on a schedule, or is it only ever called manually/from local scripts during content authoring sessions?

**[QUESTION]** What is `RAPID_API_KEY` (declared in `import-content/index.ts`) actually meant to source — an external verse/translation dataset? It's declared but its usage wasn't evident in the code paths reviewed.

---

## 11. Naming Conventions Observed

- Screens/components: PascalCase files matching their default export (`HomeScreen.tsx` → `HomeScreen`).
- Styling: every screen defines `const createStyles = (...) => StyleSheet.create({...})` as a factory taking theme slices, memoized via `useMemo`; per-instance/dynamic values (resolved colors) are applied inline in JSX rather than baked into the stylesheet.
- Store hooks: `useAppStore` (global/persisted app state) vs. `useAudioStore` (ephemeral player/audio-engine state) — a clear separation between "preferences and session" and "live playback machinery".
- DB naming: `snake_case` columns throughout; `book_id`/`verse_id` used consistently as both PK and FK names (no generic `id` for the top two entities, but `id` is used as PK for most child tables — `verse_content.id`, `verse_audio.id`, etc.).
- Content language values are consistently the two-letter codes `en`/`hi` across all tables and code.
- `bookIdentity.ts` establishes and repeatedly documents (in its own comments) a deliberate distinction: **`book_id` = identity** (used for navigation/fetch/playback, never hardcoded) vs. **`code`/`slug` = classification** (feature-flag-style helpers like `isGita`/`isRamayan`/`isMahabharat`, fetched from the backend cache, not hardcoded literals) — this convention is referenced and enforced (via `assertBookIdentityConsistency`/`assertValidBookId`/`requireBookId`) across `PlayScreen`, `useAudioStore`, `CommunityWisdomScreen`, and others, suggesting a past bug class around book identity confusion that these guards were added to catch early.

---

## 12. Assumptions Inferred From the Codebase (consolidated)

1. The original/base DB schema was created outside of tracked migrations (dashboard or squashed history) — §3.
2. `code` on `books` is a planned-but-never-populated column; `slug` is the real classification key in practice — §5.7.
3. The free-session paywall (`isAllowed`/"3 sessions today") is either intentionally disabled during current development/testing, or was disabled by accident and not yet restored — §5.4. Cannot tell which from the code alone.
4. `accountStatus: 'supporter'` is aspirational/scaffolded for a future entitlement system tied to the Stripe donation, not yet wired up — §5.5.
5. `RAPID_API_KEY` was for an external content/translation data source that may be partially implemented or abandoned — §10.
6. The `expo-audio` string match in the bucket grep is coincidental, not a real 4th storage bucket — §9.
7. `scripts/tools/preview_english_verse.ts` being excluded from `tsconfig.json`'s `include` list means it's known to be broken/unmaintained relative to the rest of the scripts.

## 13. Questions That Need Clarification

1. Is there an existing schema snapshot/dump (Supabase dashboard export, old migration branch, etc.) that could backfill the missing base-schema migrations?
2. Is the `isAllowed` free-tier gate in `PlayScreen.tsx` intentionally disabled right now, or is it a regression?
3. Is `accountStatus` ('free'/'supporter') meant to eventually gate any feature, or is it currently inert/vestigial?
4. Should `AuthScreen.tsx` (email/password, unrouted) be considered dead code, or is email/password login planned to return?
5. What is `RAPID_API_KEY` used for, and is it still needed by `import-content`?
6. Is the `generate-tts`/`import-content` edge-function pair invoked automatically by anything (webhook, cron, dashboard button), or exclusively via the local `scripts/tools/*` CLIs during manual content sessions?
7. Are `staging_mahabharat`/`staging_ramayan` still an active part of the authoring workflow, or leftover from a completed one-time migration?
8. Is there an intended canonical process for correcting live content (re-run the Gemini pipeline vs. hand-written SQL `UPDATE`s like `scripts/reference/ramayan_updates.sql`), or has that been decided ad hoc per incident?
