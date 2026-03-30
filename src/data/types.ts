export type AudioResource = {
    url: string; // The URL to the audio file (could be local require() in demo)
    duration: number; // Duration in seconds
};

export type GitaVerse = {
    id: string; // e.g. "bg-1-1"
    chapter: number;
    verse: number;
    sanskrit: string;
    transliteration: string;
    translation: string; // Direct meaning (starts with "This verse means")
    commentary: string; // The deep dive reflection
    dailyLifeApplication: string; // Continuous explanation of applicability
    practicalExamples: string[]; // 1-2 practical examples
    audioEnglishMale: AudioResource;
    audioEnglishFemale: AudioResource;
    audioHindiMale: AudioResource;
    audioHindiFemale: AudioResource;
};

export type RamayanEpisode = {
    id: string; // e.g. "rm-1"
    episodeNumber: number;
    kanda: string; // The Book/Chapter equivalent
    title: string;
    storySegment: string;
    contextExplanation: string;
    modernApplication: string; // Practical takeaway
    moralTakeaway: string;
    audioEnglishMale: AudioResource;
    audioEnglishFemale: AudioResource;
    audioHindiMale: AudioResource;
    audioHindiFemale: AudioResource;
};

// Global Types for App State
export type ContentPath = 'gita' | 'ramayan' | 'mahabharat' | 'shiv_puran' | 'upanishads';
export type VoicePreference = 'english-male' | 'english-female' | 'hindi-male' | 'hindi-female';
export type AccountStatus = 'free' | 'supporter';
