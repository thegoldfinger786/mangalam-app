// ─── Display-time cleanup for generated verse content ─────────────────────────
// The text in `verse_content` (translation / commentary / daily_life_application)
// is LLM-generated and carries a few recurring artifacts. We do NOT edit the
// stored content — this is a presentation-layer pass applied wherever that text
// is shown or measured, so it stays fully reversible.
//
// Covered (tracker CONTENT-03 / PLAY-07):
//   • SSML the TTS pipeline leaves in the authored text (`<break .../>`).
//   • Markdown bold markers (`**`) that never render as intended.
//   • "Chapter N Verse M" written without its comma, mid-sentence
//     ("…this instruction from Chapter 5 Verse 27 lays…") — 300+ Gita rows.
//   • The Hindi equivalent, "अध्याय N श्लोक M" (the "अध्याय N के श्लोक M" form
//     already reads correctly and is left alone).
//   • "mine ness" → "mine-ness" (a single known slip in BG 1.1).
// ─────────────────────────────────────────────────────────────────────────────

/** Strip SSML break tags and markdown bold markers, then collapse whitespace. */
export function stripMarkup(text: string): string {
    if (!text) return '';
    return text
        .replace(/<break\s+time="[^"]*"\s*\/>/gi, '')
        .replace(/<break\s*\/>/gi, '')
        .replace(/\*\*/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Full display-time cleanup: markup stripping + generation-artifact fixes.
 * Idempotent — safe to run more than once on the same string.
 */
export function cleanContentText(text: string): string {
    if (!text) return '';
    return stripMarkup(
        text
            // "Chapter 5 Verse 27" → "Chapter 5, Verse 27" (only the comma-less form matches)
            .replace(/\bChapter (\d+) Verse (\d+)/g, 'Chapter $1, Verse $2')
            // Hindi: "अध्याय 1 श्लोक 1" → "अध्याय 1, श्लोक 1"
            .replace(/(अध्याय \d+) (श्लोक \d+)/g, '$1, $2')
            .replace(/\bmine ness\b/gi, 'mine-ness'),
    );
}
