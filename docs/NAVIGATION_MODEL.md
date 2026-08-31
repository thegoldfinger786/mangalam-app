# Mangalam — Navigation & Information-Architecture Model (proposal)

Status: **All stages shipped (PRs #40, #49, #64).** Prepared
2026-08-30 for the tracker cluster **UX-02 / DASH-01 / LIB-01 / NAV-02 / NAV-03 /
HOME-07**. The user-visible consolidation is done: one in-tab browse flow, the
modal `BookDashboardScreen` deleted, its hero/progress/CTA folded into the
Library book view, Home's duplicate Explore grid replaced by a single "Browse
the library" entry, a shared `ScreenHeader`. **Stage 3** — the internal
`useState` → `createNativeStackNavigator` refactor (`LibraryStack`), no
user-visible change — shipped in PR #64; see §5.

This document only concerns *how the user moves between browse and play*. It does
**not** change the sunrise aesthetic, card visual language, the Play screen, the
audio experience, streaks, or content. It is refinement, not redesign — consistent
with `CLAUDE.md`'s "extend, don't fork" rule and `DESIGN_PRINCIPLES.md` §"One of
each" ("One browse flow, not a Library screen and a separate Book Dashboard …
One header component and one back convention").

---

## 1. The two flows today

### Flow A — Home → Book Dashboard → Play

```
Home tab
  ├─ "Continue" card ─────────────► Play           (modal, slide-up)   [if resume state]
  │                              └► BookDashboard   (modal, slide-up)   [otherwise]
  └─ "Explore Paths" grid (4 BookCards) ─► BookDashboard (modal, slide-up)
        BookDashboard: hero art · progress sentence · "Start Chapter N Verse M" CTA ·
                       chapter list with progress bars
          └─ tap a chapter ──────► Play (modal)   — jumps straight to the first
                                                    unfinished verse; NO verse list
        header: chevron-DOWN (modal dismiss)
```

### Flow B — Library tab → in-tab drilldown → Play

```
Library tab
  └─ 2-col BookCard grid (the SAME 4 books as Home's Explore Paths)
       └─ tap a book ──► in-tab book view      (setState, tab bar stays)
            search bar (verse titles) · chapter TILE grid
            header: "Books" pill (custom)
              └─ tap a chapter ──► in-tab verse LIST   (setState)
                   header: "Back" pill (custom) · "Chapter N"
                     └─ tap a verse ──► Play (modal)
```

### What's wrong (the findings)

| Finding | Problem |
|---|---|
| UX-02 / DASH-01 | Two separate implementations of "browse one book" — `BookDashboardScreen` (grid-ish, modal) and `LibraryScreen`'s in-tab detail (tiles, setState). Different layout, different presentation, different code. |
| NAV-02 | Home→browse is a **modal over the tabs**; Library→browse is **in-tab**. Same task, two mental models. |
| LIB-01 | Library is a 3-level in-tab drilldown driven by `useState` (`selectedBook` / `selectedChapter`), with hand-rolled "Books" / "Back" pills instead of stack navigation + a real header. No deep-linkable screens, no OS back-gesture semantics. |
| NAV-03 | Five header treatments across the app: modal chevron-down (BookDashboard, Play, Community) · "Books"/"Back" pills (Library) · plain SafeAreaView title (About/Support) · centered chevron-back. |
| HOME-07 | Home's "Explore Paths" grid is the same four `BookCard`s as the Library tab — a literal duplicate list. |

---

## 2. Principle

**Home is for *resuming and entry points*. Library is for *browsing*.** They
should not each own a browse implementation — Home should *route into* the
Library's browse screens.

- **Browse** (pick a book → pick a chapter → pick a verse) is an *in-tab, pushed*
  navigation with the tab bar visible and one consistent header. It is where you
  wander the catalogue.
- **Play** stays a **modal** (`slide_from_bottom`). It is the focused "now
  playing" surface; a modal is correct and is already the one consistent thing
  across both entry points. Keep it.

---

## 3. Target model

```
Library tab  ►  Library stack
  Books grid  ──push──►  BookDetail  ──push──►  ChapterVerses  ──► Play (modal)
                            │
                            └─ hero · progress · "Continue" CTA · chapter list
                               (this is today's BookDashboard content, in-tab)

Home tab
  "Continue" card ──► Play (modal, autoplay)          [resume state]
                  └─► Library stack ▸ BookDetail       [no resume state]
  "Browse the library" entry ──► Library tab ▸ Books grid
```

- **One `BookDetail` screen** = today's `BookDashboardScreen` content (hero art,
  progress sentence, Continue/Start CTA) **placed above** the Library book view's
  existing chapter list + verse-title search. `BookDashboardScreen` is deleted.
