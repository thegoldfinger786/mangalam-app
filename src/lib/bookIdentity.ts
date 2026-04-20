// ─── Book Identity System ───────────────────────────────────────────────────
// book_id  = identity (navigation, fetch, playback — NEVER hardcoded)
// code/slug = classification (feature flags only — fetched from backend)
// ────────────────────────────────────────────────────────────────────────────

interface BookCacheEntry {
    book_id: string;
    code?: string | null;
    slug?: string | null;
    title?: string | null;
}

// ─── In-memory cache populated at app boot via syncBookIdentityCache ────────
let _booksCache: BookCacheEntry[] = [];

/**
 * Populate the in-memory identity cache.
 * Must be called once on app boot after fetchActiveBooks returns.
 */
export function syncBookIdentityCache(books: BookCacheEntry[]) {
    _booksCache = books;
    console.log('BOOK_IDENTITY_CACHE_SYNCED', _booksCache.map(b => ({
        book_id: b.book_id,
        code: b.code ?? null,
        slug: b.slug ?? null,
    })));
}

// ─── Readiness Guard ────────────────────────────────────────────────────────

/**
 * Throws if the identity cache has not been populated yet.
 * Call this at the top of any critical path (PlayScreen, AudioStore init)
 * to surface cold-start bugs loudly instead of silently degrading.
 */
export function assertBookIdentityReady() {
    if (!_booksCache || _booksCache.length === 0) {
        throw new Error('BOOK_IDENTITY_NOT_READY');
    }
}

/**
 * Returns true if the cache has been populated at least once.
 * Use for non-critical paths where you want to guard without throwing.
 */
export function isBookIdentityReady(): boolean {
    return _booksCache.length > 0;
}

// ─── Code Resolution ────────────────────────────────────────────────────────

/**
 * Resolve the classification code for a given book_id.
 * Uses `code` first, falls back to `slug`.
 * Returns 'unknown' (and logs error) if bookId not found in cache.
 */
export function getBookCode(bookId: string | null | undefined): string {
    if (!bookId) return 'unknown';
    const book = _booksCache.find(b => b.book_id === bookId);
    if (!book) {
        console.error('BOOK_CODE_MISSING', { bookId, cacheSize: _booksCache.length });
        return 'unknown';
    }
    return book.code || book.slug || 'unknown';
}

/**
 * Look up a book entry by its classification code.
 */
export function getBookByCode(code: string): BookCacheEntry | undefined {
    return _booksCache.find(b => (b.code || b.slug) === code);
}

// ─── Feature-Flag Helpers (classification, NOT identity) ────────────────────

export function isRamayan(bookId: string | null | undefined): boolean {
    const code = getBookCode(bookId);
    return code === 'ramayan';
}

export function isMahabharat(bookId: string | null | undefined): boolean {
    const code = getBookCode(bookId);
    return code === 'mahabharat';
}

export function isGita(bookId: string | null | undefined): boolean {
    const code = getBookCode(bookId);
    return code === 'gita' || code === 'bhagavad_gita';
}

// ─── Assertion Utilities ────────────────────────────────────────────────────

export const assertValidBookId = (bookId: string | null | undefined, context: string): bookId is string => {
    if (!bookId) {
        console.error('INVALID_BOOK_ID', { context, bookId });
        return false;
    }

    return true;
};

export const requireBookId = (bookId: string | null | undefined, context: string): string => {
    if (!assertValidBookId(bookId, context)) {
        throw new Error(`BOOK_ID_REQUIRED:${context}`);
    }

    return bookId;
};

export function assertBookIdentityConsistency({ source, bookId }: { source: string; bookId?: string | null }) {
    if (!bookId) {
        console.error("BOOK_ID_BROKEN", { source, bookId });
    }
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export const auditBookIds = (books: { book_id?: string | null; title?: string | null }[]) => {
    const duplicates = new Set<string>();
    const seen = new Set<string>();

    books.forEach((book) => {
        if (!book.book_id) return;
        if (seen.has(book.book_id)) {
            duplicates.add(book.book_id);
            return;
        }
        seen.add(book.book_id);
    });

    console.log(
        'BOOK_ID_AUDIT',
        books.map((book) => ({
            title: book.title ?? null,
            book_id: book.book_id ?? null,
        }))
    );

    if (duplicates.size > 0) {
        console.error('BOOK_ID_DUPLICATES_DETECTED', {
            duplicate_book_ids: Array.from(duplicates),
        });
    }
};
