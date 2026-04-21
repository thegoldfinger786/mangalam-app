import { supabase } from './supabase';
import { syncBookIdentityCache } from './bookIdentity';
import { logger } from '../lib/logger';
export { supabase };

// --- Book Queries ---

export const fetchBookById = async (bookId: string) => {
    const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('book_id', bookId)
        .eq('is_active', true)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};


export const fetchActiveBooks = async () => {
    const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('is_active', true);

    if (error) throw error;

    // Populate the global book identity cache so feature-flag helpers
    // (isRamayan, isGita, etc.) can resolve book_id → code/slug.
    if (data) {
        syncBookIdentityCache(data);
    }

    return data;
};

// --- Verse Queries (Gita / Upanishads) ---

export const fetchVerses = async (bookId: string) => {
    const { data, error } = await supabase
        .from('verses')
        .select('*')
        .eq('book_id', bookId)
        .order('chapter_no', { ascending: true })
        .order('verse_no', { ascending: true });

    if (error) throw error;
    return data;
};

export const fetchVerseByIdAndBookId = async (bookId: string, verseId: string) => {
    const { data, error } = await supabase
        .from('verses')
        .select('*, books!inner(book_id, slug, title, title_en, title_hi)')
        .eq('book_id', bookId)
        .eq('verse_id', verseId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

export const fetchVersesWithContent = async (bookId: string, lang: 'en' | 'hi') => {
    const { data, error } = await supabase
        .from('verses')
        .select(`
            *,
            verse_content!inner (*)
        `)
        .eq('book_id', bookId)
        .eq('verse_content.language', lang)
        .order('chapter_no', { ascending: true })
        .order('verse_no', { ascending: true });

    if (error) throw error;

    // Flatten for easier UI usage
    return (data || []).map(v => ({
        ...v,
        title: v.verse_content?.[0]?.title,
        translation: v.verse_content?.[0]?.translation,
        commentary: v.verse_content?.[0]?.commentary,
        daily_life_application: v.verse_content?.[0]?.daily_life_application,
        practical_examples: v.verse_content?.[0]?.practical_examples
    }));
};

export const fetchAdjacentVerse = async (
    bookId: string,
    chapterNo: number,
    verseNo: number,
    direction: 'next' | 'prev'
) => {
    // Try same chapter first
    const ascending = direction === 'next';
    const operator = direction === 'next' ? 'gt' : 'lt';

    // First try same chapter
    const { data: sameChapter } = await supabase
        .from('verses')
        .select('verse_id, chapter_no, verse_no')
        .eq('book_id', bookId)
        .eq('chapter_no', chapterNo)
        .filter('verse_no', operator, verseNo)
        .order('verse_no', { ascending })
        .limit(1)
        .maybeSingle();

    if (sameChapter) return sameChapter;

    // Spill into adjacent chapter
    const chapterOp = direction === 'next' ? 'gt' : 'lt';
    const { data: adjacentChapter } = await supabase
        .from('verses')
        .select('verse_id, chapter_no, verse_no')
        .eq('book_id', bookId)
        .filter('chapter_no', chapterOp, chapterNo)
        .order('chapter_no', { ascending })
        .order('verse_no', { ascending })
        .limit(1)
        .maybeSingle();

    return adjacentChapter ?? null;
};

// --- Usage & Streaks ---

export const fetchDailyUsage = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('user_daily_usage')
        .select('*')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    return data;
};

export const incrementDailyUsage = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.rpc('increment_daily_usage', {
        p_user_id: userId,
        p_date: today
    });
    if (error) throw error;
    return data;
};

export const fetchStreakData = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_daily_usage')
        .select('usage_date, sessions_used')
        .eq('user_id', userId)
        .order('usage_date', { ascending: false })
        .limit(30);

    if (error) throw error;
    return data;
};

// --- Audio Canonical Layer (Book-scoped) ---

