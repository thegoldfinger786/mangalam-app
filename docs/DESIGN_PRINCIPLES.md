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

---

_Maintained alongside [`UX_TRACKER.md`](./UX_TRACKER.md). Update when a principle is refined by a real product decision; record the decision in the tracker's decision log._
