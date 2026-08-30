import { getBookCode } from './bookIdentity';

// ─── Per-book display terminology (POS-01) ────────────────────────────────────
// The Gita is verse-based; Ramayan / Mahabharat are narrative retellings told in
// episodes, so calling their units "Verse" is wrong. The grouping word follows
// each tradition (Kanda / Parva). This is DISPLAY classification only — it is
// resolved from the book's slug/code, never used to drive fetch or navigation
// (CLAUDE.md §2). One place to change it.

export type BookTerms = {
    /** The grouping level — "Chapter" / "Kanda" / "Parva". */
    group: string;
    /** The individual unit — "Verse" / "Episode". */
    unit: string;
};

const DEFAULT_TERMS: BookTerms = { group: 'Chapter', unit: 'Verse' };

const TERMS_BY_CODE: Record<string, BookTerms> = {
    gita: { group: 'Chapter', unit: 'Verse' },
    bhagavad_gita: { group: 'Chapter', unit: 'Verse' },
    'bhagavad-gita': { group: 'Chapter', unit: 'Verse' },
    ramayan: { group: 'Kanda', unit: 'Episode' },
    ramayana: { group: 'Kanda', unit: 'Episode' },
    mahabharat: { group: 'Parva', unit: 'Episode' },
    mahabharata: { group: 'Parva', unit: 'Episode' },
};

/**
 * Terminology for a book, resolved from a `book_id` (via the identity cache) or
 * from a slug/code string directly. Falls back to Chapter/Verse for anything
 * unrecognised.
 */
export function bookTerms(bookIdOrCode: string | null | undefined): BookTerms {
    if (!bookIdOrCode) return DEFAULT_TERMS;
    const direct = TERMS_BY_CODE[bookIdOrCode.toLowerCase()];
    if (direct) return direct;
    const code = getBookCode(bookIdOrCode);
    return TERMS_BY_CODE[code?.toLowerCase?.() ?? ''] ?? DEFAULT_TERMS;
}

/**
 * A human reference line for a unit: "Chapter 2 · Verse 47" for the Gita,
 * "Kanda 1 · Episode 3" for Ramayan, etc. Omits whichever number is missing.
 */
export function formatRef(
    bookIdOrCode: string | null | undefined,
    groupNo: number | null | undefined,
    unitNo: number | null | undefined,
    sep = ' · ',
): string {
    const t = bookTerms(bookIdOrCode);
    if (groupNo != null && unitNo != null) return `${t.group} ${groupNo}${sep}${t.unit} ${unitNo}`;
    if (groupNo != null) return `${t.group} ${groupNo}`;
    if (unitNo != null) return `${t.unit} ${unitNo}`;
    return '';
}
