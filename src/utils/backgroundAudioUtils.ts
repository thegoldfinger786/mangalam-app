import Constants from 'expo-constants';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export type AudioMood = 'calm' | 'devotional' | 'storytelling';

export const getBackgroundMood = (bookIdOrType?: string | null): AudioMood => {
    if (!bookIdOrType) return 'calm'; // Default
    
    const normalized = bookIdOrType.toLowerCase();
    
    // Exact or partial matches
    if (normalized.includes('gita')) {
        return 'calm';
    }
    if (normalized.includes('ramayan')) {
        return 'devotional';
    }
    if (normalized.includes('mahabharat')) {
        return 'storytelling';
    }
    
    return 'calm'; // Default fallback
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