export const fetchVerseAudio = async (
    bookId: string,
    verseId: string,
    language: 'en' | 'hi',
    voicePreference: string
) => {
    try {
        const DEBUG_AUDIO = false;
        const SUPPORTED_AUDIO_TYPES = ['spoken_episode', 'compiled_full_episode'];

        if (!bookId || !verseId) return null;

        const normalizedLanguage: 'en' | 'hi' = language === 'hi' ? 'hi' : 'en';
        const normalizedVoicePref = voicePreference?.toLowerCase().trim();
        const voiceMap: Record<string, string[]> = {
            'english-female': ['en-IN-Neural2-A', 'en-IN-Wavenet-A'],
            'english-male': ['en-IN-Neural2-B', 'en-IN-Wavenet-B'],
            'hindi-female': ['hi-IN-Neural2-A', 'hi-IN-Wavenet-A'],
            'hindi-male': ['hi-IN-Neural2-B', 'hi-IN-Wavenet-C'],
        };

        if (!normalizedVoicePref || !voiceMap[normalizedVoicePref]) {
            logger.warn('Unknown voicePreference:', voicePreference);
        }

        const preferredVoices = voiceMap[normalizedVoicePref] || [];

        const baseQuery = () =>
            supabase
                .from('verse_audio')
                .select('storage_path, storage_bucket, asset_type, is_canonical, status, voice_id')
                .eq('book_id', bookId)
                .eq('verse_id', verseId)
                .eq('language', normalizedLanguage)
                .eq('is_active', true)
                .eq('status', 'ready')
                .in('asset_type', SUPPORTED_AUDIO_TYPES);

        const finalizeQuery = async (query: ReturnType<typeof baseQuery>) => {
            const { data, error } = await query
                .order('is_canonical', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(1);

            return { data: data?.[0] ?? null, error };
        };

        if (preferredVoices.length > 0) {
            const { data: voiceMatchedData, error: voiceMatchedError } = await finalizeQuery(
                baseQuery().in('voice_id', preferredVoices)
            );

            if (voiceMatchedError) {
                logger.error('Failed to fetch voice-matched verse audio', { error: voiceMatchedError, context: { bookId, verseId } });
            } else if (voiceMatchedData) {
                if (DEBUG_AUDIO) {
                    logger.log('AUDIO FETCH RESULT:', {
                        stage: 'voice-match',
                        bookId,
                        verseId,
                        language: normalizedLanguage,
                        voicePreference: normalizedVoicePref,
                        result: voiceMatchedData
                    });
                }
                return voiceMatchedData;
            }
        }

        const { data: primaryData, error: primaryError } = await finalizeQuery(
            baseQuery().eq('is_primary_playback', true)
        );

        if (primaryError) {
            logger.error('Failed to fetch primary verse audio', { error: primaryError, context: { bookId, verseId } });
        } else if (primaryData) {
            if (DEBUG_AUDIO) {
                logger.log('AUDIO FETCH RESULT:', {
                    stage: 'primary',
                    bookId,
                    verseId,
                    language: normalizedLanguage,
                    voicePreference: normalizedVoicePref,
                    result: primaryData
                });
            }
            return primaryData;
        }

        const { data: fallbackData, error: fallbackError } = await finalizeQuery(baseQuery());

        if (fallbackError) {
            logger.error('Failed to fetch fallback verse audio', { error: fallbackError, context: { bookId, verseId } });
            return null;
        }

        if (DEBUG_AUDIO) {
            logger.log('AUDIO FETCH RESULT:', {
                stage: 'fallback',
                bookId,
                verseId,
                language: normalizedLanguage,
                voicePreference: normalizedVoicePref,
                result: fallbackData
            });
        }

        return fallbackData ?? null;
    } catch (error) {
        logger.error('Failed to fetch verse audio', { error, context: { bookId, verseId } });
        return null;
    }
};

// --- Audio Cache (Legacy) ---

export const checkAudioCache = async (params: {
    contentType: 'verse' | 'narrative';
    contentId: string;
    section: string;
    lang: string;
    voice: string;
    engine: string;
}) => {
    // NOTE: This is legacy history. Use fetchVerseAudio for canonical books (Gita, Mahabharat, Ramayan).

    const { data, error } = await supabase
        .from('audio_cache')
        .select('storage_path')
        .match({
            content_type: params.contentType,
            content_id: params.contentId,
            section: params.section,
            language: params.lang,
            voice_id: params.voice,
            engine: params.engine
        })
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};
// --- Progress Persistence ---

export const fetchUserProgress = async (userId: string, bookId?: string) => {
    let query = supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);

    if (bookId) {
        query = query.eq('book_id', bookId);
    } else {
        query = query.order('updated_at', { ascending: false }).limit(1);
    }

    const { data, error } = bookId
        ? await query.maybeSingle()
        : await query.maybeSingle();

    if (error) throw error;

    if (!data) return null;

    return {
        ...data,
        bookId: data.book_id,
        verseId: data.last_content_id,
        position: data.last_position_seconds ?? 0,
    };
};

export const upsertUserProgress = async (params: {
    userId: string;
    bookId: string;
    lastContentId: string;
    contentType: 'verse';
    lastPositionSeconds: number;
    playbackSpeed: number;
}) => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.rpc('upsert_user_progress_resume', {
        p_user_id: params.userId,
        p_book_id: params.bookId,
        p_last_content_id: params.lastContentId,
        p_content_type: params.contentType,
        p_last_position_seconds: params.lastPositionSeconds,
        p_playback_speed: params.playbackSpeed,
        p_updated_at: updatedAt
    });

    if (error) throw error;
};
// --- Bookmarks & Activity ---

export const toggleBookmark = async (userId: string, contentId: string, contentType: 'verse') => {
    // Check if exists
    const { data: existing } = await supabase
        .from('user_bookmarks')
        .select('id')
        .match({ user_id: userId, content_id: contentId })
        .maybeSingle();

    if (existing) {
        const { error } = await supabase.from('user_bookmarks').delete().eq('id', existing.id);
        if (error) throw error;
        return { bookmarked: false };
    } else {
        const { error } = await supabase.from('user_bookmarks').insert({
            user_id: userId,
            content_id: contentId,
            content_type: contentType
        });
        if (error) throw error;
        // Also log as an activity
        await logActivity(userId, contentId, contentType, 'bookmark');
        return { bookmarked: true };
    }
};

export const fetchIsBookmarked = async (userId: string, contentId: string) => {
    const { data } = await supabase
        .from('user_bookmarks')
        .select('id')
        .match({ user_id: userId, content_id: contentId })
        .maybeSingle();
    return !!data;
};

export const logActivity = async (userId: string | null, contentId: string, contentType: 'verse', actionType: 'share' | 'listen' | 'bookmark') => {
    const { error } = await supabase.from('activity_log').insert({
        user_id: userId,
        content_id: contentId,
        content_type: contentType,
        action_type: actionType
    });
    // We don't throw here to avoid blocking the UI for a non-critical tracking event
    if (error) logger.warn('Activity log error:', error.message);
};

// --- Aggregate Stats ---

export const fetchTopContent = async (type: 'listen' | 'share' | 'bookmark', limit: number = 3) => {
    const { data, error } = await supabase.rpc('get_top_content', {
        p_action_type: type,
        p_limit: limit
    });
    if (error) throw error;
    return data;
};
