import { useCallback, useEffect, useState } from 'react';
import { fetchVersesWithContent } from '../../lib/queries';
import { logger } from '../../lib/logger';

/**
 * Session cache of a book's verses (with content), keyed by book + language.
 *
 * The Library stack loads a book's verses once on `BookDetail` and derives the
 * chapter grid, the hero and the book-wide search from that array;
 * `ChapterVerses` then reads the same cached array so opening a chapter stays
 * instant. A language switch changes the key, so titles refresh naturally.
 * Module-level (not context) so reads cost nothing; cleared on reload.
 */
const cache = new Map<string, any[]>();
const keyOf = (bookId: string, lang: 'en' | 'hi') => `${bookId}:${lang}`;

type State = { verses: any[]; loading: boolean; error: boolean };

export function useBookVerses(bookId: string, lang: 'en' | 'hi') {
    const [state, setState] = useState<State>(() => {
        const cached = cache.get(keyOf(bookId, lang));
        return { verses: cached ?? [], loading: !cached, error: false };
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true, error: false }));
        try {
            const data = await fetchVersesWithContent(bookId, lang);
            cache.set(keyOf(bookId, lang), data);
            setState({ verses: data, loading: false, error: false });
        } catch (error) {
            logger.error('Failed to load book verses', { error });
            setState((s) => ({ ...s, loading: false, error: true }));
        }
    }, [bookId, lang]);

    useEffect(() => {
        const cached = cache.get(keyOf(bookId, lang));
        if (cached) {
            setState({ verses: cached, loading: false, error: false });
        } else {
            load();
        }
    }, [bookId, lang, load]);

    return { ...state, reload: load };
}
