# Mangalam — UX / Design Tracker

Living backlog of UX and design findings. Companion to [`UX_REVIEW.md`](./UX_REVIEW.md) (the narrative review) and [`DESIGN_PRINCIPLES.md`](./DESIGN_PRINCIPLES.md).

## How to use this file

1. **Before** any UX/design change, check whether it relates to an existing item here.
2. Update the existing item rather than creating a duplicate.
3. **Preserve the original Finding even if the Recommendation is later rejected or deferred** — record the decision in Notes, don't overwrite the Finding.
4. Mark **IMPLEMENTED** only when the change is actually shipped; **VERIFIED** only after the resulting experience has been re-reviewed.
5. Where several screens share a problem, use the systemic issue (UX-0x) and have screen items reference it.

**Classification:** GOOD · NEEDS IMPROVEMENT · NEEDS CHANGE
**Priority:** P0 (critical) · P1 (high value) · P2 (polish) · KEEP
**Status:** IDENTIFIED → REVIEWED → PLANNED → IN PROGRESS → IMPLEMENTED → VERIFIED · or REJECTED / DEFERRED
**Evidence:** SRC (code inspection) · LIVE (running-app walkthrough, 2026-08-27) · SRC+LIVE

---

## Summary

_Last updated: 2026-08-28 (batch 1 — PlayScreen navigation fix)_

| Metric | Count |
|---|---|
| Total findings | 76 |
| — GOOD / KEEP | 11 |
| — NEEDS IMPROVEMENT | 39 |
| — NEEDS CHANGE | 13 |
| — Systemic (UX-0x) | 15 |
| P0 | 1 (implemented) |
| P1 | 30 |
| P2 | 34 |
| KEEP | 11 |
| Implemented | 2 (PLAY-01, NAV-01) |
| Verified | 2 (PLAY-01, NAV-01 — simulator, 2026-08-28) |
| Deferred / Rejected | 1 (CONTENT-04) |
| Open | 73 |

### Change log

| Date | Batch | Tracker items | What shipped |
|---|---|---|---|
| 2026-08-28 | Batch 1 — PlayScreen navigation | PLAY-01, NAV-01 (+ PLAY-14, PLAY-15 recorded) | `navigateToVerse` in `src/screens/PlayScreen.tsx` now returns early when `!navigation.isFocused()`, so a verse ending while the listener is on another tab / backgrounded no longer drives `navigation.replace('Play')` from a stale unfocused screen — which previously collapsed the nav stack and stranded the user on the player with a dead close chevron. Verified on the running iOS app. |

---

## Systemic issues

| ID | Title | Classification | Priority | Status | Screens affected |
|---|---|---|---|---|---|
| UX-01 | Developer-facing microcopy & unfinished states in the UI | NEEDS CHANGE | P1 | IDENTIFIED | Home, Welcome, Play, all error paths |
| UX-02 | Two parallel content-browse implementations (Library detail vs Book Dashboard) | NEEDS CHANGE | P1 | IDENTIFIED | Library, BookDashboard, Home |
| UX-03 | Two streak widgets with different logic & week-start | NEEDS CHANGE | P1 | IDENTIFIED | Home, Streaks |
| UX-04 | Metrics not measured / mislabeled (Total Time, "streak", "completed") | NEEDS CHANGE | P1 | IDENTIFIED | Streaks, Home, Library, BookDashboard |
| UX-05 | Inconsistent loading states (skeleton vs bare spinner) | NEEDS IMPROVEMENT | P2 | IDENTIFIED | Library, Streaks, Community, BookDashboard, Play |
| UX-06 | Inconsistent headers & back affordances | NEEDS IMPROVEMENT | P2 | IDENTIFIED | all stack screens |
| UX-07 | "Support / donate" surfaced 3–4 ways, inconsistent labels | NEEDS IMPROVEMENT | P2 | IDENTIFIED | Settings, About, Support, (dead paywall) |
| UX-08 | Errors via Alert / silent failure; no retry affordances | NEEDS CHANGE | P1 | IDENTIFIED | Play, Library, BookDashboard, audio engine |
| UX-09 | Gamification cues inconsistent with positioning | NEEDS CHANGE | P1 | IDENTIFIED | Community, Streaks |
| UX-10 | Typography scale bypassed (hard-coded fontSize / fontWeight) | NEEDS IMPROVEMENT | P2 | IDENTIFIED | most screens |
| UX-11 | Content language framed only as "Voice Preference", buried | NEEDS IMPROVEMENT | P1 | IDENTIFIED | Settings, Play, Library |
| UX-12 | "Path" exclusivity model + "Change Path?" gate | NEEDS CHANGE | P1 | IDENTIFIED | Home |
| UX-13 | Scripture-first navigation only; no theme/topic/mood entry | NEEDS IMPROVEMENT | P2 (strategic) | IDENTIFIED | whole app |
| UX-14 | Generic tab icons + slug-mismatch icon/metadata fallback | NEEDS IMPROVEMENT | P2 | IDENTIFIED | Home, Library, MiniPlayer, Community |
| UX-15 | No "today" anchor for the daily habit | NEEDS CHANGE | P1 | IDENTIFIED | Home |

