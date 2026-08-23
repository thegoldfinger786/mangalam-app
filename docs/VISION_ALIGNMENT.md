# Mangalam — Vision vs. Implementation Alignment Map

**Purpose:** Overlay the stated business/product vision onto the codebase findings from [`DISCOVERY.md`](./DISCOVERY.md). This document does **not** propose changes. It classifies each vision element against what currently exists, and — per instruction — explicitly surfaces every place vision and implementation are in tension rather than silently resolving it in either direction.

Labels used:
- **ALIGNED** — implementation already matches vision intent
- **GAP** — vision calls for something that simply doesn't exist yet (no contradiction, just unbuilt)
- **CONFLICT** — vision and implementation point in different/incompatible directions right now
- **SCAFFOLDED** — a gap where the codebase already shows deliberate groundwork for the vision item

---

## 1. Explicit Conflicts (vision ↔ implementation tension)

### 1.1 Free-tier session cap vs. "monetisation is secondary, trust/reach first"

- **Vision states:** "The initial objective is: Trust, Reach, Audience, Content depth, Brand credibility. Monetisation is secondary during the early stages."
- **Implementation has:** A hard **"Daily Limit Reached" paywall** in `PlayScreen.tsx` — free users are told they've hit "3 sessions today" and are pushed to `SupportMangalam` (a donation link) before they can keep listening. This is a monetization/friction mechanism, not a discovery/trust mechanism.
- **The tension:** A daily usage cap on the core "daily companion" habit loop works directly against reach/habit-formation/trust-building in the exact phase the vision says should prioritize those things. A cap that interrupts a beginner's third listening session in one day is a meaningfully different product decision than "monetization is secondary."
- **Not resolving this either way** — noting only that: (a) this gating logic currently appears non-functional in the code (`isAllowed` is hardcoded `true`, per `DISCOVERY.md` §5.4), so in its *current* state the conflict is latent rather than active; (b) if/when that logic is restored, it will directly contradict the stated early-stage philosophy unless the cap or its threshold is a deliberate, revisited decision.

### 1.2 Fixed "office + home" practical examples vs. multi-domain personalization vision

- **Vision states:** Users should be able to ask "How does this apply to my *work*? my *relationships*? my *parenting*? my *leadership*?" — five distinct personas (young professionals, diaspora, parents, spiritual seekers, beginners) are named as primary audiences with different needs.
- **Implementation has:** Every content-generation prompt (`GEMINI_PROMPT`, `MAHABHARAT_PROMPT` in `supabase/functions/import-content/index.ts`) hardcodes **exactly two** practical-example domains for every verse, for every user, with no variation: one office/workplace scenario and one "general life/home" scenario. There is no parenting-specific, relationship-specific, or leadership-specific example track, no persona field on any user record, and no mechanism to select or generate examples per persona.
- **The tension:** The vision's core differentiator ("does this help people apply wisdom to *their* daily life") is currently served by a single, one-size-fits-all pair of examples baked in at content-generation time — not a personalized experience. This isn't a bug, it's how the pipeline is designed; but it is a real gap between "personalised wisdom journeys" as stated ambition and "same two examples for every user" as built.

### 1.3 Devotional sign-offs vs. "should never feel sectarian"

- **Vision states:** Mangalam "should never feel... sectarian" and should be "inclusive" and "respectful" to a global, multi-faith, beginner-friendly audience.
- **Implementation has:** Every generated piece of content ends with a fixed devotional exclamation baked into the `practical_examples` field and spoken aloud in the audio: **"Jai Shri Krishna" / "जय श्री कृष्ण"** for Gita/Mahabharat content, **"Jai Shri Ram" / "जय श्री राम"** for Ramayan content (see `MAHABHARAT_PROMPT`, `GEMINI_PROMPT`, and the 128 hand-corrected rows in `scripts/reference/ramayan_updates.sql`, all of which end this way). This is rendered in the UI (`PlayScreen.tsx` shows it centered, styled distinctly) and spoken in every audio file.
- **The tension:** A devotional, deity-specific exclamation at the end of every session is a stronger religious/devotional framing than "inclusive, non-sectarian, respectful to beginners and a global diaspora audience (some of whom may not be Hindu or devotionally practicing)" would suggest. Whether this is experienced as "sectarian" is a judgment call the business, not the code, needs to make — flagging the tension rather than resolving it.

