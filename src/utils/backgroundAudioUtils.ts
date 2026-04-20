const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://yhuvjcmemsqjkttizxem.supabase.co';

export type AudioMood = 'calm' | 'devotional' | 'storytelling';

import { isRamayan, isMahabharat, isGita } from '../lib/bookIdentity';

export const getBackgroundMood = (bookId?: string | null): AudioMood => {
    if (isRamayan(bookId) || isMahabharat(bookId)) {
        return 'storytelling';
    }
    if (isGita(bookId)) {
        return 'devotional';
    }
    return 'calm';
};

export const getBackgroundDuration = (durationMs: number): number => {
    // User requested to use 8 mins everywhere since most narration is under 8 mins.
    // Loop will handle the very few cases that exceed 8 mins.
    return 8;
};

export const getBackgroundTrackUrl = (mood: AudioMood, durationMs: number): string => {
    const durationMinutes = getBackgroundDuration(durationMs);
    
    // Example: mangalam_bed_calm_15min.mp3
    const fileName = `mangalam_bed_${mood}_${durationMinutes}min.mp3`;
    
    // Construct the public Supabase storage URL
    return `${SUPABASE_URL}/storage/v1/object/public/background-audio/${fileName}`;
};
