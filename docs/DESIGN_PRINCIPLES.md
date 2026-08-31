# Mangalam — Design Principles

Durable design principles for Mangalam, derived from the actual app (see [`UX_REVIEW.md`](./UX_REVIEW.md)) and the product vision (`CLAUDE.md`, `docs/VISION_ALIGNMENT.md`). Use these as a reference point when designing or reviewing any change. They are specific to Mangalam — not a generic UX checklist.

When a proposed change conflicts with one of these, that's a signal to stop and discuss, not to quietly override it.

---

## 0. Positioning: an inclusive spiritual-wellness experience, not a religious app

Mangalam should feel like an app someone opens for a few quiet minutes of spiritual well-being — the way they might open an app for their mental or physical health — **not** like a devotional app, a scripture-study tool, or a temple-services app.

- Someone who is spiritual but not conventionally religious should feel welcome. Someone curious about Indian wisdom with no background in Hindu tradition should be able to understand and enjoy it.
- **Invite, don't prescribe.** Lead with the practice and a plain-language "what this is". Never require the user to identify as religious or already know the tradition.
- **Do not dilute the authenticity to get there.** Keep the Sanskrit, the source names, the devotional sign-off, the depth. The move is *framing*, not removal: the tradition stays fully present underneath an accessible, calm surface.
- The target feeling is *"this is my time for spiritual well-being"*, not *"this is my religious app"*.

---

## 1. Content is the focal point; controls support it, never compete with it

The Play screen earns this: cover art, then the layered text, with a quiet floating control bar. Keep it that way. New controls, badges, prompts, or promos on the reading/listening surface must justify taking attention away from the words.

## 2. Always show the layer

Never blur the four (or five) layers of a piece of content: source text (Sanskrit, or none for pure narrative), the narrative rendering (translation or story), commentary, daily-life application, and practical examples. Each stays independently labeled in the UI. This separation is the product's core differentiator — a user should always know which layer they are consuming. Where a layer is an interpretive or LLM-expanded rendering, that should be disclosed, not hidden under a neutral label.

## 3. Speak like a calm companion — not a scripture teacher, not a growth-hacker

- No implementation language in the UI ("Resume at 20s", "…until remote progress exists").
- No scolding or discipline framing ("Subtle persistence leads to deeper wisdom", "Are you sure you want to change paths?").
- No engagement-app vocabulary ("Trending Now", "Most Inspired", streak-anxiety).
- The register to match is the About screen and "Consistency over intensity. Ten minutes a day."

## 4. One honest number beats three impressive ones

Only show a metric the app actually measures, and label it literally. "Days practised" (a real count), not "Day Journey" over a fabricated "Total Time". If a number can't be made true and clear, don't show it. A calm, trustworthy product cannot display invented statistics.

## 5. Every day gives the user one clear thing to do now

A daily-habit product must answer *"I have ten minutes"* without making the user choose from a catalogue or face an empty screen. Home should always offer one framed reflection to start now, alongside the option to resume or explore. Design the empty state as carefully as the full one.

## 6. Gentle guidance over hard gates

Default to "Continue" and offer a clear next step, but never **block** the core loop: no usage caps, no confirmation-nags on discovery, no forced single "path". Let people wander the library the way they would browse a wellness catalogue.

## 7. Progress is a felt sense of continuity, not a score

Resume state, a quiet weekly rhythm, a sense of "you've spent time with this teaching" — not flames, podiums, medals, or ranks. Social proof, if shown at all, is *"what others are finding meaningful"*, never a leaderboard. Deliberately keep resisting friend graphs, points, badges, and quizzes.

## 8. Extend one pattern; don't fork it

One browse flow (not a Library screen and a separate Book Dashboard). One weekly-streak component (not two with different week starts). One "Support" entry in Settings plus one contextual mention. One header component and one back convention. One semantic type scale, consumed via tokens — not hard-coded `fontSize` per screen. This mirrors `CLAUDE.md`'s "extend, don't fork" rule for the codebase.

## 9. Silence is a state we design for

Missing audio, no progress yet, an empty list, a lost connection, a failed load — each gets a calm, specific, recoverable message with a way forward ("Try again"), never a bare spinner, a raw `Alert`, or a silent dead end. The same care the happy path gets.

## 10. Authentic surfaces, accessible on-ramps