---

## Findings

### Onboarding — `WelcomeScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| ONB-01 | Welcome layout | [SRC+LIVE] Blank whitespace-only strings where tagline + input label were removed → a large empty void between "Mangalam" and the name field; looks unfinished | NEEDS IMPROVEMENT | Remove the dead elements or restore real copy | P1 | High | IDENTIFIED | Quick fix independent of ONB-02 |
| ONB-02 | Onboarding scope | [SRC+LIVE] Collects only a display name; no explanation of the practice, no language choice, no intent capture. The strong "what is Mangalam" copy lives only in Settings→About | NEEDS CHANGE | 2–3 screen intro: what the practice is → language → optional "what brings you here" → name | P1 | High | IDENTIFIED | Positioning-critical (POS-06). Feeds future theming (UX-13) |
| ONB-03 | "Begin Your Journey" CTA | [LIVE] "Journey" undefined at this point; button reads disabled until a name is typed, no helper text | NEEDS IMPROVEMENT | Clarify CTA; add helper text | P2 | Med | IDENTIFIED | Folds into ONB-02 |

### Login — `LoginScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| AUTH-01 | Terms link | [SRC+LIVE] "By signing in, you agree to our Terms of Service" — not tappable; no Terms/Privacy link on login | NEEDS IMPROVEMENT | Make Terms & Privacy tappable | P2 | High | IDENTIFIED | |
| AUTH-02 | Privacy claim | [SRC+LIVE] "We do not collect any of your personal data" (Login + Welcome-back) contradicts the Privacy Policy (email, usage, payment) and the implementation (email, progress, activity_log, bookmarks stored) | NEEDS CHANGE | Replace with an accurate, still-reassuring line | P1 | High | IDENTIFIED | Trust risk. Also WEB-03, POS |
| AUTH-03 | Email/password screen | [SRC] `AuthScreen` implemented but intentionally unrouted (CLAUDE.md §2) | KEEP | — | KEEP | High | REVIEWED | Temporarily exposed for this review, reverted |

### Home — `HomeScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| HOME-01 | Empty state | [SRC+LIVE] New user: "My Current Path" header over a ~700px void; screen ~50% blank, nothing to do today | NEEDS CHANGE | Design the empty state; add a "Today" pick (UX-15) | P1 | High | IDENTIFIED | ref UX-15 |
| HOME-02 | Resume card refresh | [SRC+LIVE] Card does not refresh within a session after listening — stale until force-relaunch (`hasLoadedRef` guard blocks the focus reload) | NEEDS CHANGE | Refresh resume state on focus after playback | P1 | High | IDENTIFIED | Primary "continue" surface is wrong when it matters |
| HOME-03 | Resume card copy | [SRC+LIVE] "Resume at 20s" / "Resume is unavailable until remote progress exists" / "Your current path will appear here after you start a verse" | NEEDS IMPROVEMENT | Human copy | P1 | High | IDENTIFIED | ref UX-01 |
| HOME-04 | "Change Path?" gate | [SRC+LIVE] Blocking alert on tapping any non-active book; for a new user: "…focused on the No recent verse path. Subtle persistence leads to deeper wisdom…" | NEEDS CHANGE | Remove the gate; free movement; keep "Continue" as default | P1 | High | IDENTIFIED | ref UX-12, POS-03 |
| HOME-05 | Dead greeting code | [SRC] `getGreeting()` (time-of-day) unused; header always "Namaste, {name}" | NEEDS IMPROVEMENT | Use it or delete it | P2 | High | IDENTIFIED | |
| HOME-06 | "studying" language | [LIVE] "See what others are studying today" — study framing | NEEDS IMPROVEMENT | "finding meaningful" | P2 | Med | IDENTIFIED | ref POS-07 |
| HOME-07 | Explore grid redundancy | [LIVE] Same 4 book cards as the Library tab | NEEDS IMPROVEMENT | Differentiate or route both into one browse flow | P2 | High | IDENTIFIED | ref UX-02 |
| HOME-08 | Animated background | [LIVE] `DynamicBackground` orbs — subtle, calm, works | KEEP | — | KEEP | High | REVIEWED | |
| HOME-09 | Streak widget divergence | [SRC+LIVE] Home "This Week" differs from Streaks tab in start-day (Mon vs Fri) and logic | NEEDS CHANGE | One shared widget | P1 | High | IDENTIFIED | ref UX-03 |
| HOME-10 | Populated resume card | [LIVE] When populated: gradient fill, book accent colour, clear "Continue" — good | KEEP | Minor: copy (HOME-03) | KEEP | High | REVIEWED | |

