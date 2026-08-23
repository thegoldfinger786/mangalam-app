# Mangalam — Security Remediation

Living source of truth for the security remediation begun 2026-08-22. Update this
document whenever a security change is made. Companion to
[`DISCOVERY.md`](DISCOVERY.md) (how the system is built) and
[`VISION_ALIGNMENT.md`](VISION_ALIGNMENT.md) (product intent); this file covers
security posture only.

**Evidence labelling used throughout:**

- **[REPO]** — verified from repository contents.
- **[LIVE]** — verified against production (API probe, CLI metadata, deployed source).
- **[ASSUMED]** — inference not yet verified. Never treat as fact.

**No secrets, key values, hashes, or tokens belong in this file.**

---

## 1. Overview

This remediation started from a code review of the Mangalam mobile app on
2026-08-22, which escalated when two things came to light:

1. **The repository was public** on GitHub (`thegoldfinger786/mangalam-app`,
   `isPrivate: false` [LIVE]) — and had been since 2026-04-03. Credentials
   committed to git history were therefore world-readable for roughly 4.7
   months, and the project URL, anon key, table names and RPC signatures were
   all public knowledge. This removed the only practical friction protecting
   the backend.
2. **Content-generation Edge Functions had no authorization at all.** They
   relied entirely on the Supabase gateway's `verify_jwt`, which the public anon
   key satisfies.

Major classes of issue found:

- **Authorization** — operator-only functions reachable by anyone with the
  published anon key; one function reachable with no credential whatsoever.
- **Credential exposure** — vendor API keys in public git history and in
  current public source.
- **Schema/deployment drift** — a large amount of production state (tables,
  functions, migrations, Edge Functions) exists nowhere in the repository.
- **Application correctness** — streak, account-switching, and playback bugs.
  Deliberately deferred; see §10.

**Current status (2026-08-23): all exploitable issues reachable with the
available access have been closed and validated against production.**