### 1.4 Content-layer transparency vs. LLM-embellished "story" content for Ramayan/Mahabharat

- **Vision states:** "Mangalam always separates: Original scripture / Translation / Commentary / Interpretation / Practical application. Users should always know which layer they are consuming."
- **Implementation has:** For Gita, the layering is genuinely explicit in the UI (Sanskrit shown separately, then "Translation", then "Commentary", then "Daily Life Application" — each with its own labeled heading in `PlayScreen.tsx`). For Ramayan/Mahabharat, however, the "Story" field the user sees under the label **"Story"** is explicitly instructed (in `MAHABHARAT_PROMPT`) to **"RECREATE and EXPAND"** a base source into 500–700 words with invented **"sensory immersion"** (sights/sounds/smells not in any original text) and invented **"inner monologue"** for characters — i.e., it is an LLM-authored dramatization, not a translation of an original text, and not disclosed as such in the app. It is shown under a single "Story" label with no indication that it contains invented narrative detail layered on top of a base source.
- **The tension:** The vision's content-philosophy commitment ("users should always know which layer they're consuming") is fully honored for Gita but not clearly honored for Ramayan/Mahabharat, where "Story" conflates original narrative with LLM-invented embellishment under one label.

### 1.5 "Content ecosystem" (app + podcast + YouTube + website) vs. single-purpose, app-native content format

- **Vision states:** Mangalam is "a content ecosystem" spanning app, podcast (Spotify), YouTube, and a website, each with a distinct role, with content flowing across channels and audiences migrating between them.
- **Implementation has:** The content pipeline generates exactly one artifact shape: a 5–6 minute narrated audio file with an app-specific spoken intro ("Welcome to today's lesson...", present for Gita only), synced to an in-app transcript, referencing in-app UI concepts (bookmark icon, share-to-app-store messaging). There is no evidence in this repo of a podcast export pipeline, a YouTube script/video pipeline, or a website/SEO content pipeline — content is authored and formatted for the app specifically, not as channel-agnostic source material that could be repurposed.
- **The tension:** This is not necessarily a contradiction (a website/podcast pipeline may simply live in a different repo/system not reviewed here — see open question below) but *if* the intent is for the same underlying content to power all four channels, the current content model (audio-first, app-UI-coupled, with in-app-specific phrasing baked into the generated text itself) would need to be treated as one specific "render" of a more channel-neutral content asset, which is not how it's modeled today — the generated text and audio *are* the final, single-destination product, not a general-purpose source.

---

## 2. Confirmed Alignments (vision already matched by implementation)

- **"Ancient wisdom for modern life" / practical-application focus** — the entire content model (`translation`/`commentary`/`daily_life_application`/`practical_examples`) and the generation prompts are structurally built around turning scripture into practical, modern-life guidance. This is the single strongest point of alignment between vision and code.
- **"Daily companion" habit loop** — streak tracking (`user_daily_usage`, `StreaksScreen`), a persistent resume-journey card (`HomeScreen`), and background-audio/lock-screen playback support are all present and clearly built around daily, low-friction re-engagement — consistent with "daily companion for wisdom, reflection and spiritual growth."
- **Layered content presentation (Gita specifically)** — Sanskrit, translation, commentary, and daily-life-application are stored as distinct fields and rendered as clearly labeled, distinct sections in `PlayScreen.tsx`. This matches the "users should always know which layer they're consuming" principle well for Gita content (see §1.4 for the Ramayan/Mahabharat nuance).
- **English + Hindi as the current language scope** — matches the stated "Current Content Strategy" exactly; no over- or under-building here.
- **Simple, accessible, modern language requirement** — the Gemini prompts explicitly instruct "short, straightforward, spoken sentences," "avoid long, complex, or flowery sentences," and a strict "no Urdu-loanword / no English transliteration" purity rule for Hindi — consistent with "accessible for younger generations / beginners" and avoiding the "difficult, inaccessible" traditional-translation problem named in the business context.
- **Non-fear-driven, non-sensationalist tone** — nothing observed in prompts, UI copy, or code suggests fear-based or sensationalist framing; tone constraints in the generation prompts actively push toward calm, modern, simple language.