### Community Wisdom — `CommunityWisdomScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| COMM-01 | Competitive framing | [SRC+LIVE] Gold trophy #1, silver/bronze medals, "#1"–"#5", "TRENDING NOW / MOST INSPIRED / TOP SAVED" | NEEDS CHANGE | Reframe: no ranks/medals/"trending"; "what others found meaningful" | P1 | High | IDENTIFIED | ref UX-09, POS-05 |
| COMM-02 | Rows convey nothing | [LIVE] Every row is "Bhagavad Gita / Chapter 2, Verse 4" — no title, no snippet, no reason | NEEDS IMPROVEMENT | Show title + one-line why | P1 | High | IDENTIFIED | Depends on CONTENT-01 |
| COMM-03 | Section labels & subtitle | [LIVE] Engagement-app tone; "Discover what fellow seekers are finding inspired by" is grammatically broken | NEEDS IMPROVEMENT | Rewrite | P2 | High | IDENTIFIED | |
| COMM-04 | Empty state | [SRC] Empty sections just vanish | NEEDS IMPROVEMENT | Designed empty state | P2 | Med | IDENTIFIED | ref UX-05 |
| COMM-05 | Production data | [LIVE] Real `activity_log` aggregate; test-account listen/share/bookmark feeds public rankings | — | Behavioural note | — | High | REVIEWED | See TESTING.md |

### Book Dashboard — `BookDashboardScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| DASH-01 | Duplicate browse UI | [SRC+LIVE] Duplicates Library book-detail with a different layout (list vs grid) and presentation (modal vs in-tab) | NEEDS CHANGE | Merge into one browse flow | P1 | High | IDENTIFIED | ref UX-02 |
| DASH-02 | No verse browsing | [SRC+LIVE] Tapping a chapter jumps straight into playback; can't see a chapter's verse list from here | NEEDS IMPROVEMENT | Expand chapter → verse list | P2 | High | IDENTIFIED | |
| DASH-03 | Grammar | [LIVE] "across 1 chapters" | NEEDS IMPROVEMENT | Pluralise | P2 | High | IDENTIFIED | |
| DASH-04 | Cover art coverage | [SRC] Only Gita + Mahabharat wired; Ramayan/others use a generic icon though `ramayan-cover.jpg` exists | NEEDS IMPROVEMENT | Wire all covers | P2 | High | IDENTIFIED | ref UX-14 |
| DASH-05 | Decorative filler | [LIVE] Sparkle + book divider at the bottom | NEEDS IMPROVEMENT | Remove | P2 | Med | IDENTIFIED | |
| DASH-06 | Hero + calm copy | [LIVE] Hero art, Sanskrit title, "The Song of God", "Your journey begins here" — works | KEEP | — | KEEP | High | REVIEWED | |

