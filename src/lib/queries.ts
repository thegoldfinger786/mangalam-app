import { supabase } from './supabase';
export { supabase };

// --- Book Queries ---

export const fetchBookBySlug = async (slug: string) => {
    const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

export const fetchFirstVerseForBook = async (bookId: string) => {
    const { data, error } = await supabase
        .from('verses')
        .select('verse_id, chapter_no, verse_no')
        .eq('book_id', bookId)
        .order('chapter_no', { ascending: true })
        .order('verse_no', { ascending: true })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};


export const fetchActiveBooks = async () => {
    const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('is_active', true);

    if (error) throw error;
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

export const fetchVerseContent = async (verseId: string, lang: 'en' | 'hi') => {
    const { data, error } = await supabase
        .from('verse_content')
        .select('*')
        .eq('verse_id', verseId)
        .eq('language', lang);

    if (error) throw error;
    return data;
};


export const fetchEpisodeContent = async (episodeId: string, lang: 'en' | 'hi') => {
    const { data, error } = await supabase
        .from('episode_content')
        .select('*')
        .eq('episode_id', episodeId)
        .eq('language', lang);

    if (error) throw error;
    return data;
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

// --- Audio Cache ---

export const checkAudioCache = async (params: {
    contentType: 'verse' | 'narrative';
    contentId: string;
    section: string;
    lang: string;
    voice: string;
    engine: string;
}) => {
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