---

## 3. Gaps (vision calls for it; nothing built yet — no contradiction)

- **Personalized/guided "wisdom journeys" and "learning paths.**" No journey/course/path abstraction exists anywhere in the data model — content is strictly `book → chapter → verse`, browsed linearly. `activeBookId` is the only "current path" concept, and it identifies a scripture, not a curated theme (e.g., "Wisdom for New Parents").
- **Thematic/topic access (career, relationships, parenting, leadership).** There is no theme or topic tag on `verse_content` or `books`. All navigation is scripture-first (Gita/Ramayan/Mahabharat), not theme-first, so a user cannot currently browse "parenting lessons" or "leadership lessons" as an entry point the way the vision's problem statement frames the user's actual questions.
- **Podcast / YouTube / website distribution pipelines.** None of these are present in this repository. (Reasonable to assume they live elsewhere — see open question below — but they are not part of what this codebase does today.)
- **Premium content journeys, membership subscriptions, family plans, corporate programs.** None of these exist. The only monetization surface today is a single static Stripe donation link with no tiering, no entitlements, and no corporate/family concept anywhere in the schema.
- **Upanishads, Puranas, character journeys, "hidden stories."** Not present as real content (no rows/books), though see §4 below — this one is *scaffolded*, not a pure gap.
- **Cross-channel funnel tracking** (podcast → app, YouTube → podcast, website → app). No referral/attribution/campaign tracking of any kind exists in the app (no UTM handling, no deep-link campaign params beyond the plain OAuth/app-scheme links already documented in `DISCOVERY.md`).

---

## 4. Scaffolded (gap, but the codebase already anticipated it)

- **Future scripture expansion (Upanishads, Shiv Puran).** `src/data/types.ts`'s `ContentPath` type already includes `'shiv_puran' | 'upanishads'` alongside `'gita' | 'ramayan' | 'mahabharat'`, and `HomeScreen` already renders these as "coming soon" tiles in the book-explore grid. The type system and UI already anticipate exactly this vision item — only the content and `books` rows are missing, not the architecture.
- **Unified content model across scripture types.** The migration history shows a deliberate move (`20260315113335_drop_episodes_tables.sql`) away from a separate `episodes`/`episode_content` schema toward folding *all* content — verse-based (Gita) and narrative-based (Ramayan/Mahabharat) — into one `verses`/`verse_content` shape. This means the data model can already represent non-verse narrative content (treating `chapter_no`/`verse_no` as a generic sequence position rather than literal scripture verse numbers), which is a reasonable technical foundation for future narrative content types like "character journeys" or "hidden stories" — though the column names (`verse_no`, `sanskrit`) still read as verse-specific and would carry that naming mismatch forward if reused as-is for non-verse content.

---

## 5. Open Questions This Context Raises

1. Do podcast (Spotify), YouTube, and website content pipelines exist in a separate repository/system, or are they planned but not yet started anywhere? This determines whether §1.5's "single-format content" observation is a real architectural gap or simply out of this repo's scope.
2. Is the free-session cap (§1.1) an intentional monetization lever that predates/overrides the "monetization is secondary" phase, or was it built early and is now understood to be premature/disabled on purpose?
3. Is the devotional sign-off ("Jai Shri Krishna"/"Jai Shri Ram", §1.3) considered core brand voice (devotional warmth) rather than sectarian framing from the business's perspective? The code treats it as a fixed, non-optional part of every piece of content either way.
4. For Ramayan/Mahabharat, is the LLM-embellished "Story" content (§1.4) understood internally as creative retelling (acceptable, and just needs a UI label/disclosure) or is faithfulness to source narrative expected at a level the current "RECREATE and EXPAND" prompt instruction doesn't guarantee?
5. Is persona-specific content (parent vs. professional vs. diaspora vs. beginner, §1.2) intended to be solved by generating more example variants per verse, by letting users self-select a "lens" at read/listen time, or by some other mechanism not yet decided?