### Play — `PlayScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| PLAY-01 | Navigation dead-end | [SRC+LIVE] `navigateToVerse` calls `navigation.replace('Play', …)`. It is also invoked from the audio store's `onFinish` callback when a verse ends. If the listener has navigated away (mini-player showing / app on another tab / backgrounded), that stale, unfocused `navigation` dispatches `replace('Play')` against a stack that no longer contains Play — collapsing the root to a lone Play route with no parent. The close chevron then fires an unhandled `GO_BACK` and the listener is stranded on the player (silent no-op in production; red toast in dev). | NEEDS CHANGE | Guard `navigateToVerse` with `navigation.isFocused()` — only the focused PlayScreen drives stack navigation; when unfocused, let playback simply end and the mini-player / resume state carry the session | **P0** | High | **IMPLEMENTED** | ref NAV-01, PLAY-14. Fix: early `return` in `navigateToVerse` (`src/screens/PlayScreen.tsx`) when `!navigation.isFocused()`. Verified on simulator 2026-08-28: verse finishing while on another tab no longer navigates or breaks the chevron; prev/next buttons, mini-player→Play→close, and normal open/close all still work; no `GO_BACK` errors post-fix; `tsc` clean. |
| PLAY-02 | Silent no-audio state | [SRC] No audio asset → empty player (0:00/0:00), play does nothing, no message | NEEDS IMPROVEMENT | Explicit "audio unavailable" state | P1 | Med | IDENTIFIED | Not reproduced live — all tested verses had audio |
| PLAY-03 | Swallowed playback errors | [SRC] Audio-engine `status.error` handler is empty | NEEDS IMPROVEMENT | Surface + retry | P1 | High | IDENTIFIED | ref UX-08 |
| PLAY-04 | Auto-scroll fights reader | [SRC+LIVE] Every position tick calls `scrollTo`; reading ahead/back is undone within ~1s | NEEDS IMPROVEMENT | Pause auto-scroll while user scrolls; resume after idle | P1 | High | IDENTIFIED | |
| PLAY-05 | Dead paywall branch | [SRC] "Daily Limit Reached / Become a Supporter" branch still present (app is free forever) | NEEDS IMPROVEMENT | Delete | P2 | High | IDENTIFIED | ref VISION_ALIGNMENT §6; POS |
| PLAY-06 | Sign-off placement | [SRC+LIVE] Ramayan/Mahabharat sign-off ("जय श्री राम"/"जय श्री कृष्ण") stored in the source-text field → rendered large, centered, orange, unlabeled, **at the top** of every episode | NEEDS IMPROVEMENT | Move to end; add label ("A traditional closing blessing"). Keep the sign-off | P1 | High | IDENTIFIED | ref POS-02. Sign-off itself is a settled decision |
| PLAY-07 | Generation artifacts | [SRC+LIVE] "Welcome to today's lesson. We are in Chapter 1 Verse 1" as transcript; "mine ness"; commentary re-stating "Chapter 1 Verse 1" | NEEDS IMPROVEMENT | Strip intro line + numbering from displayed text; content QA | P2 | High | IDENTIFIED | ref CONTENT-03 |
| PLAY-08 | Sanskrit highlight no-op | [SRC] `HighlightedText` gets `activeColor === inactiveColor` for the Sanskrit block | NEEDS IMPROVEMENT | Give the Sanskrit a real active colour or drop the highlight there | P2 | High | IDENTIFIED | |
| PLAY-09 | Header context | [SRC+LIVE] Header only ever says "NOW PLAYING"; no book/chapter once the cover scrolls away | NEEDS IMPROVEMENT | Show book · chapter in the header | P2 | High | IDENTIFIED | |
| PLAY-10 | No sleep timer | [SRC] Missing, despite About suggesting bedtime listening | NEEDS IMPROVEMENT | Add a sleep timer | P2 | High | IDENTIFIED | |
| PLAY-11 | Focus mode | [LIVE] Enlarges text, hides chrome — genuinely good for reading; "expand/contract" icon meaning unclear | KEEP | Relabel / onboard the affordance | KEEP | High | REVIEWED | |
| PLAY-12 | Core layered experience | [LIVE] Labeled layers, cover art, speed, skip-15, prev/next, auto-advance, bookmark, share — all work; audio reliable for Gita + Ramayan | KEEP | — | KEEP | High | REVIEWED | Product's strongest asset |
| PLAY-13 | Sanskrit with no context | [LIVE] Sanskrit lands first, large, orange, with no "what this is" for a newcomer | NEEDS IMPROVEMENT | One-line plain-language framing above the Sanskrit | P2 | High | IDENTIFIED | ref POS-04 |
| PLAY-14 | No background auto-advance | [LIVE] Deliberate consequence of the PLAY-01 fix: when a verse ends while the listener is on another tab or the app is backgrounded, playback now simply stops instead of auto-advancing to the next verse. Aligns with "daily habit over binge consumption" (`CLAUDE.md` §3). If continuous background listening is later wanted, it must be driven by the audio store (loading the next verse's audio) — never by screen navigation. | NEEDS CHANGE | Accept as-is for now; revisit only if product wants background continuous play | P2 | High | REVIEWED | Introduced 2026-08-28 with the PLAY-01 fix |
| PLAY-15 | Play/pause icon desync | [LIVE] Observed intermittently during testing: the large play/pause button shows the "play" triangle while audio is actually playing (transcript scrolling, timer advancing). `isPlaying` state lags the real player state. Pre-existing; not caused by the PLAY-01 fix. | NEEDS IMPROVEMENT | Drive the button purely from the player's reported status | P2 | Medium | IDENTIFIED | Noticed while verifying PLAY-01 |

### Mini Player — `MiniPlayer`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| MINI-01 | Cryptic title | [SRC+LIVE] "BG 1.2" for books without verse titles; Ramayan (has titles) shows the title | NEEDS IMPROVEMENT | Always show a human title | P2 | High | IDENTIFIED | Depends on CONTENT-01 |
| MINI-02 | Missing font family | [SRC] References 'Inter-SemiBold'/'Inter-Regular'; app bundles Outfit → silent fallback | NEEDS IMPROVEMENT | Use theme font tokens | P2 | High | IDENTIFIED | ref UX-10 |
| MINI-03 | Dense controls | [LIVE] 6 controls (prev / −15 / play / +15 / next / ✕); persistent; hides correctly on Play; progress line | KEEP | Consider 3 controls + tap-through | KEEP | High | REVIEWED | |

### Library — `LibraryScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| LIB-01 | Three-level in-tab drilldown | [SRC+LIVE] Books → Chapters → Verses with custom "Books"/"Back" pills, no native headers | NEEDS IMPROVEMENT | One browse flow; consistent header | P2 | High | IDENTIFIED | ref UX-02, UX-06 |
| LIB-02 | Chapter tile layout | [SRC+LIVE] Number above the word "Chapter" ("1 / Chapter"); nested play button inside the tappable tile | NEEDS IMPROVEMENT | "Chapter 1"; one tap target or clearly separated | P2 | High | IDENTIFIED | |
| LIB-03 | Gita verse list unscannable | [LIVE] Raw Sanskrit as the primary line (some with "।।1.3।।"); no English hint. Ramayan list (descriptive titles) is the model that works | NEEDS IMPROVEMENT | Human title for every unit | P1 | High | IDENTIFIED | ref CONTENT-01; positioning |
| LIB-04 | No search / filter | [SRC+LIVE] Nothing, for ~700 Gita verses | NEEDS IMPROVEMENT | Add search + filter | P1 | High | IDENTIFIED | |
| LIB-05 | Bare spinner | [SRC+LIVE] No skeleton | NEEDS IMPROVEMENT | Skeleton | P2 | High | IDENTIFIED | ref UX-05 |
| LIB-06 | "Completed" on open | [SRC+LIVE] Verses marked ✓ on open (`addCompletedVerse` on load), not on completion | NEEDS IMPROVEMENT | Mark complete on actual completion | P2 | High | IDENTIFIED | ref UX-04 |

### Streaks / "Your Journey" — `StreaksScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| STREAK-01 | Fabricated "Total Time" | [SRC+LIVE] `streakCount × 10m`, shown "~10m", unrelated to actual listening | NEEDS CHANGE | Remove, or make it real (measured listening time) | P1 | High | IDENTIFIED | ref UX-04 |
| STREAK-02 | "streak" not consecutive | [SRC+LIVE] Count of usage-day rows in last 30, labeled "N Day Journey" | NEEDS IMPROVEMENT | Relabel honestly ("days practised"), or compute a real streak | P1 | High | IDENTIFIED | ref UX-04 |
| STREAK-03 | Broken emoji glyph | [LIVE] 🔥 in "Day Journey 🔥" renders as a missing-glyph box on the test device | NEEDS IMPROVEMENT | Use an icon component, not a raw emoji | P2 | High | IDENTIFIED | |
| STREAK-04 | Duplicate week widget | [SRC+LIVE] Different from Home's; different week start ("F S S M T W T"), no dates | NEEDS CHANGE | One shared widget | P1 | High | IDENTIFIED | ref UX-03 |
| STREAK-05 | Thin tab | [LIVE] One number + 7 dots + 2 tiles | NEEDS IMPROVEMENT | Fold into Home or a "Journey" section | P2 | Med | IDENTIFIED | |
| STREAK-06 | Gamified cues | [LIVE] Flame + "Day Journey 🔥" vs the gentle "consistency over intensity" copy | NEEDS IMPROVEMENT | Reduce flame/"journey-count" cues; keep the copy | P2 | High | IDENTIFIED | ref UX-09, POS-05 |
| STREAK-07 | Encouragement copy | [LIVE] "Consistency over intensity. Ten minutes a day…" | KEEP | — | KEEP | High | REVIEWED | |

### Settings — `SettingsScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| SET-01 | Sign-out placement | [SRC+LIVE] Small red door icon right of the "Settings" title; jarring, mis-tap risk (confirmation alert mitigates) | NEEDS IMPROVEMENT | Move into the Account card as a normal row | P2 | High | IDENTIFIED | |
| SET-02 | Language buried & mislabeled | [SRC+LIVE] Only via "Voice Preference"; no switch at point of use | NEEDS IMPROVEMENT | Rename "Language & Voice"; expose a language toggle in the player | P1 | High | IDENTIFIED | ref UX-11 |
| SET-03 | Filler row | [SRC+LIVE] "Plan: Free & Ad-free" | NEEDS IMPROVEMENT | Remove or make meaningful | P2 | High | IDENTIFIED | |
| SET-04 | Support entry sprawl | [SRC+LIVE] Here + About (×2) + dedicated screen; "Support Mangalam" vs "Become a Supporter" | NEEDS IMPROVEMENT | One entry + one contextual mention; consistent label | P2 | High | IDENTIFIED | ref UX-07 |
| SET-05 | Narration floor 0.7 | [SRC] Narration can't go below 70% | NEEDS IMPROVEMENT | Widen the range | P2 | High | IDENTIFIED | |
| SET-06 | No account deletion | [SRC+LIVE] Missing; App Store Guideline 5.1.1(v) requires in-app account deletion | NEEDS CHANGE | Add account deletion | P1 | High | IDENTIFIED | Compliance risk |
| SET-07 | No bookmarks / downloads / notification settings | [SRC] Missing | NEEDS IMPROVEMENT | Add bookmarks management at least | P2 | Med | IDENTIFIED | |
| SET-08 | Structure & controls | [LIVE] Clear sections, voice cards, sliders, inline name edit | KEEP | — | KEEP | High | REVIEWED | |
| SET-09 | Dark theme | [LIVE] Toggled live — warm charcoal, consistent accents, readable | KEEP | — | KEEP | High | REVIEWED | |

### About / "Our Philosophy" — `AboutScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| ABOUT-01 | Copy quality | [LIVE] Excellent, precisely on-positioning; honest disclaimer | KEEP | Surface a short version in onboarding | KEEP | High | REVIEWED | ref ONB-02 |
| ABOUT-02 | Length & duplication | [SRC+LIVE] ~14 stacked cards; Support section duplicated verbatim on the Support screen | NEEDS IMPROVEMENT | Trim; de-duplicate | P2 | High | IDENTIFIED | ref UX-07, SUP-03 |
| ABOUT-03 | Loud headers | [LIVE] ALL-CAPS orange section headers for a "quiet space" | NEEDS IMPROVEMENT | Soften | P2 | Med | IDENTIFIED | |
| ABOUT-04 | Three names for one destination | [SRC+LIVE] "Our Philosophy" / "About Us" / "About" | NEEDS IMPROVEMENT | Pick one | P2 | High | IDENTIFIED | ref UX-06 |

### Support — `SupportMangalamScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| SUP-01 | Currency & clipped button | [SRC+LIVE] "Support with €5 / Custom Amount" — euro hard-coded; label wraps and is clipped by the card top | NEEDS IMPROVEMENT | Localise/drop currency; fix button layout | P2 | High | IDENTIFIED | `highlightedButton` scale(1.02) overflows its container |
| SUP-02 | External hand-off, no return | [SRC] Opens Stripe in Safari; no in-app return / acknowledgement; `accountStatus` never updates | NEEDS IMPROVEMENT | Gentle "thank you" state on return | P2 | High | IDENTIFIED | `accountStatus` non-wiring is intentional (VISION_ALIGNMENT §6) |
| SUP-03 | Duplicates About | [LIVE] Same "PRIVATE INITIATIVE" / mission text as About | NEEDS IMPROVEMENT | De-duplicate | P2 | High | IDENTIFIED | ref ABOUT-02, UX-07 |

### WebView — `WebViewScreen`

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| WEB-01 | Bare chrome | [SRC+LIVE] Back arrow only — no title, no loading indicator, no error state, no "open in browser" | NEEDS IMPROVEMENT | Titled header + loading/error + open-in-browser | P2 | High | IDENTIFIED | |
| WEB-02 | Embedded site chrome & type clash | [LIVE] Page's own "← Back to Home" link is confusing in-app; serif site type vs app's Outfit | NEEDS IMPROVEMENT | Hide site chrome, or open legal pages in the browser | P2 | High | IDENTIFIED | |
| WEB-03 | Privacy page contradicts "no data" claim | [LIVE] Policy states email/usage/payment collected | NEEDS CHANGE | Align app copy with the policy | P1 | High | IDENTIFIED | ref AUTH-02 |

### Navigation (cross-cutting)

| ID | Screen / Function | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| NAV-01 | `GO_BACK` dead-end | [SRC+LIVE] Play screen shows an unhandled `GO_BACK` on the close chevron; swipe-dismiss also fails. Root cause (confirmed by reproduction): an **unfocused** PlayScreen driving `navigation.replace('Play')` via the audio store's `onFinish` callback — not the modal-dismiss sequence originally hypothesised. See PLAY-01. | NEEDS CHANGE | See PLAY-01 | **P0** | High | **IMPLEMENTED** | Fixed with PLAY-01 (focus guard in `navigateToVerse`). Verified on simulator 2026-08-28. |
| NAV-02 | Modal-over-tabs vs in-tab | [SRC+LIVE] Home→Dashboard→Play hides the tab bar; Library's parallel flow keeps it | NEEDS IMPROVEMENT | One navigation model for browse→play | P1 | High | IDENTIFIED | ref UX-02, UX-06 |
| NAV-03 | Five header styles | [SRC+LIVE] chevron-down modal / "Books"/"Back" pills / ALL-CAPS SafeAreaView / centered chevron-back | NEEDS IMPROVEMENT | One header component & back convention | P2 | High | IDENTIFIED | ref UX-06 |

### Positioning (spiritual wellness vs religious)

| ID | Area | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| POS-01 | "Verse/Chapter" everywhere | [LIVE] Primary unit surfaced as "Chapter N · Verse M" even for Ramayan story episodes — reads as scripture study | NEEDS IMPROVEMENT | Friendly secondary label ("Reflection 12"); keep the canonical ref available | P2 | Med | IDENTIFIED | Needs product decision on how far to go |
| POS-02 | Sign-off unlabeled & at top | [SRC+LIVE] See PLAY-06 | NEEDS IMPROVEMENT | Move to end; label it | P1 | High | IDENTIFIED | Sign-off stays (VISION_ALIGNMENT §6) |
| POS-03 | "Current Path" / forced path / "deeper wisdom" | [LIVE] Discipline/study framing on discovery | NEEDS CHANGE | Soften language; remove the gate (UX-12) | P1 | High | IDENTIFIED | |
| POS-04 | Sanskrit with no framing | [LIVE] See PLAY-13 | NEEDS IMPROVEMENT | One-line "what this is" | P2 | High | IDENTIFIED | |
| POS-05 | "Day Journey 🔥" + Community podium | [LIVE] Habit-app / competition cues | NEEDS CHANGE | De-gamify (UX-09) | P1 | High | IDENTIFIED | |
| POS-06 | Onboarding lacks practice framing | [LIVE] See ONB-02 | NEEDS CHANGE | Reframe onboarding | P1 | High | IDENTIFIED | |
| POS-07 | "studying" on Home | [LIVE] See HOME-06 | NEEDS IMPROVEMENT | "finding meaningful" | P2 | Med | IDENTIFIED | |
| POS-08 | What already works | [LIVE] Palette, type, spacing, ambient audio; About voice; "consistency over intensity"; privacy-first; audio-first; free/no-ads; non-sensational tone | KEEP | Protect deliberately | KEEP | High | REVIEWED | See UX_REVIEW §8 |

### Content quality / consistency

| ID | Area | Finding | Class | Rec | Pri | Conf | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| CONTENT-01 | Missing verse titles (Gita) | [LIVE] Gita verses lack descriptive titles (list shows Sanskrit); Ramayan verses have them | NEEDS IMPROVEMENT | A human title for every content unit, every book | P1 | High | IDENTIFIED | Unblocks LIB-03, COMM-02, MINI-01 |
| CONTENT-02 | Book-name inconsistency | [LIVE] "Ramayan" vs "Ramayana"; "Mahabharat" vs "Mahabharata"; slug `AntarKathaye` | NEEDS IMPROVEMENT | One canonical display name per book, resolved via identity cache | P2 | High | IDENTIFIED | ref UX-14 |
| CONTENT-03 | Generation artifacts in body text | [LIVE] "Welcome to today's lesson…" as transcript; "mine ness"; "Chapter 1 Verse 1" in commentary | NEEDS IMPROVEMENT | Strip on display; content QA pass | P2 | High | IDENTIFIED | ref PLAY-07 |
| CONTENT-04 | "Story" = undisclosed LLM retelling | [SRC+LIVE] Ramayan/Mahabharat "Story" is a "recreate and expand" dramatisation with invented detail, shown under a plain "Story" label | NEEDS IMPROVEMENT | (Disclosure decision) | P2 | High | **DEFERRED** | Acknowledged & deferred in VISION_ALIGNMENT §1.4 / §6. Finding preserved; no action now |
| CONTENT-05 | Catalogue depth varies | [LIVE] Ramayan has 2 chapters (48 + 52 episodes); Gita ~18 chapters | — | Product/content-strategy note | — | High | REVIEWED | Not a UX defect |

---

## Top 10 highest-value improvements — status

| # | Change | Tracker refs | Priority | Status |
|---|---|---|---|---|
| 1 | Fix the Play-screen `GO_BACK` dead-end | PLAY-01, NAV-01 | P0 | **IMPLEMENTED** (verified on simulator 2026-08-28) |
| 2 | Home "Today" anchor + fix stale/empty resume card | HOME-01, HOME-02, UX-15 | P1 | IDENTIFIED |
| 3 | Rebuild onboarding around the practice; fix blank strings | ONB-01, ONB-02, POS-06 | P1 | IDENTIFIED |
| 4 | Replace developer microcopy; design every empty/loading/error state | UX-01, UX-05, UX-08, HOME-03 | P1 | IDENTIFIED |
| 5 | Consolidate the two content-browse UIs | UX-02, DASH-01, LIB-01, NAV-02 | P1 | IDENTIFIED |
| 6 | Honest metrics + one streak widget | UX-03, UX-04, STREAK-01, STREAK-02, STREAK-04 | P1 | IDENTIFIED |
| 7 | De-gamify Community Wisdom | UX-09, COMM-01, POS-05 | P1 | IDENTIFIED |
| 8 | Remove the "Change Path?" gate; free movement between books | UX-12, HOME-04, POS-03 | P1 | IDENTIFIED |
| 9 | Tame the transcript auto-scroll | PLAY-04 | P1 | IDENTIFIED |
| 10 | Language at point of use · sleep timer · account deletion · human titles for every unit | UX-11, SET-02, SET-06, PLAY-10, CONTENT-01 | P1 / P2 | IDENTIFIED |

---

## Decision log

| Date | Item(s) | Decision | Rationale |
|---|---|---|---|
| 2026-08-27 | CONTENT-04 | Deferred — no disclosure change to existing "Story" content now | Consistent with `VISION_ALIGNMENT.md` §1.4 / §6 (acknowledged gap, grandfathered). Finding preserved for a future pillar decision. |
| 2026-08-27 | PLAY-05, POS (paywall) | Recorded as cleanup, not re-enable | App is free forever (`VISION_ALIGNMENT.md` §6). |
| 2026-08-27 | PLAY-06 / POS-02 | Sign-off stays; only placement + label change proposed | Devotional sign-off is a settled brand decision (`VISION_ALIGNMENT.md` §6). |
| 2026-08-28 | PLAY-01 / NAV-01 | Fixed by guarding `navigateToVerse` with `navigation.isFocused()` (smallest correct change: only the focused screen drives navigation). Accepted side effect: a verse ending while the app is on another screen / backgrounded now stops rather than auto-advancing (see PLAY-14). | Fixes the P0 at the root — an unfocused screen should never dispatch stack navigation. Background continuous-play, if wanted later, belongs in the audio store, not in navigation. Aligns with "daily habit over binge consumption" (`CLAUDE.md` §3). |