- **`ChapterVerses`** = today's Library in-tab verse list, promoted to a real
  pushed screen. Tapping a chapter opens the verse list (as Library does now) —
  **not** an immediate jump to Play (that BookDashboard behaviour is a shortcut
  that hides the verse list; the "Continue" CTA on `BookDetail` already covers
  "just take me to the next verse").
- **One `ScreenHeader`** — back chevron-left + centered title — on every pushed
  stack screen (`BookDetail`, `ChapterVerses`, `About`, `SupportMangalam`,
  `CommunityWisdom` if it stays a screen). `chevron-down` is reserved for true
  modals (`Play` only). Replaces the "Books"/"Back" pills and BookDashboard's
  chevron-down.
- **Home's Explore Paths** stops being a second 4-book grid. It becomes a single
  entry into the Library tab (a "Browse the library →" row, or a compact
  horizontal strip that scrolls) — the authoritative grid lives in Library. The
  "coming soon" tiles (Upanishads etc.) move with it.

### What each finding gets from this

- **UX-02 / DASH-01** — one browse implementation; `BookDashboardScreen` removed.
- **NAV-02** — browse is in-tab from both Home and Library; only Play is modal.
- **LIB-01** — `selectedBook`/`selectedChapter` `useState` becomes real pushed
  screens with OS back semantics and a real header.
- **NAV-03** — one `ScreenHeader`; chevron-down means "modal" and nothing else.
- **HOME-07** — the duplicate grid is gone; Home points at the one in Library.

---

## 4. Explicitly out of scope / keep as-is

- The Play screen, its modal presentation, transcript, focus mode, sign-off.
- `MiniPlayer` (persistent, already correct).
- Card visual language, colours, icons, the sunrise gradient.
- Streaks / `WeeklyStreak` / resume-journey logic.
- Tab set (Home / Library / Journey / Settings).
- Content, titles, audio.
- Bookmarks tab or new filters (LIB-04 shipped title search only; structured
  filters remain a separate later decision).

A **visual design pass on the merged `BookDetail` screen** is a prerequisite for
stage 2/3 below — combining the hero+progress block with the chapter list is a
layout question, not just a wiring one.

---

## 5. Staged implementation (each stage ships on its own)

| Stage | Change | Findings closed / advanced | Risk |
|---|---|---|---|
| ~~1~~ ✅ | Add a shared `ScreenHeader` (chevron-left + centered title). Adopt in Library's book & chapter views, `About`, `SupportMangalam`. | NAV-03 (partial) | Low — presentational |
| ~~2~~ ✅ | Lift `BookDashboardScreen`'s hero + progress + "Continue" CTA into a reusable block; render it at the top of the Library in-tab book view. Chapter tap → verse list (stop the jump-to-Play shortcut). | UX-02 / DASH-01 (partial), design pass here | Low–med — layout |
| ~~3~~ ✅ | Convert Library's `useState` into a real `createNativeStackNavigator` (`LibraryStack`): `LibraryBooks → BookDetail → ChapterVerses`. Tab bar kept, per-screen `ScreenHeader`, verses shared via a session cache. `LibraryScreen.tsx` deleted. (PR #64) | LIB-01 | done |
| ~~4~~ ✅ | Point Home's Explore/Continue at `BookDetail` in the Library stack. Make the `BookDashboard` route an alias, then delete `BookDashboardScreen`. | UX-02, DASH-01, NAV-02 | Med — cross-tab navigation |
| ~~5~~ ✅ | Replace Home's 4-book Explore grid with a single entry into the Library tab; move the "coming soon" tiles. | HOME-07 | Low |

Stop after any stage and the app is still coherent. Do **not** start stage 3
without stages 1–2 merged, and do not start the cluster at all without a design
pass on the stage-2 `BookDetail` layout.

---

## 6. Open questions for a product/design call before stage 2

1. **`BookDetail` layout** — does the hero+progress block sit *above* a full
   chapter list on one scroll, or is it a compact header that the chapter list
   scrolls under? (Design pass.)
2. **Chapter tap target** — verse list only, or verse list with a secondary
   "start chapter" affordance? (The BookDashboard shortcut had value for the
   daily-habit user.)
3. **Home's Explore entry** — a single "Browse the library →" row, or a compact
   horizontally-scrolling strip of books? The strip keeps books one tap from
   Home; the row is the strongest de-duplication.
4. **`CommunityWisdom`** — currently a modal off Home. Under the "chevron-down =
   modal" rule it can stay modal, or become a pushed screen with `ScreenHeader`.
   Low stakes; decide when stage 1 lands.
