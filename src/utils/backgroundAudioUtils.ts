import { isRamayan, isMahabharat, isGita } from '../lib/bookIdentity';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://yhuvjcmemsqjkttizxem.supabase.co';

export type AudioMood = 'calm' | 'devotional' | 'storytelling';

// One background bed length for everything: most narration runs under 8 minutes,
// and the player loops the bed for the few episodes that run longer. There is no
// per-length bed asset, so track selection depends only on mood.
const BACKGROUND_BED_MINUTES = 8;

export const getBackgroundMood = (bookId?: string | null): AudioMood => {
    if (isRamayan(bookId) || isMahabharat(bookId)) {
        return 'storytelling';
    }
    if (isGita(bookId)) {
        return 'devotional';
    }
    return 'calm';
};

export const getBackgroundTrackUrl = (mood: AudioMood): string => {
    // e.g. mangalam_bed_calm_8min.mp3
    const fileName = `mangalam_bed_${mood}_${BACKGROUND_BED_MINUTES}min.mp3`;
    return `${SUPABASE_URL}/storage/v1/object/public/background-audio/${fileName}`;
};
