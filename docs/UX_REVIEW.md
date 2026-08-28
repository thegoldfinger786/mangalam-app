# Mangalam — UX & Functional Review (Baseline)

**Date:** 2026-08-27 · **Scope:** Full screen-by-screen and function-by-function review of the shipped app.
**Method:** Source-code inspection **plus** a full authenticated walkthrough of the running iOS build (iPhone 17 Pro simulator, `claude.test@mangalam.com`, production Supabase). Every screen was visually inspected; the core flows — onboarding, browse, verse/audio experience, focus mode, share, bookmark, settings, dark mode, sign-out — were exercised live against Bhagavad Gita and Ramayan content.

Companion documents:
- [`UX_TRACKER.md`](./UX_TRACKER.md) — the living backlog (every finding, with status).
- [`DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md) — durable Mangalam design principles.
- [`TESTING.md`](./TESTING.md) — how to run and test the app; the test account.

Every finding below is tagged: **[SRC]** found by reading code · **[LIVE]** observed in the running app · **[SRC+LIVE]** both. Recommendations are separated from observations. This document records what was found and recommended; it does **not** implement anything.

---

## 1. The product, as built

**What Mangalam is trying to do:** give someone a short, repeatable daily practice — open the app, spend 5–10 minutes listening to a narrated piece of Indian wisdom (source text → translation/story → commentary → how it applies to daily life), reflect, and come back tomorrow. Audio-first, English and Hindi, free.

**Who the user is:** the vision names five audiences (young professionals, diaspora, parents, spiritual seekers, beginners). The app today serves them all identically — same content, same two practical examples, in whichever of two languages you picked.

**Primary journey (as built):** Login → (first run) enter name → Home → pick a book → book dashboard → "Start Chapter X Verse Y" → Play screen (listen + read the synced transcript) → auto-advance to the next verse. Resume tomorrow from the Home "My Current Path" card.

**Secondary journeys:** browse the Library (Books → Chapters → Verses); see "Community Wisdom" (what others are listening to); manage voice/language, audio mix and theme in Settings; support the project (external Stripe link); read the philosophy/legal pages.

**Intended emotional register:** calm, intentional, spiritual, trustworthy, unhurried, non-sectarian, non-gamified. The visual language (sunrise palette, Outfit type, generous whitespace, ambient background audio) and the About-screen copy hit this register well. Several interaction and copy choices pull against it (see §6).

---

## 2. Executive summary

**Mangalam is fundamentally in good shape.** The core proposition is clear, the audio experience is well built, and the visual identity is calm and distinctive. This is **not** a redesign situation. It is a targeted-improvement situation: a set of specific, mostly small changes would materially raise the quality and reinforce the positioning.

**What is working particularly well**
- The **Play screen** and its layered content model (source → translation/story → commentary → daily-life application → practical examples), each independently labeled, with a synced auto-scrolling transcript, per-book cover art, focus mode, variable speed, skip-15, prev/next verse, auto-advance, bookmark and share. This is the product's core asset and it is solid.
- **Audio infrastructure** — background ambient bed, lock-screen playback, resume-across-relaunch, a persistent mini-player that correctly hides on the Play screen.
- **Visual identity** — the sunrise palette, Outfit typography, spacing, and the subtle animated background read as deliberate and calm. The dark theme is well executed.
- **Brand voice where it exists** — the About screen ("a quiet space to reconnect… pause… clarity, calm and understanding") and the Streaks copy ("Consistency over intensity. Ten minutes a day…") are exactly on-positioning.
- **Trust posture** — free, no ads, no competitive social graph, privacy-forward messaging.

**The biggest weaknesses**
1. **The first-run and empty states underdeliver.** Onboarding is a bare name field with a broken-looking empty gap (blank placeholder strings) and no explanation of the practice. A brand-new user's Home screen is ~50% empty ("My Current Path" header over a large void) with nothing specific to do today.
2. **Developer-facing language and unfinished states leak into the UI** — "Resume at 20s", "Resume is unavailable until remote progress exists", a "Change Path?" alert that tells a new user they're "focused on the *No recent verse* path", raw navigation error toasts.
3. **A navigation dead-end** — under a reproducible sequence, the Play screen's close control stops working and the user is stuck.
4. **Two of everything** — two content-browse screens with different UIs, two different streak widgets with different logic, 3–4 "Support" entry points.
5. **Metrics that aren't real** — "Total Time" is `streak × 10 minutes`; the "streak" isn't consecutive days; verses count as "completed" the moment you open them.
6. **Positioning drift** — a competitive podium in "Community Wisdom" (gold trophy, silver/bronze medals, "#1", "Trending Now"), a "Day Journey 🔥" streak, an unlabeled devotional phrase rendered large at the *top* of every Ramayan/Mahabharat episode, and "study"-framed language — all pull toward "religious/scripture-study/habit-app" and away from "inclusive spiritual wellness".

**Is this polish, UX work, or something deeper?** Mostly **B — targeted UX improvements**, with one **P0** correctness bug (the navigation dead-end) and one strategic question the business must answer (how literally to pursue "wellness, not religious"; see §6). The content model and architecture are sound and should be preserved.

---

## 3. Overall scorecard

| Area | Rating | Key observation |
|---|---|---|
| Visual design | **Good** | Calm, distinctive palette and type; let down by empty voids, clipped buttons, and a broken emoji glyph. |
| UX | **Needs Improvement** | Strong core loop; weak first-run, empty, and error states; developer language in the UI. |
| Navigation | **Needs Improvement** | Modal-over-tabs vs in-tab inconsistency; a reproducible `GO_BACK` dead-end on the Play screen. |
| Content experience | **Needs Improvement** | Play screen is strong; discovery is scripture-first only; Gita verse lists are a wall of Devanagari while Ramayan's are readable titles. |
| Audio experience | **Good** | Background bed, lock-screen, resume, mini-player, auto-advance all work; no sleep timer; failures are silent. |
| Interaction design | **Needs Improvement** | Auto-scroll fights the reader; "Change Path?" gate; nested tap targets in chapter tiles. |
| Consistency | **Needs Change** | Two browse UIs, two streak widgets, four "Support" entries, five header styles, bypassed type scale. |
| Emotional / spiritual experience | **Good, with drift** | The calm base is real; podium/streak/"study" cues and an unlabeled top-of-screen devotional phrase pull against the wellness positioning. |
| Overall product experience | **Good foundation** | Preserve the core; fix a focused list of specific issues. |

---

## 4. Screen-by-screen review

Concise; full detail and IDs are in [`UX_TRACKER.md`](./UX_TRACKER.md).

### Login (`LoginScreen`) — GOOD · Priority: P2 · Confidence: High
**Purpose:** authenticate via Google / Apple.
**What works [LIVE]:** clean, centered, calm; logo, tagline, one clear instruction, privacy line.
**What could be better:** "By signing in, you agree to our Terms of Service" is not a link [SRC+LIVE]. The line "We do not collect any of your personal data" contradicts the actual Privacy Policy and the implementation (email, usage, activity, bookmarks are all stored) [SRC+LIVE] — this is a trust risk, not a nitpick.
**Recommendation:** link Terms/Privacy; change the privacy line to something true and still reassuring ("We collect only what the app needs to work. No ads, no selling your data.").

### Onboarding (`WelcomeScreen`) — NEEDS CHANGE · P1 · High
**Purpose:** capture a display name on first run.
**What works:** single focused field; name flows through to the greeting.
**What could be better [SRC+LIVE]:** the screen renders **blank whitespace-only strings** where a tagline and an input label were removed, leaving a large empty gap between "Mangalam" and the field — it looks unfinished. It asks only for a name, with **no explanation of what Mangalam is, what the practice involves, what "your journey" means, no language choice, and no interest/intent capture.** The one good articulation of the product lives buried in Settings → About.
**Recommendation:** rebuild as a 2–3 screen intro that (a) says what the practice is in one calm sentence, (b) lets the user pick a language, (c) optionally asks what draws them (calm / purpose / relationships / curiosity) to seed future theming, (d) then asks the name. Fix the blank strings regardless.

### Home (`HomeScreen`) — NEEDS CHANGE · P1 · High
**Purpose:** greet, resume, explore.
**What works [LIVE]:** the populated "My Current Path" card (gradient fill, book accent colour, clear "Continue") is good; the explore grid is clean with nice custom scripture icons.
**What could be better:**
- **Empty for new users [SRC+LIVE]:** with no progress, "My Current Path" is a section header above a ~700px void; the screen is ~50% blank with nothing to do today.
- **Stale within a session [SRC+LIVE]:** after listening, the card does **not** refresh until the app is force-relaunched (a `hasLoadedRef` guard blocks the reload). The primary "continue" surface is wrong exactly when it matters.
- **Developer copy [SRC+LIVE]:** "Resume at 20s", "Resume is unavailable until remote progress exists", "Your current path will appear here after you start a verse".
- **"Change Path?" gate [SRC+LIVE]:** tapping any non-active book shows a blocking alert; for a new user it reads *"You are currently focused on the No recent verse path. Subtle persistence leads to deeper wisdom. Are you sure you want to change paths?"* — confusing and mildly preachy on the primary discovery action.
- **Redundancy [LIVE]:** the explore grid is the same 4 book cards as the Library tab.
- **Dead code [SRC]:** `getGreeting()` (time-of-day) is unused; header is always "Namaste, {name}".
**Recommendation:** give Home a "Today" anchor (one chosen reflection, plain-language framed); fix the resume-card refresh; replace all the microcopy; remove the "Change Path?" gate (let people move between books freely, keep "Continue" as the gentle default); design the empty state.

### Community Wisdom (`CommunityWisdomScreen`) — NEEDS CHANGE · P1 · High
**Purpose:** show what others are engaging with (soft social proof).
**What works:** the idea — gentle "you're not alone in this" — is right for the product.
**What could be better [SRC+LIVE]:** it is built as a **competitive leaderboard** — gold trophy for #1, silver/bronze medals, "#1"–"#5" ranks, "TRENDING NOW / MOST INSPIRED / TOP SAVED". This directly contradicts the stated "not competitive, not gamified" intent. Every row is just "Bhagavad Gita / Chapter 2, Verse 4" — no title, no snippet, no reason it's surfaced. Subtitle "Discover what fellow seekers are finding inspired by" is grammatically broken.
**Recommendation:** reframe as "What others are finding meaningful this week" — no ranks, no medals, no "trending"; show the verse title and a one-line why; a short unordered set, not a podium.

### Book Dashboard (`BookDashboardScreen`) — NEEDS IMPROVEMENT · P1 · High
**Purpose:** a book's landing page — progress + continue + chapter list.
**What works [LIVE]:** hero art, Sanskrit title, "The Song of God", "Your journey begins here" — calm and clear; the CTA is prominent.
**What could be better [SRC+LIVE]:** it **duplicates the Library book-detail view** with a different UI (1-column list vs Library's 3-column grid) and a different presentation (modal vs in-tab). You can't browse a chapter's verses from here — tapping a chapter jumps straight into playback. "across 1 chapters" grammar bug. Cover art is only wired for Gita + Mahabharat. A decorative sparkle/book divider is filler.
**Recommendation:** merge with the Library book-detail into one browse flow (see systemic UX-02); let a chapter expand to its verse list.

### Play (`PlayScreen`) — NEEDS IMPROVEMENT (core screen; mostly strong) · P0–P2 · High
**Purpose:** the listening + reading experience.
**What works [LIVE]:** the layered, labeled content; per-book cover art; synced highlight; **focus mode** (bigger text, less chrome — genuinely good for reading); speed pill (0.75–2×); skip-15; prev/next verse; auto-advance to the next verse on finish; bookmark; native share. Audio played reliably for every Gita and Ramayan verse tested.
**What could be better:**
- **P0 — navigation dead-end [SRC+LIVE]:** after a sequence of dismissing stacked modals and re-opening Play from the mini-player, the down-chevron fires `GO_BACK` → "not handled by any navigator", and the modal swipe-dismiss also fails. The user is **stuck on the Play screen**. (In a production build there's no error toast — the control just silently does nothing.)
- **Silent no-audio state [SRC]:** if no audio asset exists, the screen loads with an empty player (0:00 / 0:00, play does nothing) and no message. (Not reproduced live — all tested verses had audio.)
- **Swallowed playback errors [SRC]:** the audio-engine `status.error` handler is empty — no surface, no retry.
- **Auto-scroll fights the reader [SRC+LIVE]:** every position tick calls `scrollTo`, so trying to read ahead or back is undone within ~1s.
- **Devotional phrase placement [SRC+LIVE]:** for Ramayan/Mahabharat the sign-off ("जय श्री राम" / "जय श्री कृष्ण") is stored in the source-text field and therefore rendered **large, centered, orange, unlabeled, at the top** of the content. A newcomer's first impression of a Ramayan episode is an uncontextualised Devanagari devotional phrase. (The sign-off itself stays — a settled brand decision — but placement and the missing label are fixable.)
- **Generation artifacts in body text [SRC+LIVE]:** "Welcome to today's lesson. We are in Chapter 1 Verse 1" shown as transcript; "mine ness"; commentary re-stating "Chapter 1 Verse 1".
- **Sanskrit highlight is a no-op [SRC]** (`activeColor === inactiveColor`).
- **No context in the header** once the cover scrolls away; **no sleep timer** despite About suggesting bedtime listening.
**Recommendation:** fix the `GO_BACK` path (P0); add explicit "audio unavailable / try again" states; pause auto-scroll while the user is scrolling and resume after a few seconds idle; move the sign-off to the end and label it ("A traditional closing blessing"); strip the intro line and numbering from displayed text; add a sleep timer; show book · chapter in the header.

### Mini Player (`MiniPlayer`) — GOOD · P2 · High
**What works [LIVE]:** persistent, correct visibility (hidden on Play), progress line, transport + close.
**What could be better [SRC+LIVE]:** shows a cryptic "**BG 1.2**" for books without verse titles (Ramayan, which has titles, shows the title). References a font family ("Inter-SemiBold") the app doesn't bundle → silent fallback. Six controls is dense.
**Recommendation:** always show a human title; use theme font tokens; consider dropping to 3 controls (−15 / play / +15) with prev/next behind a tap-through.

### Library (`LibraryScreen`) — NEEDS IMPROVEMENT · P1 · High
**Purpose:** browse Books → Chapters → Verses.
**What works [LIVE]:** completion checkmarks; the Ramayan verse list — descriptive English titles ("Narad Muni Changes Ratnakar's Heart") — is scannable and inviting.
**What could be better [SRC+LIVE]:**
- Three-level drilldown inside the tab with custom "Books" / "Back" pills (no native headers).
- Chapter tiles: the number sits **above** the word "Chapter" ("1 / Chapter" reads backwards); each tile also has a nested play button (two targets in one tile).
- **The Gita verse list is a wall of Devanagari** (raw `sanskrit`, some with embedded "।।1.3।।") with no English hint — unusable for the beginner/non-Sanskrit audience the positioning targets. Ramayan's list shows the model that works.
- **No search or filter** anywhere (Gita alone is ~700 verses).
- Bare spinner while loading; verses marked "listened" on open, not on completion.
**Recommendation:** consolidate into one browse flow shared with the Book Dashboard; give **every** unit a human title; add search/filter; use skeletons; mark complete on actual completion.

### Streaks / "Your Journey" (`StreaksScreen`) — NEEDS IMPROVEMENT · P1 · High
**Purpose:** show practice continuity.
**What works [LIVE]:** "Consistency over intensity. Taking ten minutes a day for reflection builds a resilient mind." — exactly right.
**What could be better [SRC+LIVE]:**
- **"Total Time" = `streak × 10 minutes`** — a fabricated number, shown as "~10m", unrelated to actual listening.
- The **"streak" isn't consecutive** — it's a count of usage-day rows in the last 30, labeled "N Day Journey".
- The **🔥 emoji renders as a missing-glyph box** on the test device.
- It **duplicates Home's "This Week"** widget with different logic and a different week start (this tab starts Friday: "F S S M T W T").
- The whole tab is one number + seven dots + two tiles — thin enough to be a Home section.
- Flame + "Day Journey 🔥" leans gamified against the stated positioning.
**Recommendation:** drop "Total Time" (or make it real); relabel the streak honestly ("days practised"); fix the glyph; unify with Home's widget; fold this into Home or a "Journey" section; keep the gentle copy.

### Settings (`SettingsScreen`) — NEEDS IMPROVEMENT · P1 · High
**What works [LIVE]:** clear sections (Account / Voice / Audio / Display / About); voice cards; audio sliders; inline name edit; the dark theme (toggled live) is clean and consistent.
**What could be better [SRC+LIVE]:**
- **Language is buried and mislabeled** — the only way to switch content language is "Voice Preference" ("English Male", "Hindi Female", …), deep in Settings; there is no language switch at the point of listening/reading.
- **No account-deletion option anywhere** — App Store Guideline 5.1.1(v) requires in-app account deletion for apps with account creation. Compliance risk.
- Sign-out is a small **red door icon** immediately right of the "Settings" title — jarring and easy to mis-tap (a confirmation alert mitigates it).
- "Plan: Free & Ad-free" is a filler row; "Support Mangalam" is one of 3–4 support entry points; Narration Volume can't go below 70%.
**Recommendation:** rename to "Language & Voice" and expose a language toggle in the player; add account deletion; move sign-out into the Account card as a normal row; widen the narration range.

### About / "Our Philosophy" (`AboutScreen`) — GOOD · P2 · High
**What works [LIVE]:** the copy is excellent and precisely on-positioning ("a quiet space to reconnect", "pause", "clarity, calm and understanding", the closing blessing). Good, honest disclaimer ("does not claim to represent any single authoritative interpretation").
**What could be better [SRC+LIVE]:** ~14 stacked cards in one long scroll; the Support section is **duplicated verbatim** on the dedicated Support screen; ALL-CAPS orange headers are loud for a "quiet space"; the destination is called three things ("Our Philosophy" / "About Us" / "About").
**Recommendation:** keep the substance; trim and de-duplicate; surface a short version of the "what is Mangalam" copy in onboarding.

### Support (`SupportMangalamScreen`) — NEEDS IMPROVEMENT · P2 · Medium
**What works [LIVE]:** honest, non-pushy framing; "what your support enables" is concrete.
**What could be better [SRC+LIVE]:** "Support with **€5** / Custom Amount" — euro hard-coded for a global audience, and the button label **wraps and is clipped** by the card top on the test device. Opens Stripe in Safari with no in-app return / acknowledgement. Content duplicates the About support section.
**Recommendation:** localise or drop the currency; fix the button; de-duplicate with About; add a gentle "thank you" state on return.

### WebView (`WebViewScreen`) — NEEDS IMPROVEMENT · P2 · Medium
**What works:** renders the legal/support pages in-app.
**What could be better [SRC+LIVE]:** bare — a back arrow and nothing else (no title, no loading indicator, no error state, no "open in browser"). The embedded page carries its own "← Back to Home" site nav that's confusing inside the app; the website's serif typography clashes with the app's Outfit.
**Recommendation:** add a titled header + loading/error states + "open in browser"; strip or hide site chrome, or link out to the browser for legal pages instead.

### Email/password screen (`AuthScreen`) — KEEP (not user-facing) · Confidence: High
Deliberately unrouted (per `CLAUDE.md`); used only as a hidden admin/QA entry. Left as-is. It was temporarily exposed for this review and reverted.

### System states — NEEDS IMPROVEMENT (systemic)
- **Loading:** Home has designed skeletons; every other screen uses a bare centered spinner.
- **Empty:** no designed empty states (new-user Home, empty Community sections, no bookmarks screen at all).
- **Error:** `Alert.alert` or silent failure throughout; no retry affordances; in the dev build, swallowed errors surface as raw React-Navigation toasts.

---

## 5. Cross-app patterns (systemic issues)

Each is a single item that recurs across screens. Screen findings reference these.

| ID | Pattern | Evidence (screens) | User impact | Recommended approach | Priority |
|---|---|---|---|---|---|
| **UX-01** | Developer-facing microcopy & unfinished states in the UI | Home resume card, Welcome (blank strings), "Resume at 20s", raw error toasts | Breaks the calm, finished feeling; reads as a beta | One copy pass; a designed message for every empty/loading/error/offline state | **P1** |
| **UX-02** | Two parallel content-browse implementations | `LibraryScreen` (in-tab grid) vs `BookDashboardScreen` (modal list); Home explore grid duplicates Library | Inconsistent interaction, redundant surfaces, double maintenance | One browse flow; Home / Library / Community all route into it | **P1** |
| **UX-03** | Two streak widgets, different logic & week-start | Home "This Week" (Mon start) vs Streaks tab (Fri start) | Numbers disagree between screens | One shared `WeeklyStreak` component, one streak definition | **P1** |
| **UX-04** | Metrics that aren't measured / are mislabeled | Streaks "Total Time" (`×10m`), non-consecutive "streak", verses "completed" on open | Erodes trust in every number the app shows | Show only measured values, label literally, or remove | **P1** |
| **UX-05** | Inconsistent loading states | Home (skeleton) vs Library/Streaks/Community/Dashboard/Play (spinner) | Uneven perceived quality | Extend the skeleton pattern | **P2** |
| **UX-06** | Inconsistent headers & back affordances | Native chevron-down; custom "Books"/"Back" pills; ALL-CAPS SafeAreaView headers; centered chevron-back | Users can't predict how to go back | One header component, one back convention | **P2** |
| **UX-07** | "Support / donate" surfaced 3–4 ways, inconsistent labels | Settings, About (×2), dedicated screen; "Support Mangalam" vs "Become a Supporter" | Feels like being asked repeatedly | One Support screen; one Settings entry + one contextual mention; consistent label | **P2** |
| **UX-08** | Errors via `Alert.alert` or silent failure; no retry | Play (silent), Library, Dashboard, audio engine | Dead ends when something goes wrong | Inline recoverable error states with "Try again" | **P1** |
| **UX-09** | Gamification cues inconsistent with the positioning | Community podium (#1/medals/"Trending"), Streaks flame + "Day Journey 🔥" | Pulls toward habit-app / competition, away from wellness | Strip competitive & streak-anxiety cues; keep gentle continuity | **P1** |
| **UX-10** | Typography scale largely bypassed | Most screens hard-code `fontSize` and use `fontWeight:'bold'` instead of Outfit family tokens | Drift, uneven hierarchy; violates `CLAUDE.md` §2 | Define semantic text styles; migrate incrementally | **P2** |
| **UX-11** | Content language framed only as "Voice Preference", buried | Settings only; no switch at point of use | Hindi users must dig; language reads as a "voice" nicety | Rename "Language & Voice"; expose a language toggle in the player | **P1** |
| **UX-12** | "Path" exclusivity model + "Change Path?" gate | Home | Nags and blocks the primary discovery action; fights a browse-freely model | Drop the gate; free movement between books; keep "Continue" as default | **P1** |
| **UX-13** | Scripture-first navigation only; no theme/topic/mood entry | Whole app | The vision frames the user's question as "how does this apply to *my* work / grief / decision" — the app only answers "which book" | Additive theme/tag layer later — not a rebuild | **P2 (strategic)** |
| **UX-14** | Generic tab icons + slug-mismatch fallback risk | `getScriptureIcon` / `COLLECTION_METADATA` switch on `gita/ramayan/mahabharat`; live books include `AntarKathaye`, and some code paths pass `bhagavad-gita` | New/renamed books silently get a default icon, title and colour | Resolve display metadata through the identity cache, not string-literal switches | **P2** |
| **UX-15** | No "today" anchor | Home | A daily-habit product gives a new user nothing specific to do now | One chosen reflection on Home, plainly framed | **P1** |

---

## 6. Spiritual-wellness positioning assessment

**How strongly does the app communicate "inclusive spiritual wellness" today?** Moderately. The *container* — palette, type, spacing, ambient audio, ad-free, privacy-forward, the About-screen voice, "consistency over intensity" — genuinely reads as wellness. The *content framing and several interactions* read as scripture study or a habit app.

### Where it currently feels too religious / devotional / study-oriented
- **[LIVE] The devotional sign-off is unlabeled and mis-placed.** For Ramayan/Mahabharat, "जय श्री राम" / "जय श्री कृष्ण" is rendered large, centered, orange, with no label, at the **top** of every episode (it's stored in the source-text field). A non-Hindu or beginner user's first on-screen impression is an uncontextualised Devanagari devotional phrase. *The sign-off stays — that's settled — but it belongs at the end, with a one-line label ("A traditional closing blessing").*
- **[LIVE] "Chapter N · Verse M" everywhere**, including for Ramayan story episodes, frames the experience as scripture study rather than a practice.
- **[LIVE] "My Current Path", the forced single path, and "Subtle persistence leads to deeper wisdom"** are discipline/study framing on the primary discovery action.
- **[LIVE] Sanskrit lands first, large, with no "here's what this is"** for a newcomer.
- **[LIVE] "Day Journey 🔥"** and the **Community podium** (trophy / medals / "Trending Now") are habit-app / competition cues.
- **[LIVE] Onboarding "Begin Your Journey"** with no framing of what the practice actually is.
- **[LIVE] "See what others are studying today"** on Home.

### Where it successfully creates an inclusive wellness experience
- The **sunrise palette, Outfit type, spacing, and subtle animated background** — calm, unhurried, non-sensational.
- The **About-screen copy** — "a quiet space to reconnect… pause… bring a little more clarity, calm and understanding into your day."
- **"Consistency over intensity. Ten minutes a day."**
- **Audio-first** with an ambient bed and lock-screen playback supports a short daily ritual rather than long study.
- **Free, no ads, no friend graph, no competitive social layer** (Community aside), privacy-forward messaging.
- The **practical-application layer** ("Daily Life Application", practical examples) is the bridge from tradition to everyday life — the core wellness move.

### Highest-value changes for the positioning
1. **Reframe onboarding around the practice.** One calm sentence about what the daily few minutes are; pick a language; optionally "what brings you here" (calm / purpose / relationships / curiosity). Immediately shifts the feel from "sign up to study scripture" to "start a wellness practice".
2. **Give Home a "Today".** One chosen reflection to listen to now, with a plain-language framing line. Turns "I have ten minutes" into an obvious action.
3. **Add plain-language context and label the tradition.** A one-line "what this is" above the Sanskrit; move the devotional sign-off to the end and label it; soften "Verse/Chapter" with a friendly secondary label ("Reflection 12"). Authenticity intact, barrier lowered.
4. **Calm the metrics and the social layer.** Remove "Total Time"; relabel the streak honestly; strip the Community podium (keep "what others are finding meaningful"); reduce flame/"Day Journey" cues.
5. **Remove the "Change Path?" gate.** Let people wander the catalogue the way they'd browse a wellness library; keep "Continue" as the gentle default.
6. **(Later, strategic) Theme/mood entry points** — "For a restless mind", "Facing a hard decision", "On grief" — an additive tag layer over existing content, matching how the vision frames the user's actual question.

**Important:** none of this means diluting the Indian spiritual identity. Keep the Sanskrit, the source names, the sign-off, the depth. The opportunity is *framing* — lead with the practice and the plain-language "what this is", keep the tradition fully present underneath.

---

## 7. Top 10 recommendations

Ranked by expected improvement to the Mangalam experience.

| # | Change | Current problem | Why it matters | Expected benefit | Effort | Priority |
|---|---|---|---|---|---|---|
| 1 | **Fix the Play-screen `GO_BACK` dead-end** | Under a repeatable modal-dismiss + mini-player sequence, the close control silently stops working; user is stuck | A user who can't leave the player will force-quit and may not return | Removes the only P0; protects the core screen | Low–Med | **P0** |
| 2 | **Give Home a "Today" anchor + fix the empty/stale resume card** | New users see a ~50% empty screen; the resume card doesn't refresh within a session | This is the return surface for a daily-habit product | "I have ten minutes → open Mangalam → listen" becomes frictionless | Med | **P1** |
| 3 | **Rebuild onboarding around the practice** (and fix the blank strings) | A bare name field with a broken-looking gap and no explanation | First impression sets whether it feels like wellness or scripture study | Higher activation; positioning shift; enables future theming | Low–Med | **P1** |
| 4 | **Replace developer microcopy with calm human copy; design every empty/loading/error state** | "Resume at 20s", "…until remote progress exists", raw toasts, bare spinners | Systemic; makes the whole app feel unfinished | App reads as a deliberate, finished product | Low–Med | **P1** |
| 5 | **Consolidate the two browse UIs** (Library detail + Book Dashboard) into one | Two different screens do the same job with different layouts and navigation models | Consistency; half the maintenance; predictable navigation | One coherent way to explore content | Med | **P1** |
| 6 | **Honest metrics + one streak widget** | "Total Time" is fabricated; "streak" isn't consecutive; two widgets disagree | A calm, trustworthy product can't show made-up numbers | Trust; consistency | Low–Med | **P1** |
| 7 | **De-gamify Community Wisdom** | Gold trophy, medals, "#1", "Trending Now" — a competitive podium | Directly contradicts the stated "not competitive, not gamified" positioning | Reinforces wellness positioning; still provides social proof | Low | **P1** |
| 8 | **Remove the "Change Path?" gate; allow free movement between books** | A blocking, mildly preachy alert on the primary discovery action | Fights a browse-freely wellness-catalogue model | Lower friction; less "study discipline" tone | Low | **P1** |
| 9 | **Tame the transcript auto-scroll** | Every tick yanks the view back; you can't read at your own pace | The Play screen is the core experience and this actively fights the user | Reading and listening stop competing | Med | **P1** |
| 10 | **Surface language at point of use; add a sleep timer; add account deletion; give every content unit a human title** | Language buried as "Voice Preference"; no timer for bedtime listening; no account deletion (App Store risk); Gita lists are raw Devanagari | Accessibility, compliance, and daily-use fit | Broader reach; store compliance; scannable content | Med | **P1 / P2** |

---

## 8. What we should NOT change

Protect these deliberately.

- **The layered content model on the Play screen** — source text → translation/story → commentary → daily-life application → practical examples, each independently labeled. This is the product's core differentiator versus a plain scripture app or a quote feed. (Fix *placement* of the sign-off; don't touch the structure.)
- **The audio-first model** — background ambient bed, cross-fade, lock-screen playback, resume-across-relaunch, auto-advance, the mini-player. It works and it's non-trivial.
- **The calm sunrise visual identity** — palette, Outfit typography, spacing generosity, the subtle animated background, the per-book cover art. The dark theme.
- **Focus mode** on the Play screen — keep the feature; just make the affordance clearer.
- **The About-screen voice** — this *is* the brand voice; propagate it, don't rewrite it.
- **"Consistency over intensity. Ten minutes a day."** — exactly the right framing for continuity.
- **Free forever, no ads, donation-only** — and the absence of a friend graph, points, badges, and quizzes. Keep resisting those.
- **Google / Apple-only auth** and the hidden, unrouted email/password screen.
- **Resume-journey / progress sync** as a concept (fix the Home refresh; keep the mechanism).
- **Showing Sanskrit prominently, and the synced-highlight concept** — keep the idea; fix the behaviour (auto-scroll, the no-op highlight colour) and add a one-line "what this is".

---

## 9. Final recommendation

**B — Good Foundation, Targeted UX Improvements Needed.**

The product intent is clear, the core listening experience is well built, and the visual identity is calm and distinctive. There is one correctness bug to fix urgently (the navigation dead-end) and one strategic question for the business (how literally to pursue "spiritual wellness, not religious" — §6). Everything else is a focused list of specific, mostly low-to-medium-effort changes that would remove the "unfinished beta" feel, make the app consistent with itself, and pull the experience firmly toward the intended positioning — **without** a redesign and **without** losing what already works.

Recommended next step: triage [`UX_TRACKER.md`](./UX_TRACKER.md), confirm the P0 and the P1 systemic items, take the §6 positioning question to a product decision, then implement in tracker order.

---

## 10. Summary — good / improve / change / untouched / next / uncertain

- **Already good:** the Play screen and layered content model; audio infrastructure; visual identity and dark theme; About-screen voice; the trust posture (free, no ads, no competitive social layer, privacy-forward intent).
- **Should improve:** first-run and empty/loading/error states; microcopy; the transcript auto-scroll; the Library verse lists (human titles, search); the Streaks screen (honest metrics, dedupe); Settings (language surfacing, account deletion, sign-out placement); the WebView and Support screens.
- **Should change:** the Play-screen navigation dead-end (P0); the two-browse-UI duplication; the fabricated metrics; the Community podium; the "Change Path?" gate; the unlabeled top-of-screen devotional placement; the "We don't collect any data" claim.
- **Should remain untouched:** everything in §8.
- **What to do next:** fix the P0; take the positioning question (§6) to a product decision; work the tracker in priority order.
- **Genuinely uncertain / needs a business or product decision:**
  - How literally to pursue "wellness, not religious" — how far to soften "verse/chapter", how to present the devotional sign-off, whether to add theme/mood entry points.
  - Whether "Community Wisdom" should exist at all, or become a much quieter "what others found meaningful".
  - Whether Streaks deserves a top-level tab.
  - Whether the "Story" content for Ramayan/Mahabharat needs a disclosure that it's an expanded retelling (acknowledged and deferred in `VISION_ALIGNMENT.md` §1.4 — recorded here as still-open).
  - Content depth strategy — catalogue completeness varies widely by book (Ramayan has 2 chapters; Gita ~18).
  - **Not verified in this pass:** Hindi content end-to-end; Mahabharat and "Antar Kathaye" content; deep-link / OTA-update behaviour; Android rendering; real-device audio (background bed, lock-screen) — all reviewed from source only.