---

## 6. Decisions (recorded 2026-07-15)

- **§1.1 / open question 2 — Free-tier session cap: RESOLVED.** The app stays free for all users indefinitely; this is a deliberate choice, not a temporary early-stage stance pending re-enablement. Monetization is donation-based (Stripe link) now, with a possible future product-sales line ("religious-tech" merchandise/products) as a later-stage idea. The dormant 3-session cap in `PlayScreen.tsx` should be treated as dead code to be removed when convenient, not a paused feature awaiting a future flip.
- **§1.2 / open question 5 — Multi-persona examples: acknowledged gap, deferred, not resolved.** No decision yet on the mechanism (variant generation vs. user-selected lens vs. other). Explicitly **not** to be retrofitted onto existing verses/audio — any persona-specific example track applies to *future* episodes and verses only. Existing "office + home" content is grandfathered.
- **§1.3 / open question 3 — Devotional sign-offs: RESOLVED.** This is an intentional brand/platform choice, not sectarian framing to be softened. "Jai Shri Krishna" / "Jai Shri Ram" sign-offs stay as-is, including for any new content in the existing pillars.
- **§1.4 / open question 4 — Story-layer transparency for Ramayan/Mahabharat: acknowledged gap, deferred, not resolved.** No relabeling/disclosure UI is being retrofitted onto existing content now. Any future episode/verse pipeline extending the "recreate and expand" pattern should revisit disclosure explicitly before launch, but existing content is grandfathered as-is in the meantime.
- **§1.5 / open question 1 — Content ecosystem / channel-neutral content: RESOLVED (updated 2026-07-15).** The multi-channel presence is real and already live, outside this repo:
  - YouTube (English Gita): https://www.youtube.com/@GitaMangalam
  - YouTube (Hindi Gita): https://www.youtube.com/@GeetaMangalam
  - Spotify (English Gita): https://open.spotify.com/show/033J3pPstKZF4OB7jfbgPb
  - Spotify (Hindi Gita): https://open.spotify.com/show/033J3wKenjoqV6AdSupyhW
  - Website: https://www.mangalamapp.com/

  This confirms §1.5's tension is **not** "the ecosystem is unplanned" — it exists and is being run today, just apparently populated through a separate/manual process rather than this codebase's pipeline. The gap this repo should still track: there is no evidence here of an *automated* export from `verse_content`/`verse_audio` to these channels — i.e., today's app-native audio+transcript generation and the content actually published on YouTube/Spotify/website are presumably produced/published through a parallel, uncoupled process. Per `CLAUDE.md` §7's "content-as-platform: one source of truth across channels" principle, if/when there's appetite to reduce duplicate authoring effort, these four channels are the concrete integration targets for a future export pipeline — but building that isn't implied as urgent by this decision alone.
- **`accountStatus` / donation flow (not gated on anything today):** given the free-forever decision above, `accountStatus: 'free'|'supporter'` no longer needs to gate features. Recommendation (per `CLAUDE.md` §7's existing principle that entitlements must be backend-verified when built): don't invest in wiring `accountStatus` to a Stripe webhook now — there's nothing to entitle it to yet, so backend verification work would be premature. Two low-cost options when ready to act: (a) leave `accountStatus` as unused dead state and remove it in a later cleanup pass, since nothing reads it today, or (b) repurpose it as a purely cosmetic, self-reported "Supporter" badge (user taps "I donated" after returning from the Stripe link) with no gating and no verification — useful for a thank-you UI, but explicitly not an entitlement system. Build real backend-verified entitlements only when an actual paid product/membership exists to attach them to.