Closed this cycle: every deployed Edge Function now requires explicit operator
authorization (#3, #32, #33); the SQL-driven TTS RPCs are retired (#23, #41);
anonymous write access to the app audio catalogue is removed (#42); cross-user
reads of `activity_log` are fixed (#37); `increment_daily_usage` enforces
`auth.uid()` (#4); and the embedded service-role JWT is gone from all function
bodies (#38).

**The system is not "secure" in an unqualified sense, and one item is
genuinely urgent:** the leaked Gemini and RapidAPI credentials (#1, #2) have
still not been revoked at their providers, and the service-role key has not been
rotated. Those require console access this remediation does not have.

Everything else outstanding is either blocked on external access (#1, #2, #27),
requires an explicit architecture decision (#15, #34), has been deliberately
accepted with reasoning (#39, #40), or is an app-correctness defect tracked for
the post-security phase (#6–#14, #16–#22, #24–#31).

---

## 2. Current Architecture and Future Direction

Recorded 2026-08-23 from the founder. **This supersedes earlier classifications
in this document that treated production objects as obsolete because the mobile
app does not reference them.** Absence from `src/`, `supabase/migrations/`, or
`database.types.ts` is a documentation gap — never evidence that a production
object is unused.

Mangalam is three related but distinct subsystems.

### APP — Mangalam mobile app (not yet launched)

Scripture reading/listening, user progress, bookmarks, usage, streaks.

Tables: `books`, `verses`, `verse_content`, `verse_audio`, `audio_cache`,
`user_progress`, `user_bookmarks`, `user_daily_usage`, `activity_log`,
`profiles`.

Edge Functions: `generate-tts`, `import-content`, and the audio-generation
functions serving app content.

Storage: `audio-content` (verse narration the app streams; public read is
intentional — client/public **write** is not) and `background-audio` (see
SHARED below).

### CONTENT_PRODUCTION — `content_master` pipeline

**An active production system**, not orphaned data. Generates content and media
for YouTube long-form, YouTube Shorts, Spotify, and Instagram.

Tables: `content_master`, `audio_segments`, and associated tables/functions.
These exist in production but are **not** in the repository's migrations or
generated types (finding #34). That drift is an architectural and documentation
problem to resolve, not licence to delete anything.

Storage: `background-audio` (music beds used when generating long- and
short-form content), `spotify-uploads` (generated audio/video prepared for
Spotify), `ArtWorks` (reusable artwork across Mangalam channels).

### MEDIA_AUDIT — media metadata and video audit

Image metadata, generated-media metadata, video generation/audit information,
and tracking of generated videos. A distinct production subsystem.

Tables: `yt_insta_image_metadata`, `yt_insta_video_metadata`,
`yt_insta_output_audit` (§7).

Storage: `YTInstaContent` — visuals, audio and video assets for YouTube and
Instagram short-form content.

### SHARED

`background-audio` is **SHARED**, confirmed [REPO] 2026-08-23. The founder
records it as CONTENT_PRODUCTION (music beds for content generation), and it is
**also a live APP dependency**: `src/utils/backgroundAudioUtils.ts:30` builds
`.../object/public/background-audio/mangalam_bed_<mood>_8min.mp3`, which
`useAudioStore` downloads and plays as the ambient bed under verse narration.
Its public read must be preserved for the app.

### LEGACY

- `Spotify Podcast` — older location for files generated with a different TTS
  provider. Treat as legacy **unless evidence shows current use**.
- `Intro Static` — reusable intro audio ("Jai Shri Ram" / "Jai Shri Krishna").
  Believed unused. **Not to be deleted on that belief alone** — verify
  references and production usage first.

### UNKNOWN

Insufficient evidence; each such item must record what evidence would classify
it. Note that **absence of a repository reference is not evidence of non-use** —
production pipelines, manual workflows and historical assets exist outside
tracked code. The repository is one source of evidence, not the whole system.

### Future direction

The intended end state is `content_master` as the **single source of truth** for
Mangalam content, serving the app, YouTube, Spotify, Instagram, Shorts, and
future formats. `verses` / `verse_content` are legacy app-oriented content
structures to be migrated toward it. App-specific user/state tables (progress,
bookmarks, usage, profiles) stay separate — they are user state, not canonical
content.

**This consolidation has NOT happened and must not be started during security
remediation.** Do not delete `content_master`, `audio_segments`, `verses`, or
`verse_content`; do not migrate the app; do not consolidate schemas; do not
rename production objects for consistency. When it does happen it is a deliberate
architecture project requiring a canonical identity/key structure, content
mapping, language representation, audio mapping, user-state references,
cross-channel references, old→new ID mapping, a backfill strategy, and a safe
deprecation plan for the legacy tables.

**Operating principle for this remediation:** apply security fixes to every
subsystem, but preserve production functionality. Protect privileged functions
regardless of subsystem; never delete an unknown production object until its
subsystem and dependencies are mapped.

---

## 3. Security Findings

IDs #1–#22 are preserved from the original 2026-08-22 audit; #23 onward were
added during live verification. Findings withdrawn on second pass are retained
as FALSE POSITIVE rather than deleted, so the trail stays traceable.

Severity reflects exploitability *and* consequence, judged at the time of
writing.

| # | Finding | Evidence | Severity | Status |
|---|---|---|---|---|
| 1 | Vendor credentials committed to public git history | `3553f9d:.env`, ancestor of `origin/main` [REPO] | Critical | **OPEN** |
| 2 | Gemini key hardcoded in tracked source, present in public `HEAD` | `scripts/tools/preview_english_verse_robust.py:6` [REPO] | Critical | **IN PROGRESS** |
| 3 | Edge Functions performed no caller authorization | `generate-tts/index.ts`, `import-content/index.ts` [REPO+LIVE] | Critical | **RESOLVED** 2026-08-23 |
| 4 | `increment_daily_usage` trusts caller-supplied `p_user_id` | `20260302_usage_rpc.sql` [REPO] | Medium | **RESOLVED** 2026-08-23 — enforces `p_user_id = auth.uid()`, applied to production and validated |
| 5 | `audio_cache` created without RLS in its own migration | `20260302_audio_cache.sql` [REPO] | Low | **RESOLVED** 2026-03-05 (pre-existing, by `20260305_fix_rls_warnings.sql`) |
| 6 | Render-time throw in PlayScreen, no error boundary | `src/screens/PlayScreen.tsx:71` [REPO] | High | **DEFERRED** |
| 7 | Speed change / token refresh refetches content and re-increments usage | `PlayScreen.tsx:354,358,230` [REPO] | High | **DEFERRED** |
| 8 | Progress and history leak across account switches | `AuthProvider.tsx:76` vs `useAppStore.partialize` [REPO] | High | **DEFERRED** |
| 9 | Day boundary computed in UTC | `queries.ts:126,143`; `StreaksScreen.tsx:53` [REPO] | Medium | **DEFERRED** |
| 10 | Cache-busting `?t=` defeats audio caching | `PlayScreen.tsx:295` [REPO] | Medium | **DEFERRED** |
| 11 | Missing `verse_content` fails silently (`.single()`, error discarded) | `PlayScreen.tsx:188-193` [REPO] | Medium | **DEFERRED** |
| 12 | Early return skips progress persistence | `PlayScreen.tsx:290` [REPO] | Low | **DEFERRED** |
| 13 | OAuth tokens extracted by string splitting | `supabaseClient.ts:146-147` [REPO] | Low (latent) | **DEFERRED** |
| 14 | ~380 MB binaries tracked in git (`.git` is 451 MB) | `build-*.aab`, `scripts/reference/audio_outputs/` [REPO] | Low | **DEFERRED** |
| 15 | Most of the production schema has no migration | 9 local migrations; 32 remote-only [REPO+LIVE] | High | **OPEN** |
| 16 | `books.code` referenced in code, absent from schema | `bookIdentity.ts:65` vs `database.types.ts:84-93` [REPO] | Low | **DEFERRED** |
| 17 | Empty `catch`/`if` blocks from log-stripping script | `useAudioStore.ts` (6 catch, 4 if) [REPO] | Low | **DEFERRED** |
| 18 | `react-hooks/exhaustive-deps` not enforced | `eslint.config.js` [REPO] | Low | **DEFERRED** |
| 19 | 57 hardcoded colours outside the theme | 8 files [REPO] | Low | **DEFERRED** |
| 20 | Dead scaffolding and config | root `components/`, `constants/`, `hooks/`, `typedRoutes` [REPO] | Low | **DEFERRED** — "orphaned parallel implementations" half **FALSE POSITIVE** (see below) |
| 21 | `runtimeVersion` pinned to a literal with OTA enabled | `app.json` [REPO] | Medium | **DEFERRED** — build-number half **FALSE POSITIVE** |
| 22 | No tests, no typecheck script, no CI | `package.json`; no `.github/` [REPO] | Medium | **DEFERRED** |
| 23 | TTS generation exposed as callable Postgres RPCs | `pg_proc` ACLs read directly [LIVE] | Critical | **RESOLVED** 2026-08-23 — EXECUTE revoked from PUBLIC, anon, authenticated on all 4 signatures. Functions retained, not dropped |
| 24 | Token refresh unmounts the entire navigation tree | `AuthProvider.tsx:143`, `navigation/index.tsx:168` [REPO] | High | **DEFERRED** |
| 25 | "Streak" is total distinct days used, not consecutive days | `HomeScreen.tsx:163`, `StreaksScreen.tsx:30`, `WeeklyStreak.tsx:74` [REPO] | High (product) | **DEFERRED** |
| 26 | HomeScreen never refreshes after first load | `HomeScreen.tsx:134` [REPO] | Medium | **DEFERRED** |
| 27 | Sentry may be disabled in production builds | `App.tsx:20-23`; DSN absent from `.env*`/`eas.json` [REPO] | High | **OPEN** |
| 28 | Audio storage buckets are public | `storage.buckets` read directly [LIVE] | Low | **RESOLVED / NOT AN ISSUE** 2026-08-23 — 3 of 7 buckets are public by design (`audio-content`, `background-audio`, `spotify-uploads`); public *read* is the intended app playback path. The real problem was write access — see #42 |
| 29 | Progress writes fire twice per interval | `useAudioStore.ts`, `pos % 5000 < 200` at `updateInterval: 100` [REPO] | Low | **DEFERRED** |
| 30 | Bookmark toggle has a check-then-act race | `queries.ts:340-362` [REPO] | Low | **DEFERRED** |
| 31 | WebView renders arbitrary URLs with default settings | `WebViewScreen.tsx:27` [REPO] | Low (latent) | **DEFERRED** |
| 32 | Eight deployed Edge Functions absent from the repository | `supabase functions list` [LIVE] | Critical | **RESOLVED** 2026-08-23 — all eight source-recovered, committed, protected and redeployed |
| 33 | `smooth-endpoint` is an unauthenticated arbitrary-text TTS proxy | downloaded source, `smooth-endpoint/index.ts` [LIVE] | Critical | **RESOLVED** 2026-08-23 — `requireAdmin` added, deployed v23, validated |
| 34 | Undocumented production tables (`content_master`, `audio_segments`, `mangalam_characters`, 3× `yt_insta_*`) | PostgREST returns 200; absent from migrations and `database.types.ts` [LIVE] | High | **OPEN** — reclassified 2026-08-23: these are the **active CONTENT_PRODUCTION** subsystem (§2), not orphaned data. Schema drift only; must not be deleted |
| 35 | `INTERNAL_FUNCTION_SECRET` duplicates the service-role key value | digests match; referenced by no Edge Function and no DB function/trigger [LIVE] | Low | **NOT CONFIRMED as a live dependency** 2026-08-23 — appears entirely unused; safe to retire once double-checked outside the DB/function layer |
| 36 | Anon key is a 10-year JWT (`exp` 2036-02-29), published | decoded token claims [LIVE] | Informational | **OPEN** |
| 37 | **Any authenticated user can read every user's `activity_log`** | policy `Users can view activities` = `SELECT USING (true)` for role `authenticated` [LIVE] | **High** | **RESOLVED** 2026-08-23 — policy rewritten to `user_id = (SELECT auth.uid())`, applied to production and validated |
| 38 | **service_role JWT hardcoded in 3 database function bodies** | `generate_tts_filtered`, both `generate_tts_range` overloads [LIVE] | Medium — **downgraded**: no longer reachable via PUBLIC/anon/authenticated execution after #23 | **OPEN** — credential still embedded; cleanup and rotation are separate steps |
| 39 | `anon` holds USAGE on schema `net` and EXECUTE on `net.http_post`/`http_get`/`http_delete` | `has_function_privilege`; ownership check [LIVE] | Low — **downgraded**: no anon-executable path reaches it since #23 | **ACCEPTED — CANNOT FIX.** `net` and its functions are owned by `supabase_admin`, a platform role `postgres` cannot assume. Not fixable with any customer-level access |
| 40 | 5 views run with security-definer semantics (no `security_invoker`) | `pg_class.reloptions` empty, owner `postgres` [LIVE] | Low | **ACCEPTED — deliberately not changed** 2026-08-23. All 5 expose only already-public content; the `canonical_*` views read `storage.objects`, so switching would change results for no security gain. Forward-looking rule recorded instead |
| 42 | **Anonymous write access to the `audio-content` storage bucket** | `storage.objects` policies `Public Write Access` (INSERT) + `Public Update Access` (UPDATE), both granted to PUBLIC [LIVE] | **Critical** | **RESOLVED** 2026-08-23 — both policies dropped; read policy retained |
| 41 | SQL-driven TTS pipeline (RPC → `generate-tts-new` → Google TTS) | dormant since 2026-04-09; broken by the 2026-08-23 Edge Function hardening [LIVE] | Low (availability) | **RESOLVED — RETIRED** 2026-08-23. Decision: retire, not repair. Evidence-based, not proof of disuse |

### Detail on selected findings

### #23 — TTS RPC permissions: CONFIRMED (read-only catalog inspection, 2026-08-23)

Method: connected read-only via the Supabase CLI's ephemeral `cli_login_postgres`
role (obtained from `db dump --dry-run`), with
`SET default_transaction_read_only = on`. The functions were **not** executed.

**Actual ACLs** — identical for all four signatures:

```
acl: =X/postgres , postgres=X/postgres , anon=X/postgres ,
     authenticated=X/postgres , service_role=X/postgres
```

`=X/postgres` is the grant to **PUBLIC**. `has_function_privilege` confirms
`anon = true`, `authenticated = true`, `service_role = true` for every one:

| Function | Signature | SECURITY DEFINER | search_path | anon EXECUTE |
|---|---|---|---|---|
| `generate_all_tts` | `(book uuid)` | no (INVOKER) | not set | **yes** |
| `generate_tts_filtered` | `(book uuid, chapter int, verse int)` | no (INVOKER) | not set | **yes** |
| `generate_tts_range` | `(book uuid, start_verse int, end_verse int)` | no (INVOKER) | not set | **yes** |
| `generate_tts_range` | `(book uuid, chapter int, start_verse int, end_verse int)` | no (INVOKER) | not set | **yes** |

**Verdict: CONFIRMED.** Unauthorized execution is possible by any holder of the
published anon key. Revoking from `anon` and `authenticated` alone is *not*
sufficient — the PUBLIC grant must also be revoked.

**What the bodies actually do.** All four `perform net.http_post(...)` against
`/functions/v1/generate-tts-new`, one call per verse × 2 languages × 2 genders,
with `force: true`. Subsystem: **APP** (they select from `verses`).

Three material details:

1. **`generate_all_tts` is inert.** Its body still contains the template
   placeholders `https://YOUR_PROJECT.supabase.co` and
   `Bearer YOUR_SERVICE_ROLE_KEY`. It was never configured, so it cannot reach
   the project. It remains anon-executable and would enqueue failing outbound
   requests, but it cannot cause paid generation.
2. **`generate_tts_filtered` and both `generate_tts_range` overloads are live** —
   real project URL, and a **real hardcoded `service_role` JWT** (role claim
   `service_role`, expiry 2036-02-29) embedded as a string literal in the
   function body. See finding #38.
3. **The chain is executable by anon end to end.** Because the functions are
   SECURITY INVOKER they run with the caller's privileges, and `anon` holds
   USAGE on schema `net` plus EXECUTE on `net.http_post` (#39). `anon` can also
   read `verses`. So nothing in the database stops the call.

**Mitigating factors, verified:**

- The `net` schema is **not** exposed through PostgREST — probing
  `/rest/v1/rpc/http_post` returns `PGRST202` naming `public.http_post`, so
  `net.http_post` is not directly callable over REST. There is no general SSRF
  primitive for anon; only these four `public` wrappers reach it.
- `anon` has `statement_timeout = 3s`, which bounds how much a single call can
  enqueue.
- **The paid step is currently blocked**: `generate-tts-new` was hardened on
  2026-08-23 and rejects these calls with 403, because they send only the
  service-role bearer and no `x-admin-secret`. This is defence in depth, not a
  fix — see #41.



### #42 — anonymous write access to the app audio catalogue

Found 2026-08-23 while resolving the previously-unverified #28. `storage.objects`
carried three policies, **all granted to `PUBLIC`** — which includes `anon`,
whose key ships in the mobile bundle and was published in this repository:

| Policy | Command | Roles | Expression |
|---|---|---|---|
| `Public Read Access` | SELECT | PUBLIC | `USING (bucket_id = 'audio-content')` |
| `Public Write Access` | INSERT | PUBLIC | `WITH CHECK (bucket_id = 'audio-content')` |
| `Public Update Access` | UPDATE | PUBLIC | `USING (bucket_id = 'audio-content')` |

**Verified exploitable** against production, inside rolled-back transactions:

| Test as role `anon` | Result before fix |
|---|---|
| `INSERT` into `audio-content` | **succeeded** |
| `UPDATE` objects in `audio-content` | **3,544 rows updatable** |
| `INSERT` into `YTInstaContent` | denied — RLS violation |

Anyone holding the published anon key could upload new objects into
`audio-content` and modify **all 3,544 existing narration files** — i.e.
overwrite the app's entire devotional audio catalogue. For a product whose
substance is narrated scripture, that is a content-integrity failure at least as
serious as the earlier billing exposures. `file_size_limit` is unset on the
bucket, so upload volume was unbounded too.

**Scope was limited to `audio-content`.** The CONTENT_PRODUCTION and MEDIA_AUDIT
buckets — `YTInstaContent` (111 objects), `spotify-uploads` (32), `ArtWorks` (7),
`Intro Static` (10), `Spotify Podcast` (10), `background-audio` (9) — carry no
PUBLIC policy and already denied anonymous writes. `DELETE` had no policy at all
and was already denied.

**Nothing legitimate depended on the write policies** [REPO]:

- the mobile app only reads storage via `getPublicUrl`; it contains no upload,
  `storage.from(...).upload`, or signed-upload call anywhere in `src/`;
- all six Edge Functions that upload (`generate-tts`, `generate-tts-new`,
  `dynamic-responder`, `edit-audio-segment`, `generate-audio-segment`,
  `generate-audio-segments`) build their client with
  `SUPABASE_SERVICE_ROLE_KEY`, and `service_role` has `rolbypassrls = true`, so
  RLS policies never applied to them in the first place.

### #23 / #41 — the SQL → Edge Function → Google TTS dependency

**The chain, confirmed [LIVE]:**

```
anon or authenticated  (public anon key)
  └─ POST /rest/v1/rpc/generate_tts_filtered | generate_tts_range   ← EXECUTE granted to PUBLIC (#23)
       └─ net.http_post()                                            ← anon holds EXECUTE (#39)
            └─ POST /functions/v1/generate-tts-new                   ← hardcoded service_role JWT (#38)
                 └─ Google Cloud TTS                                 ← the paid operation
```

Subsystem: **APP** — the RPCs select from `verses`, and `generate-tts-new`
writes `verse_content`-derived audio to the `audio-content` bucket. This is the
app audio pipeline, **not** CONTENT_PRODUCTION.

**Current effective state:** the paid step is **blocked**. `generate-tts-new`
was hardened on 2026-08-23 and returns 403 to these calls, because they send
only `Authorization: Bearer <service_role>` and no `x-admin-secret`. That is
defence in depth, not a fix — the database-level grants are still wrong.

**#23 status: RESOLVED 2026-08-23.** Precisely:

> Unauthorized execution of the SQL-driven TTS RPCs has been removed by revoking
> EXECUTE from PUBLIC, anon, and authenticated. The functions remain deployed as
> retained historical code and were not dropped.

The chain above is now severed at its **first** hop: an anon or authenticated
caller receives `42501 permission denied for function` before reaching
`net.http_post`. The Edge Function hardening remains as a second, independent
barrier at the third hop.

### #41 — is the SQL-driven TTS pipeline still required?

Evidence gathered [LIVE] 2026-08-23, read-only:

| Signal | Result |
|---|---|
| Repository callers of these RPCs | **none** |
| Database triggers referencing them | **none** (only 2 `updated_at` triggers exist) |
| `pg_cron` scheduled jobs | **extension not installed** |
| `pg_net` pending queue | **0** |
| `pg_net` response rows | **0** (TTL-aged; 1,108 cumulative writes historically) |
| `pg_stat_user_functions` call counts | **unavailable** — `track_functions = none` |
| `verse_audio` newest row | **2026-04-09** — over 4 months ago |
| `audio_cache` newest row | **2026-04-09** |
| `verse_audio` status breakdown | **3,544 ready, 0 failed, 0 processing** |
| Edge Function invocation logs | **UNAVAILABLE** via CLI — see §9 |

**Conclusion: no evidence the SQL-driven TTS pipeline is currently required.**
The APP audio catalogue is complete and has not changed since 2026-04-09, and
there are zero `failed` or `processing` rows — so nothing has attempted
generation and failed since the Edge Functions were hardened. The 2026-08-23
hardening broke a path that was already dormant.

This is **absence of evidence of use**, not proof of disuse: function call
statistics are off and Edge Function logs are unavailable, so an occasional
manual operator run through the dashboard SQL editor would leave no trace
visible here.

**Decision taken 2026-08-23: RETIRE, not repair.** EXECUTE revoked from PUBLIC,
anon and authenticated; `service_role` retained; functions preserved.

**This is evidence-based retirement, not proof that no undocumented manual
caller exists.** `track_functions` is off and Edge Function logs are unavailable,
so an occasional operator run through the dashboard SQL editor would leave no
trace visible here. The mitigation for that residual risk is that the functions
still exist and `service_role` can still execute them — so a legitimate operator
workflow can be restored without recreating anything.

The Vault-based repair design considered and rejected is recorded in §10.

### #38 — service_role JWT hardcoded in database function bodies — STILL OPEN

**Status after the 2026-08-23 retirement:**

- The embedded credential is **still present** in `generate_tts_filtered` and
  both `generate_tts_range` overloads. Their bodies were deliberately not
  modified.
- It is **no longer reachable through PUBLIC / anon / authenticated execution**,
  because those roles can no longer invoke the functions at all (#23).
- It still **requires cleanup**: the literal must be removed from the function
  bodies.
- **Credential rotation remains a separate remediation step** — removing the
  literal does not invalidate the key, exactly as with the Gemini key (#2).

Vault was deliberately **not** introduced to hold this secret, because doing so
would add a new secret-management path to database code solely to preserve a
pipeline that is now retired. See §10.



`generate_tts_filtered` and both `generate_tts_range` overloads embed a literal
`Bearer eyJ…` whose decoded claim is `role: service_role`, valid to 2036-02-29.
Anyone able to read `pg_proc` (readable by PUBLIC within Postgres) can recover a
full service-role credential. It is **not** reachable via PostgREST — anon cannot
query `pg_catalog` — so this is not remotely exploitable with the anon key alone,
but it is a stored plaintext credential that belongs in Vault or a function
setting, and it means rotating the service-role key requires editing these
function bodies.

### #37 — activity_log is readable across users

```
policy "Users can view activities"  cmd=SELECT  roles=authenticated  USING (true)
```

The INSERT policy is correctly scoped (`user_id = auth.uid()`), but the SELECT
policy has no predicate. Any signed-in user can read **every** row of
`activity_log` — 2,969 rows covering `user_id`, `content_id`, `content_type`,
`action_type`, `created_at`. That is every user's listening, bookmarking and
sharing history. `anon` is unaffected (the policy is scoped to `authenticated`),
which is why the earlier anon probe returned zero rows and this was missed.



**#3 — Edge Functions performed no caller authorization.** RESOLVED.
Both handlers went straight from `serve()` to `req.json()` with a service-role
client and no `Authorization` inspection. `verify_jwt` was the only gate, and the
anon key is a project-signed JWT that satisfies it. `generate-tts` was worse
still: deployed with `verify_jwt` **disabled**, so it ran with no credential at
all — proven [LIVE] by an unauthenticated POST reaching the handler's own
parameter guard. Resolution in §4.

**#4 — `increment_daily_usage`.** The function is `SECURITY DEFINER`, so it
bypasses the correct RLS on `user_daily_usage`, and it never compared
`p_user_id` to `auth.uid()`. A migration is written but **not applied**.
The originally reported missing `search_path` was **incorrect** — it is set by
`20260305_security_performance_hardening.sql:3`.

**#23 — TTS generation RPCs.** Existence and exact signatures confirmed [LIVE]
via PostgREST argument coercion; `book` is `uuid`, not `text` (correcting
`database.types.ts`). **The EXECUTE grant itself is not yet confirmed** —
argument coercion fires before the ACL check, so it cannot be separated from a
permission denial without executing the function, which was prohibited.
PostgreSQL grants EXECUTE to `PUBLIC` by default and no migration revokes it,
and anon was shown to execute `get_top_content` [LIVE] — so anon almost
certainly holds EXECUTE, but this is **[ASSUMED]** until the `proacl` query runs.

**#20, #21 — partially FALSE POSITIVE.** The "orphaned parallel implementations"
claim was wrong: every screen except `AuthScreen` is routed, and `AuthScreen` is
a documented deliberate exception (CLAUDE.md §3); `Card` and `BookCard` are
distinct components, both in use. The `versionCode` half of #21 was wrong:
`eas.json` sets `appVersionSource: remote` with `autoIncrement`. The static
`runtimeVersion` concern stands.

**Also recorded as FALSE POSITIVE:** an earlier report that
`supabase/.temp/pooler-url` contained a committed database password. It contains
the literal placeholder `[YOUR-PASSWORD]` [REPO]. No credential was exposed there.

**Also corrected:** an earlier claim that the leaked Gemini/TTS/RapidAPI values
differed from current ones. That comparison read the wrong file. See §8.

---

## 4. Changes Applied

### 2026-08-23 — Edge Function authorization

Committed on branch `security/edge-function-authorization`, commit `1841d76`.

**New — `supabase/functions/_shared/adminAuth.ts`**
Single shared `requireAdmin(req)` helper. Compares an `x-admin-secret` request
header against the `ADMIN_API_SECRET` function secret using a constant-time
comparison; returns `403 Forbidden` on mismatch and `500 Server misconfigured`
when the secret is unset. *Why:* both functions needed the same rule, and
CLAUDE.md §3 forbids duplicate parallel implementations of one concern.
*Expected behaviour:* fails closed — a missing secret denies rather than allows.

**`supabase/functions/generate-tts/index.ts`** — deployed **v37** [LIVE]
- `requireAdmin(req)` as the first statement of the handler.
- Wildcard `Access-Control-Allow-Origin: '*'` and the OPTIONS preflight removed,
  replaced by a local `jsonHeaders` constant.
- *Why:* the anon JWT alone was sufficient to reach the function, and
  `verify_jwt` was additionally disabled. It is a server-to-server function, so
  no browser origin needs CORS.
- *Expected behaviour:* authorization precedes the service-role client
  construction, the body read, the Google TTS call, and every storage/DB write.
  Service-role operations remain entirely server-side.

**`supabase/functions/import-content/index.ts`** — deployed **v56** [LIVE]
- `requireAdmin(req)` as the first statement, before the `try` block.
- *Why:* invocable by any anon-key holder, and it upserts into `verses` and
  `verse_content` with the service-role key — a catalogue-defacement path, not
  just a billing one.

**New — `supabase/config.toml`**
Pins `verify_jwt = true` for both functions. *Why:* a plain redeploy did **not**
reset the flag on `generate-tts` — that required the config entry. Version
control now owns the setting rather than a per-deploy flag.

**`scripts/tools/preview_english_verse_robust.py`**
Hardcoded Gemini key replaced with `os.environ.get("GEMINI_API_KEY")` plus a
fail-fast, matching the pattern already used by `preview_english_verse.py`.
*Note:* removing the literal does **not** invalidate the key. Finding #2 stays
IN PROGRESS until the key is deleted at the provider.

**Validation performed [LIVE], post-deploy:**

| Request | `generate-tts` | `import-content` |
|---|---|---|
| No auth header | 401 (gateway) | 401 (gateway) |
| Anon key, no admin header | 403 | 403 |
| Anon key, wrong admin header | 403 | 403 |
| Authorized | reaches handler param guard | reaches handler param guard |

`tsc --noEmit` clean. No paid TTS or Gemini generation was performed at any point
— all probes used empty bodies that hit parameter guards before any vendor call.

### 2026-08-23 — Operator scripts updated

Four scripts now send `x-admin-secret`, read from the environment, each failing
fast when it is unset. Not yet committed at time of writing.

- `scripts/tools/regenerate_verse_1_1.js` — header added to the existing `headers` object.
- `scripts/tools/retry_failed_mahabharat_audio.ts` — `headers` added to the existing `functions.invoke` call.
- `scripts/tools/test_verse_1_1_new_source.py` — header added to the existing dict.
- `scripts/tools/test_verse_1_1.sh` — header added to the existing `curl`.

*Why:* these are the only tracked legitimate callers; the new check would
otherwise return 403 for real operator work.

`scripts/tools/retry_ramayan_audio.ts` was **not** changed — it calls
`texttospeech.googleapis.com` directly and never invokes an Edge Function
(`retry_ramayan_audio.ts:37`). An earlier report listing it as a caller was wrong.

### 2026-08-23 — All eight remaining Edge Functions protected

**Source recovery.** The eight functions existed only in production. Each was
retrieved with `supabase functions download`, verified byte-identical to the
deployed version, and committed under `supabase/functions/<name>/`. This closes
finding #32 and gives the CONTENT_PRODUCTION and APP audio pipelines a
version-controlled source for the first time.

**Files changed** — one file per function, each receiving the same two edits:
an `import { requireAdmin } from "../_shared/adminAuth.ts"` line, and a
`requireAdmin(req)` guard placed before any body parse, vendor API call,
service-role operation, or storage write:

| Function | Entry file | Guard placement | Deployed |
|---|---|---|---|
| `smooth-endpoint` | `index.ts` | after OPTIONS return | v23 |
| `generate-audio-segments` | `index.ts` | after OPTIONS return | v29 |
| `generate-audio-segment` | `index.ts` | after OPTIONS return | v13 |
| `edit-audio-segment` | `index.ts` | after OPTIONS return | v6 |
| `generate-tts-new` | `index.ts` | after OPTIONS return | v42 |
| `batch-generate-audio` | `index.ts` | after OPTIONS return | v5 |
| `dynamic-responder` | `Gemini-2.5-Pro-TTS.ts` | first statement, outside `try` | v16 |
| `geenerate-audio-edge` | `index.ts` | first statement, outside `try` | v18 |

Where an OPTIONS preflight existed it was left in place and the guard placed
immediately after it: the preflight returns a static `"ok"` and performs no
privileged work, so behaviour is preserved without weakening the control. In the
two functions with no preflight the guard is the first statement and sits
*outside* the `try`, so a denial cannot be swallowed into a 500.

**Chain forwarding.** `geenerate-audio-edge/index.ts:178` and
`batch-generate-audio/index.ts:107` now send `x-admin-secret` read from their own
`Deno.env`. No functional change to either pipeline.

**`supabase/config.toml`** — `verify_jwt = true` added for all eight, plus an
`entrypoint` for `dynamic-responder`'s non-standard file name.

**Reason.** All eight performed privileged or paid work (Gemini TTS, Google TTS,
service-role writes, storage writes) with **no authorization whatsoever**;
`verify_jwt=true` was satisfied by the published anon key.

**Validation performed [LIVE]** — all ten functions, no authorized generation
triggered: no auth header → **401** (gateway); anon key only → **403**; anon key
+ wrong secret → **403**. `verify_jwt=true` confirmed on all ten via
`supabase functions list`. App `tsc --noEmit` clean; operator scripts pass syntax
checks; all eight deploys bundled successfully. No paid TTS or Gemini call was
made at any point.

**Known operational consequence.** Any caller outside this repository — n8n,
cron, dashboards, manual scripts — that drives these functions will now receive
**403** until it sends `x-admin-secret`. This affects the CONTENT_PRODUCTION
pipeline (YouTube/Spotify/Instagram) as well as APP audio generation. See §9.

### 2026-08-23 — #37 and #4 applied to production

**Migration:** `supabase/migrations/20260823140000_fix_activity_log_rls_and_usage_authz.sql`
— contains only these two fixes. Applied to production as a single transaction
via the CLI's ephemeral `cli_login_postgres` role with `SET ROLE postgres`
(both objects are owned by `postgres`). **`db push` was not used** — the local
and remote migration histories are disjoint (§7), and reconciling them is out of
scope. The migration file therefore exists locally but is **not** recorded in
`supabase_migrations.schema_migrations`; the production state and the file agree,
the history table does not.

The earlier draft `20260823090100_harden_increment_daily_usage.sql` was removed
as superseded — keeping two migrations that redefine the same function would be
a duplicate implementation.

#### #37 — activity_log cross-user read

| | Policy |
|---|---|
| **Before** | `"Users can view activities"` · SELECT · role `authenticated` · `USING (true)` |
| **After** | `"Users can view activities"` · SELECT · role `authenticated` · `USING (user_id = (SELECT auth.uid()))` |

Policy name preserved. The INSERT policy
(`"Users can record their own activities"`, `WITH CHECK user_id = auth.uid()`)
was **not** touched, and no other table's policies were modified — policy counts
across `public` are unchanged.

`auth.uid()` is wrapped in a scalar subquery so it evaluates once per query
rather than per row, matching `20260305_security_performance_hardening.sql`.

**Validation [LIVE]** — counts only, no row data read:

| Scenario | Result |
|---|---|
| RLS bypassed (owner role) — total rows | 2,969 |
| `authenticated` with a uid owning nothing | **0** — PASS |
| `authenticated` as a real owner | **2,815 of 2,969** — exactly their own — PASS |
| `anon` (SQL) | **0** — PASS |
| `anon` via PostgREST | `content-range: */0` — PASS |

The 154-row difference between 2,969 and 2,815 is other users' data that is now
correctly hidden.

#### #4 — increment_daily_usage authorization

| | Behaviour |
|---|---|
| **Before** | Accepted any `p_user_id`; never compared it to `auth.uid()`. SECURITY DEFINER, so it bypassed the correct RLS on `user_daily_usage` |
| **After** | Raises `42501` if `auth.uid()` is null, and `42501` if `p_user_id <> auth.uid()`. Otherwise inserts/updates using `auth.uid()` |

Signature preserved, so `src/lib/queries.ts:143` needs no change — the app
already passes `session.user.id`. SECURITY DEFINER retained;
`search_path = public` retained and re-asserted.

**Validation [LIVE]** — denial paths raise before any write; the success path was
run inside a transaction and rolled back:

| Scenario | Result |
|---|---|
| `authenticated`, `p_user_id` = another user's uuid | `42501 cannot modify usage for another user` — PASS |
| No auth context (`auth.uid()` null) | `42501 authentication required` — PASS |
| Owner incrementing their own usage | Succeeded; row for today created in-transaction — PASS |
| After `ROLLBACK` | 0 rows persisted — **no real usage data modified** |
| anon via PostgREST RPC | `42501 authentication required`, HTTP 401 — PASS |

### 2026-08-23 — #23 / #41: SQL-driven TTS pipeline retired

**Migration:** `supabase/migrations/20260823150000_retire_tts_rpc_execute_grants.sql`
— contains only EXECUTE revocations. Applied to production as a single
transaction via `SET ROLE postgres`, the same mechanism used for
`20260823140000`. **`db push` was not used** (histories are disjoint, §7), so the
file is not recorded in `supabase_migrations.schema_migrations`.

The earlier draft `20260823090000_revoke_tts_rpc_execute.sql` was removed as
superseded — it was never applied, and keeping two migrations performing the
same revocation would be a duplicate implementation.

**Signatures affected (all four):**

| Function | ACL before | ACL after |
|---|---|---|
| `generate_all_tts(uuid)` | `=X/postgres , postgres=X/postgres , anon=X/postgres , authenticated=X/postgres , service_role=X/postgres` | `postgres=X/postgres , service_role=X/postgres` |
| `generate_tts_filtered(uuid,int,int)` | same as above | same as above |
| `generate_tts_range(uuid,int,int)` | same as above | same as above |
| `generate_tts_range(uuid,int,int,int)` | same as above | same as above |

`=X/postgres` is the PostgreSQL default grant to **PUBLIC**. Revoking only anon
and authenticated would have changed nothing, since both inherit PUBLIC — so
PUBLIC was revoked explicitly. `service_role` held its own direct grant and was
deliberately left in place.

**Effective EXECUTE after, verified [LIVE]:**

| Function | anon | authenticated | service_role | PUBLIC |
|---|---|---|---|---|
| `generate_all_tts(uuid)` | **false** | **false** | true | removed |
| `generate_tts_filtered(uuid,int,int)` | **false** | **false** | true | removed |
| `generate_tts_range(uuid,int,int)` | **false** | **false** | true | removed |
| `generate_tts_range(uuid,int,int,int)` | **false** | **false** | true | removed |

**Functions were NOT dropped.** All four signatures still exist
(`surviving_signatures = 4`) and their bodies are unmodified — each still
contains its `net.http_post` call, confirmed [LIVE].

**End-to-end validation with the public anon key**, using a UUID matching no
`books` row so the body could not have issued any HTTP request even if
authorized:

| Call | Result |
|---|---|
| `POST /rest/v1/rpc/generate_all_tts` | `42501 permission denied for function generate_all_tts` |
| `POST /rest/v1/rpc/generate_tts_filtered` | `42501 permission denied for function generate_tts_filtered` |
| `POST /rest/v1/rpc/generate_tts_range` (3-arg) | `42501 permission denied for function generate_tts_range` |
| `POST /rest/v1/rpc/generate_tts_range` (4-arg) | `42501 permission denied for function generate_tts_range` |
| `pg_net` queue / responses after probes | **0 / 0** — nothing executed |

**No collateral impact**, verified [LIVE]: `get_top_content` still returns 200
for anon, and `books` (4), `verses` (886), `verse_content` (1,772),
`verse_audio` (3,544) all remain readable. No table, RLS policy, function body,
Edge Function, or application file was modified.

### 2026-08-23 — #42: anonymous storage write access removed

**Migration:** `supabase/migrations/20260823160000_remove_public_storage_write_policies.sql`
— drops two policies, nothing else. Applied to production in a single
transaction via `SET ROLE postgres`. (`storage.objects` is owned by
`supabase_storage_admin`, which this role cannot assume, but `postgres` retains
policy-management rights on it — verified with a rolled-back `DROP POLICY`
before applying for real.) **`db push` not used**, per the disjoint-history
constraint in §7.

| Policy | Action | Reason |
|---|---|---|
| `Public Write Access` (INSERT) | **dropped** | Allowed anyone with the anon key to upload into `audio-content` |
| `Public Update Access` (UPDATE) | **dropped** | Allowed anyone with the anon key to overwrite all 3,544 narration files |
| `Public Read Access` (SELECT) | **retained** | This is the app's playback path; removing it would break audio |

Dropping was chosen over narrowing to `authenticated`: no caller needs these at
any privilege level, because the only legitimate writer is `service_role`, which
bypasses RLS entirely. Adding a narrower policy would have been new mechanism
for no consumer.

**Validation [LIVE]** — all write tests inside rolled-back transactions:

| Check | Before | After |
|---|---|---|
| `anon` INSERT into `audio-content` | succeeded | **RLS violation** |
| `anon` UPDATE rows in `audio-content` (`GET DIAGNOSTICS`) | **3,544** | **0** |
| `anon` SELECT objects in `audio-content` | 3,544 | **3,544** — unchanged |
| `service_role` UPDATE rows | — | **3,544** — pipelines unaffected |
| Remaining policies on `storage.objects` | 3 | **1** (`Public Read Access`) |

**End-to-end over HTTP with the public anon key:**

- Real playback path — `GET /storage/v1/object/public/audio-content/<path>` →
  **HTTP 206, `audio/mpeg`**. App audio still works.
- Upload attempt — `POST /storage/v1/object/audio-content/...` →
  **`403 AccessDenied`, "new row violates row-level security policy"**.
- Object counts unchanged across all 7 buckets; zero probe objects created.

### 2026-08-23 — #38: embedded service_role JWT removed

**Migration:** `supabase/migrations/20260823170000_remove_embedded_service_role_jwt.sql`.
Applied in a single transaction via `SET ROLE postgres`.

`generate_tts_filtered` and both `generate_tts_range` overloads carried a literal
`Bearer eyJ…` decoding to `role: service_role` (valid to 2036). Any role able to
read `pg_proc` could recover a full service-role credential, and its presence
blocked service-role key rotation — rotating would have silently broken these
functions.

**Why this was safe to do now:** the credential was already non-functional. These
functions call `/functions/v1/generate-tts-new`, which since 2026-08-23 requires
an `x-admin-secret` header they do not send, so the request is refused at the
gateway regardless of bearer token. Removing the literal cost no working
capability.

The token was replaced with the placeholder `YOUR_SERVICE_ROLE_KEY`, matching
what `generate_all_tts` already contained — all four functions now share one
consistent, credential-free shape as retained historical code.

**Implementation:** rather than re-typing three bodies of code that is
deliberately being preserved, the migration regenerates each definition from
`pg_get_functiondef` and substitutes only the bearer token, so nothing else can
change. It selects only functions still containing a real JWT, so it is
idempotent.

**Validation [LIVE]** — dry-run executed in a rolled-back transaction first:

| Check | Result |
|---|---|
| Functions rewritten | 3 |
| Real JWT remaining in any `public`/`extensions` function body | **0** |
| Placeholder present in all 4 TTS functions | yes |
| `net.http_post` call still present in all 4 bodies | yes |
| Project URL preserved in the 3 live-URL functions | yes |
| `anon` EXECUTE after rewrite | still **false** — `CREATE OR REPLACE` preserved the #23 revocation |

**This does not rotate the service-role key.** The leaked value remains valid
until rotated in the Supabase dashboard.

### Secrets configuration

`ADMIN_API_SECRET` generated and registered as a Supabase Edge Function secret
[LIVE]. Value stored locally in the gitignored `.env.local`. Never printed, never
committed, never present in `src/`.

---

## 5. Authorization Architecture

**Mobile client.** Reads published content (`books`, `verses`, `verse_content`,
`verse_audio`, `audio_cache`, `canonical_*` views) and reads/writes only its own
rows in `user_progress`, `user_daily_usage`, `user_bookmarks`, `activity_log`,
`profiles`. Authenticates via Google or Apple sign-in producing a Supabase
session; the anon key plus that session JWT authenticates PostgREST, and RLS
decides row visibility. **The app invokes no Edge Function** [REPO] — verified by
searching `src/` for `functions/v1/` and `functions.invoke`.

**Authenticated users.** Same as above. There is no elevated user tier. The
client-only `accountStatus` flag in `useAppStore` has no backend counterpart and
grants nothing.

**Operator / admin functions.** `generate-tts` and `import-content` are
operator-only: they spend money and write the published catalogue with the
service-role key. They are not user-facing and must never become reachable from
the app.

**How Edge Functions authenticate callers.** Two layers, both required:

1. **Gateway** — `verify_jwt = true`, pinned in `supabase/config.toml`. Rejects
   requests carrying no project token.
2. **Handler** — `requireAdmin()` compares `x-admin-secret` against
   `ADMIN_API_SECRET` in constant time, before any privileged work.

**Why the anon key is NOT authorization.** The Supabase anon key is a JWT signed
with the project's JWT secret. `verify_jwt` validates exactly that signature, so
the anon key satisfies it. That key ships inside the mobile bundle and was
published in this repository — it is public by design. `verify_jwt` therefore
distinguishes "holds a project token" from "holds nothing"; it cannot
distinguish an ordinary mobile client from an operator, and so cannot gate
spending or service-role writes. It is a coarse filter, not a lock.

**Where `ADMIN_API_SECRET` lives.** Supabase Edge Function secrets (server-side
only) and the local gitignored `.env.local` for operator scripts. It must never
be an `EXPO_PUBLIC_*` variable, never appear in `src/`, never be committed, and
never be logged. The header is deliberately `x-admin-secret` rather than
`Authorization`, which the gateway consumes.

**Internal Edge Function → Edge Function calls.** Two chains exist [LIVE]:
`batch-generate-audio` → `generate-audio-segments`, and `geenerate-audio-edge` →
`generate-tts-new`. Both authenticate with
`Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`. When `requireAdmin` is
extended to those functions, the callers must also forward `x-admin-secret`.

**Service-role protection.** The service-role key exists only in the Edge
Function environment, injected by the platform. It appears nowhere in `src/`, in
`EXPO_PUBLIC_*`, or in tracked source [REPO]. It is never sent to a client and
never used as a header secret — which is why `INTERNAL_FUNCTION_SECRET` was
**not** reused for the admin check despite already existing (see §10).

---

## 6. Edge Functions Inventory

All ten deployed functions. Verified [LIVE] 2026-08-23 after the authorization
rollout. Subsystem per §2. Update on every deploy, removal, rename, or
authorization change.

| Function | In repo | verify_jwt | Explicit auth | Privileged / paid operation | Subsystem | Called by | Status |
|---|---|---|---|---|---|---|---|
| `generate-tts` (v37) | yes | true | **x-admin-secret** | Google TTS; service-role; storage + DB writes | APP | 2 operator scripts | **Protected** |
| `import-content` (v56) | yes | true | **x-admin-secret** | Gemini; service-role; writes `verses`, `verse_content` | APP | 2 operator scripts | **Protected** |
| `generate-tts-new` (v42) | yes (recovered) | true | **x-admin-secret** | `TTS_API_KEY`; service-role; storage | APP | `geenerate-audio-edge` | **Protected** |
| `geenerate-audio-edge` (v18) | yes (recovered) | true | **x-admin-secret** | service-role; orchestrates bulk TTS over `verses` | APP | UNKNOWN (external) | **Protected** |
| `dynamic-responder` (v16) | yes (recovered) | true | **x-admin-secret** | Gemini TTS (`gemini-2.5-flash-preview-tts`); service-role; storage; writes `verse_audio` | APP | UNKNOWN (external) | **Protected** |
| `generate-audio-segments` (v29) | yes (recovered) | true | **x-admin-secret** | Gemini TTS (`gemini-3.1-flash-tts-preview`); service-role; storage; upsert | CONTENT_PRODUCTION | `batch-generate-audio` | **Protected** |
| `generate-audio-segment` (v13) | yes (recovered) | true | **x-admin-secret** | Gemini TTS; service-role; storage; upsert | **SHARED** | UNKNOWN (external) | **Protected** |
| `edit-audio-segment` (v6) | yes (recovered) | true | **x-admin-secret** | Gemini TTS (`gemini-2.0-flash-tts`); service-role; storage; upsert | CONTENT_PRODUCTION | UNKNOWN (external) | **Protected** |
| `batch-generate-audio` (v5) | yes (recovered) | true | **x-admin-secret** | service-role; updates `content_master`; fans out to segments | CONTENT_PRODUCTION | UNKNOWN (external) | **Protected** |
| `smooth-endpoint` (v23) | yes (recovered) | true | **x-admin-secret** | Google TTS on **arbitrary caller-supplied text** | UNKNOWN | UNKNOWN (external) | **Protected** |

### Subsystem assignment evidence

Derived [REPO] from each function's actual table and storage dependencies, not
from repository visibility:

| Function | Tables touched | Buckets | Subsystem |
|---|---|---|---|
| `generate-tts` | `audio_cache`, `verse_audio`, `verse_content` | — | APP |
| `import-content` | `books`, `verses`, `verse_content` | — | APP |
| `dynamic-responder` | `verse_audio`, `verse_content` | `audio-content` | APP |
| `generate-tts-new` | `verse_content` | `audio-content` | APP |
| `geenerate-audio-edge` | `verses` | — | APP |
| `batch-generate-audio` | `content_master` | — | CONTENT_PRODUCTION |
| `generate-audio-segments` | `content_master`, `audio_segments` | — | CONTENT_PRODUCTION |
| `edit-audio-segment` | `content_master`, `audio_segments` | — | CONTENT_PRODUCTION |
| `generate-audio-segment` | `content_master`, `audio_segments`, **`books`** | — | **SHARED** |
| `smooth-endpoint` | none | none | **UNKNOWN** |

Two refinements from this evidence:

- **`generate-audio-segment` is SHARED, not purely CONTENT_PRODUCTION.** It
  reads the APP table `books` in `getBookFolder()` to build a storage folder
  path, so it spans both subsystems. This matters for the future consolidation:
  it is a real cross-subsystem dependency, not an incidental one.
- **`smooth-endpoint` touches no table and no bucket at all** — a pure
  text-to-speech utility. Its subsystem genuinely cannot be determined from
  code, which is why it stays UNKNOWN rather than being assumed unused.

**Latent bug noted while classifying (not fixed — out of scope):**
`generate-audio-segment`'s `getBookFolder()` runs
`.from("books").select("name")`, but `books` has no `name` column (it has
`slug`, `title`, `title_en`, `title_hi`). That select will error, so the helper
presumably always takes its fallback path. Recorded for whoever owns the
CONTENT_PRODUCTION pipeline; no behaviour was changed here.

Notes:
- `verify_jwt=true` alone provides **no** protection — the published anon key
  satisfies it. The `x-admin-secret` check is the real control.
- `geenerate-audio-edge` is misspelled in production; recorded verbatim.
- `dynamic-responder`'s entrypoint is `Gemini-2.5-Pro-TTS.ts`, not `index.ts`;
  pinned in `supabase/config.toml`.
- All eight recovered sources were retrieved with `supabase functions download`
  and verified byte-identical to production before modification.

### Internal chains

Two Edge Function → Edge Function chains exist. Both sides are now protected,
and each caller forwards `x-admin-secret` from **its own server-side
environment** (`Deno.env.get("ADMIN_API_SECRET")`) alongside the existing
`Authorization: Bearer <service-role>` header:

| Chain | Caller | Callee | Forwarding site |
|---|---|---|---|
| Bulk verse TTS (APP) | `geenerate-audio-edge` | `generate-tts-new` | `geenerate-audio-edge/index.ts:178` |
| Segment batch (CONTENT_PRODUCTION) | `batch-generate-audio` | `generate-audio-segments` | `batch-generate-audio/index.ts:107` |

The secret is never read from client input, never placed in a URL or request
body, never logged, and never returned in a response. Functional behaviour of
both pipelines is unchanged — only a header was added.

### Caller inventory

Every invocation path found [REPO] 2026-08-23, categorised:

| Caller category | Count | Detail |
|---|---|---|
| Mobile app (`src/`) | **0** | The app invokes no Edge Function at all |
| Operator scripts | 4 | `regenerate_verse_1_1.js`, `retry_failed_mahabharat_audio.ts` → `generate-tts`; `test_verse_1_1.sh`, `test_verse_1_1_new_source.py` → `import-content`. All updated to send the header |
| Edge Function → Edge Function | 2 | The two chains above |
| Database / `pg_net` / `http_post` | **0** | No tracked migration contains any HTTP call |
| Content-production pipeline | **UNKNOWN** | No in-repo caller drives `batch-generate-audio` or the segment functions; the trigger is external |
| Media/audit pipeline | **UNKNOWN** | Nothing writes the `yt_insta_*` tables from the Edge Function layer |

**Six of the ten functions have no identified caller anywhere**
(`smooth-endpoint`, `generate-audio-segment`, `edit-audio-segment`,
`dynamic-responder`, `batch-generate-audio`, `geenerate-audio-edge`). Since the
CONTENT_PRODUCTION pipeline demonstrably runs, at least some are driven by
something outside this repository. Identifying those callers is the outstanding
dependency question — see §9.

## 7. Database / RPC Inventory

### Security-sensitive RPCs — VERIFIED [LIVE] 2026-08-23

Read directly from `pg_proc` via read-only catalog queries. Originally **all 11**
public functions carried the PostgreSQL PUBLIC default. As of 2026-08-23 the four
TTS generation functions have had that grant revoked (#23); the remaining seven
still carry it.

| Function | SEC DEFINER | search_path | anon EXEC | Subsystem | Note |
|---|---|---|---|---|---|
| `generate_all_tts(uuid)` | no | not set | **no** (revoked 2026-08-23) | APP | Retired; service_role only. Inert — placeholder URL/token (#23) |
| `generate_tts_filtered(uuid,int,int)` | no | not set | **no** (revoked 2026-08-23) | APP | Retired; service_role only. Live; hardcoded service_role JWT (#38) |
| `generate_tts_range(uuid,int,int)` | no | not set | **no** (revoked 2026-08-23) | APP | Retired; service_role only. Live; hardcoded service_role JWT (#38) |
| `generate_tts_range(uuid,int,int,int)` | no | not set | **no** (revoked 2026-08-23) | APP | Retired; service_role only. Live; hardcoded service_role JWT (#38) |
| `increment_daily_usage(uuid,date)` | **yes** | `public` | **yes** | APP | Trusts `p_user_id` (#4) |
| `get_top_content(text,int)` | **yes** | not set | **yes** | APP | Read-only aggregate; SECURITY DEFINER without pinned search_path |
| `upsert_user_progress_resume(...)` | no | not set | **yes** | APP | INVOKER, so RLS applies. No issue |
| `audit_audio_sync()` | no | `public` | **yes** | APP | Read-only report over `verses`/`verse_content`/`audio_cache`/`books`. Leaks content inventory only |
| `get_table_columns(text)` | no | not set | **yes** | SHARED | Returns column names for an arbitrary table — minor schema-disclosure surface |
| `fn_normalize_text(text)` | no | not set | **yes** | UNKNOWN | Pure text helper |
| `update_updated_at_column()` | **yes** | `public` | **yes** | SHARED | Trigger function for `audio_cache` + `verse_content` |

Two SECURITY DEFINER functions lack a pinned `search_path`: `get_top_content`.
(`increment_daily_usage` and `update_updated_at_column` are pinned.)

### Triggers (complete, [LIVE])

Only two, both benign: `update_audio_cache_updated_at` on `audio_cache` and
`update_verse_content_updated_at` on `verse_content`, both running
`update_updated_at_column()`.

### `INTERNAL_FUNCTION_SECRET` — consumer search result

**No consumer found.** Searched [LIVE]: every function body in every non-system
schema (`pg_get_functiondef ILIKE '%INTERNAL_FUNCTION_SECRET%'` → 0 rows), all
non-internal triggers (2, both `updated_at`), and [REPO] all ten Edge Function
sources. Nothing reads it. The database functions embed the service-role JWT as
a literal instead (#38). **Status: NOT CONFIRMED as a live dependency** — it
appears vestigial. Not deleted or rotated, per instruction.

### Production database inventory — VERIFIED [LIVE] 2026-08-23

16 tables, 5 views, 11 functions. RLS is **enabled on all 16 tables**; the five
views have security-definer semantics (#40). Table-level GRANTs are wide open to
`anon`/`authenticated` on every table (the Supabase default) — RLS is the only
effective control, so a table with RLS enabled and **zero policies is
default-deny**, which is the correct posture.

| Table | Subsystem | RLS | Policies | Live rows | Activity (ins/upd) | Last analyzed |
|---|---|---|---|---|---|---|
| `books` | APP | on | 1 | 4 | 4 / 3 | never |
| `verses` | APP | on | 3 | 886 | 893 / 1,723 | 2026-04-09 |
| `verse_content` | APP | on | 2 | 1,772 | 1,796 / 16,878 | 2026-04-29 |
| `verse_audio` | APP | on | 1 | 3,544 | 5,335 / 76,975 | 2026-04-09 |
| `audio_cache` | APP | on | 2 | 5,468 | 6,035 / 2,846 | 2026-04-09 |
| `user_progress` | APP | on | 3 | 29 | 32 / 1,674 | 2026-06-09 |
| `user_daily_usage` | APP | on | 3 | 70 | 74 / 896 | 2026-06-11 |
| `user_bookmarks` | APP | on | 1 | 5 | 5 / 0 | never |
| `activity_log` | APP | on | 2 | 2,969 | 2,969 / 3 | 2026-04-21 |
| `profiles` | APP | on | 1 | 10 | 10 / 8 | never |
| `content_master` | CONTENT_PRODUCTION | on | **0** | 1,772 | 1,980 / 14,828 | 2026-04-29 |
| `audio_segments` | CONTENT_PRODUCTION | on | **0** | 7 | 14 / 41 | never |
| `yt_insta_image_metadata` | MEDIA_AUDIT | on | **0** | 100 | 130 / 778 | **2026-08-20** |
| `yt_insta_output_audit` | MEDIA_AUDIT | on | **0** | 4 | 6 / 0 | never |
| `yt_insta_video_metadata` | MEDIA_AUDIT | on | **0** | **0** | 0 / 0 | never |
| `mangalam_characters` | **UNKNOWN** | on | **0** | 11 | 11 / 0 | never |

Views (all APP content, all security-definer semantics): `canonical_audio`,
`canonical_gita_audio`, `canonical_mahabharat_audio`, `canonical_ramayan_audio`,
`verse_content_full`.

Observations from this inventory:

- **CONTENT_PRODUCTION and MEDIA_AUDIT are correctly locked down.** RLS on, zero
  policies → default-deny for anon and authenticated. `service_role` bypasses
  RLS, which is how the pipelines write. This matches the earlier empirical
  probes.
- **`content_master` holds exactly 1,772 live rows — the same count as
  `verse_content`.** Consistent with it mirroring the app catalogue, which is
  the intended future canonical source (§2). Not verified beyond row count.
- **`yt_insta_image_metadata` was last analyzed 2026-08-20 — three days before
  this investigation.** Strongest available evidence that MEDIA_AUDIT is a
  currently-active pipeline.
- **`yt_insta_video_metadata` has never had a row** (0 inserts). Created but
  unused. Not a deletion recommendation — see §2.
- **`mangalam_characters`** — columns `canonical_name`, `aliases`,
  `folder_name`, `spoken_english`, `notes`; 11 rows, seeded once, never updated.
  Referenced by no Edge Function and no database function. Its `spoken_english`
  and `folder_name` columns resemble the pronunciation atlas in
  `generate-tts/index.ts` and a media folder convention, suggesting SHARED
  between TTS and media production — but that is **[ASSUMED]**, not evidence.
  Classified **UNKNOWN**. Evidence needed: whoever authored the media pipeline.


### Accepted risks and forward-looking rules (2026-08-23)

Recorded so the reasoning survives, and so future work does not silently
reintroduce what was closed.

**#39 — `anon` can execute `net.http_post` / `http_get` / `http_delete`.**
CANNOT FIX with any customer-level access: schema `net` and its functions are
owned by `supabase_admin`, and `postgres` is not a member — verified, and a
`REVOKE` attempt returns *"no privileges could be revoked"*. The Supabase
dashboard SQL editor also runs as `postgres`, so this is not fixable there
either. Residual risk is **latent, not live**: `net` is not a PostgREST-exposed
schema, and since #23 no anon-executable function reaches it.

> **Forward-looking rule:** any new function in an exposed schema that calls
> `net.http_*` must be `SECURITY DEFINER`, owned by `postgres`, with a pinned
> `search_path`, and must have EXECUTE revoked from `PUBLIC`, `anon` and
> `authenticated`. A `SECURITY INVOKER` function that calls `net.http_*` and is
> executable by `anon` is an immediate SSRF vector — that is exactly what the
> TTS RPCs were.

Note: `extensions.grant_pg_net_access` re-grants schema USAGE on pg_net DDL
events, but its `GRANT EXECUTE` block is version-gated to pg_net ≤ 0.11.0 and
this project runs 0.19.5 — so it does not currently re-grant function EXECUTE.

**#40 — five views run with security-definer semantics.** Deliberately not
changed. All five (`canonical_audio`, `canonical_gita_audio`,
`canonical_ramayan_audio`, `canonical_mahabharat_audio`, `verse_content_full`)
expose only content that `anon` can already read directly, so there is no
current information gain. The four `canonical_*` views additionally read
`storage.objects`, whose SELECT policy is scoped to `bucket_id =
'audio-content'` — so setting `security_invoker = true` would change what the
views return rather than being behaviour-neutral. No repository code queries
them (only generated type declarations reference them); they appear to be
operator/reporting views. Changing live view semantics for zero security gain
was judged the wrong trade.

> **Forward-looking rule:** any new view over a **user-data** table
> (`user_progress`, `user_bookmarks`, `user_daily_usage`, `activity_log`,
> `profiles`) must set `security_invoker = true`, or it will bypass that
> table's RLS and leak across users.

**#15 — local and remote migration histories are disjoint.** Deliberately not
reconciled. Marking the 9 historical local migrations as applied would let
`db push` run cleanly, but it would also assert a consistency that does not
exist: the 32 remote-only migrations still have no local representation, so the
repository still could not rebuild production. That would trade a visible
problem for a hidden one. Resolving this properly is an explicit decision —
most likely a baseline schema dump committed as a single migration, with the
history table repaired to match — and it is an architecture task, not a security
fix.

### Storage buckets — VERIFIED [LIVE] 2026-08-23

Subsystem classification per the founder's architecture record (§2), corrected
2026-08-23. Earlier entries in this document guessed some of these from bucket
names and were **wrong** — see the corrections below the table.

| Bucket | Public | Objects | Subsystem | Purpose |
|---|---|---|---|---|
| `audio-content` | yes | 3,544 | **APP** | Verse narration the app streams |
| `background-audio` | yes | 9 | **SHARED** | Music beds for content generation **and** the app's ambient bed |
| `spotify-uploads` | yes | 32 | **CONTENT_PRODUCTION** | Generated audio/video prepared for Spotify |
| `ArtWorks` | no | 7 | **CONTENT_PRODUCTION** | Reusable artwork across Mangalam channels |
| `YTInstaContent` | no | 111 | **MEDIA_AUDIT** | Visuals/audio/video for YouTube + Instagram short-form |
| `Spotify Podcast` | no | 10 | **LEGACY** | Older files from a different TTS provider |
| `Intro Static` | no | 10 | **LEGACY / believed unused** | Reusable intro audio ("Jai Shri Ram" / "Jai Shri Krishna") |

**Corrections to earlier entries in this document:**

- `background-audio` was recorded as APP "ambient beds". It is **SHARED** — the
  founder uses it for content generation, and `backgroundAudioUtils.ts:30`
  proves the app also streams from it.
- `ArtWorks` was recorded as MEDIA_AUDIT. It is **CONTENT_PRODUCTION**.
- `Spotify Podcast` and `Intro Static` were recorded as CONTENT_PRODUCTION. Both
  are **LEGACY**; `Intro Static` is believed unused but **must not be deleted on
  that basis alone**.
- `YTInstaContent` was recorded as "CONTENT_PRODUCTION / MEDIA_AUDIT". It is
  **MEDIA_AUDIT / social production**.

**Repository references are not a usage signal here.** Only two buckets are
named anywhere in tracked code — `audio-content` and `background-audio`. The
other five appear in no source file, yet `YTInstaContent` holds 111 objects and
`yt_insta_image_metadata` was written three days before this investigation.
Production pipelines drive them externally.

**`verse-audio` is referenced but does not exist.** `generate-tts/index.ts`
selects a `verse-audio` bucket for non-Gita books, and `queries.ts` falls back to
it — but no such bucket exists in production. Every `verse_audio` row resolves to
`audio-content`. Recorded as an observation; **not** fixed, out of scope.

**Two different read controls apply, and they are easy to conflate:**

- `buckets.public = true` governs the **public object endpoint**
  (`/storage/v1/object/public/<bucket>/<path>`). It bypasses RLS, which is why
  the app streams `background-audio` even though anon cannot enumerate it.
- The `Public Read Access` RLS policy governs **enumeration** through
  `storage.objects`. Verified [LIVE]: `anon` can list objects in
  `audio-content` (3,544) and **no other bucket**.

Consequence worth noting, not a finding to action now: objects in the three
public buckets are fetchable by anyone who knows or guesses a path, including
`spotify-uploads`. That is inherent to public buckets and is the intended
distribution mechanism for free content. No bucket sets `file_size_limit`.

**Write access after the #42 fix**, verified [LIVE] in rolled-back transactions:
`anon` INSERT is denied on `audio-content`, `background-audio`, `spotify-uploads`
and `Intro Static` — every bucket tested. `storage.objects` carries exactly one
policy (`Public Read Access`); `storage.buckets` carries none.

### Undocumented production state (schema drift) — verified

`src/lib/database.types.ts` in the repository is **stale in both directions**
[LIVE]:

- **Missing from the repo types** (exist in production): `content_master`,
  `audio_segments`, `mangalam_characters`, `yt_insta_image_metadata`,
  `yt_insta_video_metadata`, `yt_insta_output_audit`, and the functions
  `fn_normalize_text`, `get_table_columns`.
- **Present in the repo types but dropped from production**: `staging_ramayan`,
  `staging_mahabharat`. This confirms the earlier `PGRST205` inference.

### Migrations

**VERIFIED [LIVE] 2026-08-23 via `supabase migration list --linked`: the local
and remote migration histories are COMPLETELY DISJOINT — zero overlap.**

- 32 versions are recorded in the remote `supabase_migrations.schema_migrations`
  table and exist in no local file.
- **All 9 tracked local migrations show `remote = ""`** — none of them is
  recorded remotely, even though the objects they create (e.g. `profiles`,
  `audio_cache`, `increment_daily_usage`) demonstrably exist in production.

The most likely explanation is that the tracked migrations were applied through
the dashboard SQL editor rather than `db push`, so they never entered the
migration history table. This is consistent with the "dashboard edits bypass
version control" gap recorded in `DISCOVERY.md`. **[ASSUMED]** — not proven.

Consequence: `supabase db push` refuses to run until the histories are
reconciled, which is why the two migrations below remain unapplied. Reconciling
is a deliberate operation (`migration repair` / `db pull`) and is explicitly out
of scope for this remediation.

Remote migrations can be **listed** but not **read** — `supabase migration list`
returns versions only, and fetching their SQL bodies requires either the
dashboard or `db pull` (which needs Docker, not installed here).

**Written locally but NOT applied** (both created 2026-08-23):

| File | Purpose | Blocker |
|---|---|---|
| `20260823090000_revoke_tts_rpc_execute.sql` | Restricts the four `generate_*_tts` signatures to `service_role` | No DB access; #23 grant unverified |
| `20260823090100_harden_increment_daily_usage.sql` | Derives identity from `auth.uid()`, preserves signature and `search_path` | No DB access |

Neither has been validated against production. Signatures in the first were
derived from PostgREST coercion [LIVE] and should be re-checked before applying.

---

## 8. Credential Inventory

Logical names only. **No values, hashes, or fragments are recorded here.**

| Credential | Used by | Allowed to live in | Exposed historically | Rotated | Revoked/deleted | Notes |
|---|---|---|---|---|---|---|
| Gemini API key | `import-content`, operator scripts | Edge Function secrets; local `.env.local` | **Yes** — public git history **and** public `HEAD` | **No** | **No** | The historical, hardcoded, and current local values are **the same key**. Reports API-key-not-valid [LIVE], but must still be explicitly deleted at the provider. Literal removed from source 2026-08-23. |
| Google TTS API key | `generate-tts`, `generate-tts-new`, `smooth-endpoint`, `retry_ramayan_audio.ts` | Edge Function secrets; local `.env.local` | **Yes** — public git history | Yes (value differs from the leaked one) | Old key: **No** | Current key reports expired [LIVE]. Old leaked key still needs deleting. |
| RapidAPI key | `import-content` | Edge Function secrets; local `.env.local` | **Yes** — public git history | **No** — unchanged since the leak | **No** | Liveness untested. Rotation required. |
| Supabase service-role key | both protected functions; other 8 functions | Edge Function environment only | No | No | No | Never in `src/`, never in tracked source. |
| `INTERNAL_FUNCTION_SECRET` | **no function reads it** [LIVE] | — | No | No | No | Holds the **same value as the service-role key**. Consumer unknown; likely the untracked DB functions via `pg_net` (#35). |
| `ADMIN_API_SECRET` | `generate-tts`, `import-content`, 4 operator scripts | Edge Function secrets; local `.env.local` | No | n/a (new 2026-08-23) | n/a | Introduced by this remediation. |
| Supabase anon key | mobile bundle | `EXPO_PUBLIC_*`, client bundle | Yes — **public by design** | No | No | Not a secret. Valid until 2036-02-29 (#36). Rotating it means rotating the project JWT secret, invalidating every session. |
| Supabase DB password | operator tooling | local only | **No** | — | — | The committed `pooler-url` holds a literal placeholder. Confirmed FALSE POSITIVE. |
| Sentry DSN | `App.tsx` | `EXPO_PUBLIC_*` | Public by design | — | — | Presence in production builds **unverified** (#27). |

**Consequence of the correction in §3:** the earlier belief that these keys had
already been rotated was wrong. The Gemini key in particular is one key across
all three locations, and no leaked credential has yet been deleted at its
provider.

---

## 9. Open Issues / Deferred Work

| Issue | Why it remains open | Risk | Blocker | Next action |
|---|---|---|---|---|
| **External callers now blocked (new)** | All ten functions require `x-admin-secret`; callers outside this repo were never inventoried | **CONTENT_PRODUCTION (YouTube/Spotify/Instagram) and APP audio generation may be broken until their callers send the header.** Availability risk, not a security hole | Requires the founder to identify external callers (n8n, cron, dashboards, manual scripts) | Supply `ADMIN_API_SECRET` to each legitimate caller from `.env.local` |
| **`smooth-endpoint` subsystem unknown** | Takes free text, touches no content table, has no in-repo caller | Cannot be classified APP / CONTENT_PRODUCTION / MEDIA_AUDIT from code alone | Needs founder knowledge or invocation logs | Classify before considering removal — **do not delete** |
| **`Intro Static` / `Spotify Podcast` classification** | Recorded as LEGACY; `Intro Static` believed unused | None — both deny anonymous access and hold no user data | Needs positive evidence of non-use before any retirement | Verify against external pipelines before deleting; do **not** delete on belief alone |
| **MEDIA_AUDIT writers unidentified** | Three tables enumerated and confirmed RLS-protected (§7), but nothing in the Edge Function layer writes them | Low — no anon exposure found. The gap is knowledge, not access | Needs founder knowledge of what drives the media/audit pipeline | Identify the writer; confirm the enumeration is complete (it was name-guided) |
| **#38 service_role JWT in function bodies** | Confirmed; no fix attempted | Plaintext service-role credential stored in the DB; blocks service-role rotation | Depends on #23 fix shape | Move to Vault or a DB setting when rewriting those functions |
| **service-role key rotation** | Literal removed from function bodies (#38), but the key value itself is unchanged | The leaked value stays valid until rotated | Supabase dashboard access | Rotate in Settings → API; then update Edge Function secrets and redeploy |
| **#4 `increment_daily_usage`** | Migration unapplied | Cross-user writes to usage/streak data | Same as above | Apply `20260823090100` |
| **#1/#2 credentials not revoked** | Requires provider consoles | Keys currently report invalid/expired, but are not confirmed deleted | Google Cloud + RapidAPI access | Audit usage logs, then delete |
| **#34 undocumented audio pipeline** | Purpose unknown | Cannot safely gate or remove what is not understood | Needs DB inspection of `content_master`/`audio_segments` | Determine whether the pipeline is live |
| **#35 `INTERNAL_FUNCTION_SECRET`** | Consumer unidentified | Service-role-equivalent secret with unknown holder | DB access | Find what reads it |
| **#15 schema drift** | 32 migrations + tables + functions unaccounted for | No staging, no review, no DR | Requires a schema dump | Baseline migration from production |
| **#27 Sentry** | Unverified | May be blind to all production errors, including #6 crashes | EAS login | `eas env:list`; confirm events arriving |
| **App findings #6–#14, #16–#22, #24–#26, #29–#31** | Deliberately deferred | User-facing bugs; #25 means the streak number is wrong for every user | Security work takes precedence (§10) | Resume after security remediation |

---

## 10. Decision Log

**Why `ADMIN_API_SECRET` was introduced (2026-08-23).** The functions needed an
authorization signal the mobile app can never possess. Anything derived from the
anon key fails by definition, since that key is public. A shared secret known
only to the function environment and the operator is the smallest mechanism that
satisfies this. A `user_roles` table plus JWT custom claims would be the fuller
answer, but is disproportionate for two operator-only functions and would
conflict with CLAUDE.md's extend-don't-build-new principle.

**Why `INTERNAL_FUNCTION_SECRET` was not reused, despite already existing.** Its
value is identical to the service-role key. Using it as a header secret would
transmit a service-role credential in request headers across every operator
call, and would couple admin authorization to the most privileged credential in
the system. A separate, purpose-scoped secret is safer and independently
rotatable.

**Why the anon JWT is not treated as authorization.** See §5. It is public by
design, ships in the app bundle, and was published in this repository.

**Why `smooth-endpoint` is being protected before deciding whether to delete it.**
Deletion is irreversible without the source and requires confidence that no
external tool calls it — confidence we do not have, since the repo has no record
of it. Gating is reversible, takes effect immediately, and removes the live
billing exposure while the usage question is answered. Protect first, decide
second.

**Why the unknown audio pipeline is not being deleted.** Five functions read and
write `content_master` and `audio_segments`, which exist in production. Deleting
functions whose data dependencies are live, and whose callers are unknown, risks
destroying a working pipeline. The repository is not a reliable guide here — it
already failed to record eight functions, two tables, and 32 migrations.

**Why git history is not being rewritten yet.** Rewriting cannot un-publish
anything: the repository was public for months, and forks or archives may exist.
Security depends on revoking the credentials at their providers, not on
scrubbing history. Once revoked, the strings in history are inert. When a
rewrite does happen it should be a single pass also removing the ~380 MB of
binaries (#14), sequenced **after** rotation, never before.

**Why the repository being public reprioritised everything.** It converted
"credentials leaked to anyone with clone access" into "credentials published on
the open internet for 4.7 months", and made the backend's structure public
knowledge. Every authorization finding became more urgent as a result.

**Why streak and app fixes are deferred.** Findings #6–#14 and #24–#31 are real
and some are user-visible (#25 in particular means the streak number is wrong for
every user). They are deferred because none of them can be exploited by a third
party, whereas the open Edge Functions can be used to spend money and rewrite the
published catalogue. Finishing security first also avoids editing the same files
twice.

**Why #9/#25 are blocked on a product decision, not engineering.** Choosing
whether a "day" is device-local or fixed IST, and whether a streak breaks on one
missed day, changes the data model of the habit loop. That is the founder's call.
Three options were proposed; none has been chosen.

**Why `verify_jwt` is retained despite being insufficient.** It costs nothing and
rejects credential-less traffic at the gateway before it reaches function code.
It is defence in depth beneath the header check, not the primary control.

---

**Why all eight functions were protected rather than deleted (2026-08-23).**
Every one performed privileged or paid work with no authorization. Gating is
reversible, immediate, and preserves behaviour; deletion is irreversible and
would have destroyed production capability. Five of the eight serve the
CONTENT_PRODUCTION pipeline that generates YouTube, Spotify and Instagram media
— an active system. Protect first, classify second, delete only with evidence.

**Why `smooth-endpoint` was gated rather than removed.** It was the single
highest live exposure — an unauthenticated Google TTS proxy accepting arbitrary
text — so waiting for a removal decision would have meant leaving it open.
Gating removed the exposure immediately at zero risk to any caller that turns
out to be legitimate. Its subsystem is still unknown: it touches no content
table, so code alone cannot classify it. **It is no longer a removal candidate
on current evidence** — the earlier "deployed but unused" classification was
based on repository references only, which §2 establishes is not sufficient.

**Why the unknown production pipeline was preserved.** `content_master` and
`audio_segments` are live CONTENT_PRODUCTION tables. Their absence from
`supabase/migrations/` and `database.types.ts` is a documentation gap, not
evidence of disuse. Deleting functions whose data dependencies are live and
whose callers are unknown would break media production for three channels.

**Why the existing `ADMIN_API_SECRET` mechanism was reused rather than extended.**
A second mechanism would mean two definitions of "who may spend money", which
CLAUDE.md §2 forbids and which drifts over time. `_shared/adminAuth.ts` already
fails closed and compares in constant time; the eight functions needed the same
rule, not a different one. Reuse also means one secret to rotate.

**Why the future `content_master` consolidation stays out of scope.** Making
`content_master` the canonical content source is an architecture project, not a
cleanup task: it requires a canonical identity/key structure, book/chapter/verse
mapping, language representation, audio mapping for `verse_audio` and
`audio_cache`, user-progress and bookmark re-referencing, cross-channel
references, old→new ID mapping, a backfill strategy, and a safe deprecation plan
for the legacy tables. Attempting any part of it during security remediation
would mix irreversible data changes into a workstream whose whole purpose is
containment. Security work must leave the content model exactly as it found it.

**Why classification uses table dependencies rather than repository references.**
The earlier pass classified functions by whether `src/` referenced them, which
produced the wrong answer twice (§6). Table and bucket dependencies are
observable from the code itself and map directly onto the subsystem boundaries
in §2, so they are the evidence used now. Repository visibility is not evidence
of anything.

**Evidence standard for retiring production objects (recorded 2026-08-23).**
The repository is one source of evidence, not the whole system. Supabase tables,
storage buckets, Edge Functions, external pipelines, manually operated workflows
and historical assets all exist outside tracked code — demonstrated repeatedly in
this remediation: eight Edge Functions, six tables, five storage buckets and 32
migrations were all found in production with no repository trace, and several are
actively used. **Absence of a repository reference is therefore not evidence of
non-use.** Before retiring or deleting any production object, establish positive
evidence of non-use (activity statistics, recency, absence of callers across
*all* layers) and record the residual uncertainty.

The converse also holds, and it is why #42 was fixed the same day it was found:
uncertainty about who *might* use something must not block closing a clearly
exploitable hole. The distinction is that #42 removed an anonymous **write**
capability that no legitimate caller could need, whereas retiring a bucket or
dropping a function destroys capability that something unseen may depend on.
Where both apply — as with the TTS RPCs — revoke access but preserve the object.

**Why the storage write policies were dropped rather than narrowed (2026-08-23).**
The obvious alternative was to re-scope them to `authenticated`. That would have
been new mechanism serving no consumer: the app never writes to storage, and the
only legitimate writer is `service_role`, which bypasses RLS and was therefore
never governed by these policies at all. Dropping restores the intended posture —
public read, service-role write — with the smallest possible change and no new
surface.

**Why #28 was reclassified rather than "fixed".** Three buckets being public is
deliberate: `getPublicUrl` is how the app streams audio, and free distribution is
the product model. The original finding framed public buckets as the risk; the
production evidence showed the actual risk was anonymous *write* access, which is
a different problem with a different fix. The finding is recorded as resolved
with that correction rather than silently rewritten.

**Why retirement was chosen over repair (2026-08-23).**

> We chose retirement over repair because the SQL-driven TTS pipeline shows no
> evidence of active use, while repairing it would introduce a new
> secret-management path into database code for a dormant pipeline.

Repair would have meant provisioning Supabase Vault, teaching three database
functions to read a secret at call time, and accepting a second place where
admin authorization is defined — all to keep alive a path that has produced no
`verse_audio` row since 2026-04-09 and that the Edge Function chain
(`geenerate-audio-edge` → `generate-tts-new`) already duplicates with proper
authorization. Revoking EXECUTE achieves the security goal with one migration
and no new machinery.

**Why the functions were revoked rather than dropped.** The retirement rests on
absence of evidence, not proof of disuse — function call statistics are off and
Edge Function logs are unavailable. Dropping would be irreversible and would
discard code that documents how APP audio was historically generated, which is
likely to matter when the APP audio architecture is consolidated toward
`content_master` (§2). Revoking is reversible in one statement and leaves
`service_role` able to run them, so a legitimate operator workflow can be
restored without recreating anything.

**Why Vault was not introduced for #38.** Adding Vault now would create a
secret-management dependency in database code purely to serve retired functions.
The correct fix for #38 is to remove the embedded literal when those bodies are
next touched, and to rotate the service-role key — not to build infrastructure
around a credential that should not be there.

**Why the read-only investigation used the CLI's ephemeral login role.**
`supabase db dump --dry-run` prints the connection parameters for a temporary
`cli_login_postgres` role that the CLI provisions on demand. Using it for
`SELECT`-only catalog queries was the least-privilege way to answer the ACL
question without a service-role key or the project database password. Every
session set `default_transaction_read_only = on`, and the TTS functions were
never executed. The credential is ephemeral and expired mid-investigation
(it was refreshed once); it is not a stored secret and is not recorded here.

**Why #23's fix must revoke from PUBLIC, not just anon and authenticated.**
The observed ACL is `=X/postgres`, the PostgreSQL default grant to PUBLIC.
Revoking only the two named roles would leave the PUBLIC grant in place and
change nothing, because both roles inherit it.

**Why OPTIONS preflight handling was left in place.** Removing it would change
observable behaviour for any browser-based caller, and the preflight performs no
privileged work — it returns a static string. The guard sits immediately after
it, so nothing privileged executes without authorization.

---

## 11. Rollback / Recovery Notes

**`generate-tts` / `import-content` authorization.**
Redeploy the previous version from the Supabase dashboard (Functions → version
history), or revert commit `1841d76` and redeploy with
`supabase functions deploy <name> --use-api`. Note that reverting restores the
unauthenticated state — an emergency measure only.
*Symptom of misconfiguration:* every call returns `500 Server misconfigured`,
meaning `ADMIN_API_SECRET` is unset in the function environment. Fix by setting
the secret; do not disable the check.
*Symptom of a stale caller:* `403 Forbidden` — the caller is not sending
`x-admin-secret`.

**`verify_jwt`.** Controlled by `supabase/config.toml`. Setting a value to
`false` and redeploying reverts it. A plain redeploy does **not** reset the flag
on its own — the config entry is what changes it.

**`ADMIN_API_SECRET` rotation.** `supabase secrets set ADMIN_API_SECRET=<new>`,
update `.env.local`, then redeploy both functions. Operator scripts pick the new
value up from the environment with no code change. Brief window where in-flight
operator calls fail with 403; no user-facing impact, since the app never calls
these functions.

**Operator scripts.** Pure additions of a header plus a fail-fast guard; revert
the file to restore prior behaviour. They will then receive 403 from the
protected functions.

**`preview_english_verse_robust.py`.** Reverting restores a hardcoded key that
must never return to source. If the script fails with "GEMINI_API_KEY is not
set", export the variable — do not re-add the literal.

**Unapplied migrations.** Not deployed, so nothing to roll back. If applied
later: `20260823090000` is reversed by re-granting EXECUTE to the affected
roles; `20260823090100` is reversed by restoring the previous body from
`20260302_usage_rpc.sql` (and re-applying `SET search_path = public`).

**The eight newly protected functions.** Each was a single-file change plus a
config entry. To revert one: remove its `requireAdmin` import and guard, then
`supabase functions deploy <name> --use-api`. Reverting restores the
unauthenticated state and should only be an emergency measure.
*Symptom of a blocked legitimate caller:* `403 Forbidden` — supply
`x-admin-secret`. *Symptom of a missing secret in the function environment:*
`500 Server misconfigured` — set `ADMIN_API_SECRET`; do not remove the check.
*Chain symptom:* if `geenerate-audio-edge` or `batch-generate-audio` reports its
callee returning 403, `ADMIN_API_SECRET` is missing from the **caller's**
environment.

**Pre-change source of record.** The eight functions' original, unmodified
source is recoverable at any time with
`supabase functions download <name>` against a prior deployed version, and the
committed versions in `supabase/functions/` differ from production only by the
authorization import, the guard, and (for two) the forwarded header.

**Local project link.** `supabase link` modified tracked files under
`supabase/.temp/` and created untracked ones. Safe to revert with
`git checkout -- supabase/.temp/`; it is local CLI cache state only.

---

## 12. Change Log

```
2026-08-22 — Initial security audit of the mobile app — routine code review — 22 findings raised
2026-08-22 — Second-pass validation — findings needed verification before fixing — 6 findings corrected or withdrawn; findings #23–#31 added
2026-08-22 — Discovered the repository is public — gh repo view — reprioritised all credential and authorization findings
2026-08-23 — Live read-only production verification — evidence required before changing anything — confirmed #3 and #23; confirmed RLS is sound; disproved the assumed credential rotation
2026-08-23 — Added _shared/adminAuth.ts — both functions needed one authorization rule — shared fail-closed helper created
2026-08-23 — generate-tts: requireAdmin added, wildcard CORS removed — anon JWT alone could reach it; verify_jwt was disabled — deployed v37
2026-08-23 — import-content: requireAdmin added — anon JWT alone could reach it and rewrite the catalogue — deployed v56
2026-08-23 — supabase/config.toml created — a plain redeploy did not re-enable verify_jwt — verify_jwt=true pinned for both functions
2026-08-23 — ADMIN_API_SECRET generated and set — required by the new check — registered as a function secret; stored in gitignored .env.local
2026-08-23 — Hardcoded Gemini key removed from preview_english_verse_robust.py — key was in public HEAD — replaced with env var; key still not revoked
2026-08-23 — Committed to branch security/edge-function-authorization (1841d76) — PR could not be opened: the gh account holds READ only
2026-08-23 — Four operator scripts updated to send x-admin-secret — legitimate callers would otherwise get 403 — validated; not yet committed
2026-08-23 — Downloaded and reviewed all 8 undocumented Edge Functions — verify_jwt alone could not be trusted — none has authorization; findings #32–#35 raised
2026-08-23 — This document created — remediation needed a durable trail — sections 1–11 populated from work to date
2026-08-23 — Recovered source of all 8 undocumented Edge Functions into the repo — they existed only in production — finding #32 closed
2026-08-23 — Applied requireAdmin to all 8 — every one did privileged/paid work with no authorization — deployed: smooth-endpoint v23, generate-audio-segments v29, generate-audio-segment v13, edit-audio-segment v6, dynamic-responder v16, generate-tts-new v42, batch-generate-audio v5, geenerate-audio-edge v18
2026-08-23 — Forwarded x-admin-secret across both internal chains — callee now requires it — pipelines unchanged functionally
2026-08-23 — config.toml: verify_jwt pinned for all 10, entrypoint pinned for dynamic-responder — version-controlled rather than per-deploy
2026-08-23 — Validated all 10 functions: 401 no-auth / 403 anon-only / 403 wrong-secret — no paid generation performed
2026-08-23 — Recorded architecture context from founder (§2) — earlier "obsolete/unused" classifications were wrong — content_master is an ACTIVE production system; smooth-endpoint removal recommendation withdrawn
2026-08-23 — Re-validated all 10 functions post-deploy — confirm state held — 401/403/403 across the board, unchanged
2026-08-23 — Classified all 10 functions by table/bucket dependency — repository visibility is not evidence — generate-audio-segment reclassified CONTENT_PRODUCTION -> SHARED (reads books); smooth-endpoint confirmed UNKNOWN (no table deps)
2026-08-23 — Enumerated MEDIA_AUDIT tables via PostgREST 404 hints — subsystem was never inventoried — found yt_insta_image_metadata, yt_insta_video_metadata, yt_insta_output_audit; all RLS-protected against anon read and write
2026-08-23 — Verified CONTENT_PRODUCTION + MEDIA_AUDIT tables reject anon read and write — needed to size non-APP exposure — no PostgREST exposure found
2026-08-23 — Noted latent bug: generate-audio-segment selects books.name, a column that does not exist — found during classification — recorded, not fixed (out of scope)
2026-08-23 — Read-only production catalog investigation via ephemeral cli_login role — needed real ACLs, not inference — see below
2026-08-23 — #23 CONFIRMED: anon+authenticated+PUBLIC hold EXECUTE on all 4 TTS RPC signatures — pg_proc ACL read directly — revoke must include PUBLIC
2026-08-23 — Read TTS RPC bodies: they use net.http_post -> generate-tts-new — generate_all_tts is inert (placeholder URL/token); the other three carry a hardcoded service_role JWT (#38)
2026-08-23 — Confirmed anon has USAGE on schema net + EXECUTE on net.http_post (#39), but net is NOT exposed via PostgREST — no general SSRF primitive
2026-08-23 — INTERNAL_FUNCTION_SECRET: no consumer found in any DB function, trigger, or Edge Function — reclassified NOT CONFIRMED as a dependency
2026-08-23 — NEW #37: activity_log SELECT policy is USING(true) for authenticated — any signed-in user can read all users' activity history
2026-08-23 — NEW #40: all 5 views run with security-definer semantics — currently benign, latent risk
2026-08-23 — NEW #41: the TTS RPCs are now broken by the Edge Function hardening — they send no x-admin-secret
2026-08-23 — Verified full production inventory: 16 tables, 5 views, 11 functions; RLS on all tables; CONTENT_PRODUCTION + MEDIA_AUDIT default-deny (0 policies)
2026-08-23 — Migration drift verified: local and remote histories are COMPLETELY DISJOINT (9 local, none recorded remotely; 32 remote, none local)
2026-08-23 — Discovered undocumented table mangalam_characters and functions fn_normalize_text, get_table_columns; confirmed staging_* were dropped
2026-08-23 — Activity evidence: yt_insta_image_metadata last analyzed 2026-08-20 (MEDIA_AUDIT active); yt_insta_video_metadata never used; content_master 1,772 rows = verse_content 1,772
2026-08-23 — Edge Function invocation logs UNAVAILABLE via CLI — external-caller question remains UNKNOWN, not guessed
2026-08-23 — #37 RESOLVED: activity_log SELECT policy now user_id = (SELECT auth.uid()) — any signed-in user could read all 2,969 rows — applied to production; owner sees 2,815 own rows, other users and anon see 0
2026-08-23 — #4 RESOLVED: increment_daily_usage now enforces p_user_id = auth.uid() — SECURITY DEFINER bypassed RLS with a caller-supplied id — applied; denials validated, success path rolled back with nothing persisted
2026-08-23 — Migration 20260823140000 applied via SET ROLE postgres, not db push — histories are disjoint — production state matches the file; migration history table does not record it
2026-08-23 — Removed superseded draft 20260823090100 — the new migration supersedes it — avoids two migrations redefining one function
2026-08-23 — #41 evidence: no repo caller, no trigger, no pg_cron, empty pg_net queue, track_functions=none, verse_audio unchanged since 2026-04-09, 0 failed/processing rows — SQL TTS pipeline appears dormant; recommend retiring, decision deferred
2026-08-23 — #23 deliberately NOT revoked — revoking before the #41 decision would foreclose repairing the SQL chain — grants remain PUBLIC/anon/authenticated
2026-08-23 — DECISION: retire the SQL-driven TTS pipeline rather than repair it — no evidence of active use; repair would add a secret-management path to DB code for a dormant pipeline
2026-08-23 — #23 RESOLVED: EXECUTE revoked from PUBLIC, anon, authenticated on all 4 generate_*_tts signatures — migration 20260823150000 applied via SET ROLE postgres — anon/authenticated now get 42501; service_role retained; functions NOT dropped
2026-08-23 — #41 RESOLVED/RETIRED: SQL-driven TTS pipeline retired — evidence-based, not proof of disuse — functions preserved for the future APP audio consolidation
2026-08-23 — #38 remains OPEN — bodies deliberately unmodified — embedded service_role JWT no longer reachable via PUBLIC/anon/authenticated, but cleanup and key rotation are still outstanding
2026-08-23 — Removed superseded draft 20260823090000 — replaced by 20260823150000 with verified signatures and correct ordering
2026-08-23 — Verified no collateral impact: get_top_content still 200 for anon; books/verses/verse_content/verse_audio still readable; pg_net queue 0/0
2026-08-23 — Resolved the unverified #28 using DB access — found 7 buckets, 3 public by design — public read is intended; reclassified #28 as not-an-issue
2026-08-23 — NEW #42 (Critical): storage.objects had PUBLIC INSERT + UPDATE policies on audio-content — anyone with the anon key could upload to and overwrite all 3,544 narration files — verified exploitable in rolled-back transactions
2026-08-23 — #42 RESOLVED: dropped Public Write Access and Public Update Access; retained Public Read Access — migration 20260823160000 applied via SET ROLE postgres
2026-08-23 — #42 validated: anon INSERT now RLS-denied, anon UPDATE 3,544 -> 0 rows, anon SELECT unchanged at 3,544, service_role still updates 3,544; playback GET returns 206 audio/mpeg; upload POST returns 403 AccessDenied; object counts unchanged
2026-08-23 — Recorded the founder's storage architecture (§2) — bucket subsystems had been guessed from names — corrected ArtWorks (MEDIA_AUDIT -> CONTENT_PRODUCTION), Spotify Podcast + Intro Static (CONTENT_PRODUCTION -> LEGACY), YTInstaContent (-> MEDIA_AUDIT)
2026-08-23 — background-audio reclassified APP -> SHARED — backgroundAudioUtils.ts:30 shows the app streams the ambient bed from it while the founder uses it for content generation — its public read must be preserved
2026-08-23 — Verified the #42 fix did not affect any read path: all 3 ambient beds and verse audio return 206 audio/mpeg; anon INSERT denied on every bucket tested; anon can enumerate only audio-content
2026-08-23 — Documented that buckets.public governs the public object endpoint (bypasses RLS) while the RLS policy governs enumeration — conflating them caused the original #28 misframing
2026-08-23 — Recorded the evidence standard for retiring production objects — repo absence is not evidence of non-use, but uncertainty must not block fixing exploitable holes
2026-08-23 — #38 RESOLVED: replaced the embedded service_role JWT with a placeholder in 3 retained TTS RPCs — credential was already non-functional (generate-tts-new requires x-admin-secret) — migration 20260823170000; 0 real JWTs remain in any function body; #23 revocation preserved
2026-08-23 — #39 ACCEPTED/CANNOT FIX: net schema and net.http_* are owned by supabase_admin, which postgres cannot assume — REVOKE returns "no privileges could be revoked" — recorded a forward-looking rule for any future function calling net.http_*
2026-08-23 — #40 ACCEPTED: views left with security-definer semantics — canonical_* read storage.objects, so security_invoker would change results for zero security gain — recorded a forward-looking rule for views over user-data tables
2026-08-23 — #15 deliberately NOT reconciled — repairing history would assert a consistency that does not exist while 32 remote migrations have no local form — recommended a baseline dump as an explicit architecture task
```