Show the Sanskrit prominently and beautifully — and put a single plain-language line above it so a newcomer knows what they're looking at. Keep "Chapter / Verse" as the canonical reference — and let a friendlier label ("Reflection 12") carry the everyday UI. Keep the devotional sign-off — and label it ("a traditional closing blessing") and place it at the close, not the opening. Every piece of tradition can stay; each just needs a low step up to it.

## 11. Efficient use of screen space — prefer a complete single screen

Aim for a **complete single-screen experience** wherever it's reasonable — especially on the primary, high-frequency screens (**Home, Journey, Settings**). On a common phone (≈375–402 pt wide, ≈"iPhone 15" height), the important content and the primary action should be visible in one viewport without scrolling.

Get there by using space well, not by shrinking things:

- tighter but still comfortable vertical rhythm between sections
- card padding sized to its content, not a fixed generous default
- no purely decorative whitespace or oversized spacers
- combine related facts into one row or one block instead of stacking them
- more efficient section layouts (a 2-up row instead of two stacked cards, etc.)
- a sensible type hierarchy doing the separating work that blank space was doing
- compact rows when the information allows it
- no repeated headings, and no explanatory copy the screen doesn't need

**Never** buy density with uncomfortably small text, sub-44 pt touch targets, or unrelated things crammed together. Single-screen is a **preference, not a rule**: let a screen scroll when its content genuinely needs the room, or when forcing one viewport would hurt readability, hierarchy, accessibility or usability. When a screen stays scrollable on purpose, say why in the tracker.

---

## Typography

The typography foundation lives in [`src/theme/typography.ts`](../src/theme/typography.ts) and is consumed through [`src/components/AppText.tsx`](../src/components/AppText.tsx). It is the long-term home for every text-size decision in the app.

**Three layers:**

1. `fontFamilies` — the three bundled Outfit weights (`regular` / `medium` / `semiBold`). Always set a family; a bare `fontWeight` on a `<Text>` renders in the system font (San Francisco / Roboto), not Outfit.
2. `sizes` / `lineHeights` — the primitive numeric ramp (`xs`…`hero`). Every value is already run through `fontScale()`. Kept for existing call sites and genuine one-offs.
3. `roles` — the semantic scale. **New code uses these.**

**The semantic roles:**

| role | ~pt | Use for |
|---|---|---|
| `display` | 32 | screen hero titles ("Mangalam"), large hero numbers |
| `title` | 24 | greeting, primary card titles, screen section heroes |
| `heading` | 20 | card titles, section headers, dialog titles |
| `subheading` | 18 | sub-headers, list-group headers, prominent labels |
| `body` | 16 | primary reading / paragraph text |
| `bodySmall` | 14 | secondary text, descriptions, helper copy |
| `caption` | 13 | footnotes, timestamps, disclaimers |
| `label` | 12 | uppercase tags, tab-bar labels, metadata, overlines |
| `button` | 16 | text inside buttons / primary tap targets |

**How responsive scaling works.** `fontScale(size)` applies a gentle, clamped curve keyed off the device's shorter edge against a 390 pt baseline (iPhone 13–16 width). Mainstream phones land at ≈1.0 — the visual design is unchanged there. Small phones (SE, 320 pt) ease down to ~0.92; large phones and tablets ease up, hard-capped at 1.08. It is deliberately **not** a flat width multiplier — that ruins typography on tablets and small Android devices. The app is portrait-locked, so the value is read once at module load.

**How accessibility font scaling is handled.** OS font-size settings still apply (`allowFontScaling` stays on). Each role carries a `maxFontSizeMultiplier` (headings ~1.3, body ~1.6) that `AppText` passes through, so a large accessibility setting enlarges text without breaking headers, buttons and fixed-height rows. Fixed-height chrome that must match a native control (the tab bar, the Apple/Google sign-in buttons) caps tighter or opts out — this is called out at each such site.

**When to use a semantic token.** Any new `<Text>`. Reach for `<AppText variant="…">` and layer colour / alignment / (occasionally) weight on top via `style`. If you're about to type `fontSize:` in a stylesheet, stop — pick the closest role instead.

**When an explicit size is acceptable.** Only when a value is genuinely dictated by a specific component constraint that no role fits — e.g. text inside a fixed 40 pt badge, or matching a platform control's exact metrics. Leave a one-line comment saying why, and still pass a `maxFontSizeMultiplier`. Do not introduce a new arbitrary number just to avoid a role that's 1–2 pt off.

---

_Maintained alongside [`UX_TRACKER.md`](./UX_TRACKER.md). Update when a principle is refined by a real product decision; record the decision in the tracker's decision log._
