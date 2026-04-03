import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { create } from 'zustand';
import { getBackgroundMood, getBackgroundTrackUrl } from '../utils/backgroundAudioUtils';

type AudioPlayerLike = ReturnType<typeof createAudioPlayer>;

type SubscriptionLike = {
    remove?: () => void;
} | null;

interface CurrentContent {
    id: string;
    title: string;
    type: string;
    bookId?: string | null;
    bookSlug?: string | null;
    chapterNo?: number | null;
    verseNo?: number | null;
    ref?: string | null;
}

interface AudioState {
    sound: AudioPlayerLike | null;
    bgSound: AudioPlayerLike | null;
    isPlaying: boolean;
    position: number;
    duration: number;
    playbackRate: number;
    audioUrl: string | null;
    currentContent: CurrentContent | null;
    onFinish?: () => void;

    bgFadeInterval: ReturnType<typeof setInterval> | null;
    targetBgVolume: number;
    mainStatusSub: SubscriptionLike;
    bgStatusSub: SubscriptionLike;
    loadToken: number;

    loadAudio: (url: string, content: any, autoPlay?: boolean, onFinish?: () => void) => Promise<void>;
    unloadAudio: () => Promise<void>;
    togglePlayPause: () => Promise<void>;
    seek: (position: number) => Promise<void>;
    setPlaybackRate: (rate: number) => Promise<void>;
    stopAllAudio: () => Promise<void>;
    _stopFade: () => void;
    _fadeBgAudio: (toVolume: number, durationMs: number) => void;
}

function getContentId(content: any): string {
    return String(content?.verse_id || content?.episode_id || content?.id || '');
}

function getBookSlug(content: any): string | null {
    return content?.book_slug || content?.slug || null;
}

function getChapterNo(content: any): number | null {
    if (typeof content?.chapter_no === 'number') return content.chapter_no;
    if (typeof content?.chapterNo === 'number') return content.chapterNo;
    return null;
}

function getVerseNo(content: any): number | null {
    if (typeof content?.verse_no === 'number') return content.verse_no;
    if (typeof content?.verseNo === 'number') return content.verseNo;
    return null;
}

function getRef(content: any): string | null {
    return content?.ref || null;
}

function getContentType(content: any): string {
    return content?.type || content?.book_slug || (content?.verse_id ? 'verse' : 'episode');
}

function getBookDisplayName(content: any): string {
    const slug = (content?.book_slug || content?.slug || '').toLowerCase();
    const explicit =
        content?.book_title ||
        content?.bookTitle ||
        content?.collection_title ||
        content?.collectionTitle;

    if (explicit) return explicit;
    if (slug.includes('gita')) return 'Bhagavad Gita';
    if (slug.includes('ram')) return 'Ramayan';
    if (slug.includes('mahabharat')) return 'Mahabharat';
    if (content?.book_name) return content.book_name;

    return 'Mangalam';
}

function getDisplayTitle(content: any): string {
    if (content?.title && String(content.title).trim()) {
        return String(content.title).trim();
    }

    const chapterNo = getChapterNo(content);
    const verseNo = getVerseNo(content);
    const ref = getRef(content);

    if (ref) return ref;
    if (chapterNo != null && verseNo != null) return `Chapter ${chapterNo} · Verse ${verseNo}`;
    if (chapterNo != null) return `Chapter ${chapterNo}`;

    return 'Mangalam Audio';
}

function getArtistLine(content: any): string {
    const book = getBookDisplayName(content);
    const chapterNo = getChapterNo(content);
    const verseNo = getVerseNo(content);

    if (chapterNo != null && verseNo != null) {
        return `${book} • Chapter ${chapterNo} • Verse ${verseNo}`;
    }

    if (chapterNo != null) {
        return `${book} • Chapter ${chapterNo}`;
    }

    return book;
}

function getArtworkUrl(content: any): string | undefined {
    return content?.cover_art_url || content?.artworkUrl || undefined;
}

function buildLockScreenMetadata(content: any) {
    return {
        title: getDisplayTitle(content),
        artist: getArtistLine(content),
        albumTitle: 'Mangalam',
        artworkUrl: getArtworkUrl(content),
    };
}

function mapCurrentContent(content: any): CurrentContent {
    return {
        id: getContentId(content),
        title: getDisplayTitle(content),
        type: getContentType(content),
        bookId: content?.book_id ?? null,
        bookSlug: getBookSlug(content),
        chapterNo: getChapterNo(content),
        verseNo: getVerseNo(content),
        ref: getRef(content),
    };
}

export const useAudioStore = create<AudioState>((set, get) => ({
    sound: null,
    bgSound: null,
    isPlaying: false,
    position: 0,
    duration: 1,
    playbackRate: 1.0,
    audioUrl: null,
    currentContent: null,
    onFinish: undefined,

    bgFadeInterval: null,
    targetBgVolume: 0.3,
    mainStatusSub: null,
    bgStatusSub: null,
    loadToken: 0,

    _stopFade: () => {
        const { bgFadeInterval } = get();
        if (bgFadeInterval) {
            clearInterval(bgFadeInterval);
            set({ bgFadeInterval: null });
        }
    },

    _fadeBgAudio: (toVolume: number, durationMs: number) => {
        get()._stopFade();
        const { bgSound } = get();
        if (!bgSound) return;

        const steps = 20;
        const stepTime = Math.max(25, Math.floor(durationMs / steps));
        const startVolume = typeof bgSound.volume === 'number' ? bgSound.volume : 0;
        const volumeStep = (toVolume - startVolume) / steps;

        let currentVolume = startVolume;
        let stepCount = 0;

        const interval = setInterval(() => {
            stepCount += 1;
            currentVolume += volumeStep;

            if (currentVolume < 0) currentVolume = 0;
            if (currentVolume > 1) currentVolume = 1;

            try {
                bgSound.volume = currentVolume;
            } catch {
                get()._stopFade();
                return;
            }

            if (stepCount >= steps) {
                try {
                    bgSound.volume = toVolume;
                } catch { }
                get()._stopFade();
            }
        }, stepTime);

        set({ bgFadeInterval: interval });
    },

    stopAllAudio: async () => {
        get()._stopFade();

        const { sound, bgSound, mainStatusSub, bgStatusSub } = get();

        mainStatusSub?.remove?.();
        bgStatusSub?.remove?.();

        if (sound) {
            try { sound.setActiveForLockScreen(false); } catch { }
            try { sound.pause(); } catch { }
            try { sound.remove(); } catch { }
        }

        if (bgSound) {
            try { bgSound.pause(); } catch { }
            try { bgSound.remove(); } catch { }
        }

        set({
            sound: null,
            bgSound: null,
            isPlaying: false,
            position: 0,
            duration: 1,
            audioUrl: null,
            currentContent: null,
            onFinish: undefined,
            mainStatusSub: null,
            bgStatusSub: null,
        });
    },

    loadAudio: async (url, content, autoPlay = false, onFinish) => {
        const nextToken = get().loadToken + 1;
        set({ loadToken: nextToken });

        const {
            sound: existingSound,
            bgSound: existingBgSound,
            audioUrl,
            playbackRate,
        } = get();

        get()._stopFade();

        if (audioUrl === url && existingSound) {
            set({
                onFinish,
                currentContent: mapCurrentContent(content),
            });

            try {
                existingSound.updateLockScreenMetadata(buildLockScreenMetadata(content));
            } catch { }

            if (autoPlay && !get().isPlaying) {
                try {
                    existingSound.setActiveForLockScreen(true, buildLockScreenMetadata(content));
                } catch { }

                if (existingBgSound) {
                    try {
                        existingBgSound.play();
                        get()._fadeBgAudio(get().targetBgVolume, 1200);
                    } catch { }
                }

                existingSound.play();
            }

            return;
        }

        await get().stopAllAudio();

        try {
            set({
                onFinish,
                audioUrl: url,
                sound: null,
                bgSound: null,
                mainStatusSub: null,
                bgStatusSub: null,
            });

            if (!url) {
                set({
                    position: 0,
                    duration: 1,
                    isPlaying: false,
                    currentContent: mapCurrentContent(content),
                });
                return;
            }

            await setAudioModeAsync({
                playsInSilentMode: true,
                shouldPlayInBackground: true,
                interruptionMode: 'doNotMix',
                shouldRouteThroughEarpiece: false,
            });

            if (get().loadToken !== nextToken) return;

            const newSound = createAudioPlayer(url, {
                updateInterval: 100,
                downloadFirst: false,
            });

            newSound.setPlaybackRate(playbackRate, 'medium');

            const mainStatusSubNew = newSound.addListener('playbackStatusUpdate', (status: any) => {
                const currentState = get();
                if (currentState.sound !== newSound) return;

                const positionMs = Math.max(0, Math.floor((status.currentTime || 0) * 1000));
                const durationMs = Math.max(1, Math.floor((status.duration || 0) * 1000));

                set({
                    position: positionMs,
                    duration: durationMs,
                    isPlaying: !!status.playing,
                });

                const msRemaining = durationMs - positionMs;
                const { bgSound, bgFadeInterval } = get();

                if (msRemaining < 4500 && msRemaining > 0 && bgSound && !bgFadeInterval) {
                    get()._fadeBgAudio(0, 3500);
                }

                if (status.didJustFinish) {
                    set({
                        isPlaying: false,
                        position: durationMs,
                    });

                    const bg = get().bgSound;
                    if (bg) {
                        try {
                            bg.pause();
                            bg.seekTo(0);
                            bg.volume = 0;
                        } catch { }
                    }

                    try {
                        newSound.setActiveForLockScreen(false);
                    } catch { }

                    const callback = get().onFinish;
                    if (callback) callback();
                }
            });

            let tries = 0;
            while ((!newSound.duration || newSound.duration <= 0) && tries < 40) {
                if (get().loadToken !== nextToken) {
                    try { newSound.remove(); } catch { }
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
                tries += 1;
            }

            const durationMsForBed =
                newSound.duration && newSound.duration > 0
                    ? Math.floor(newSound.duration * 1000)
                    : 60000;

            const mood = getBackgroundMood(content?.type || content?.book_id || content?.book_slug);
            const bgUrl = getBackgroundTrackUrl(mood, durationMsForBed);

            if (get().loadToken !== nextToken) {
                try { newSound.remove(); } catch { }
                return;
            }

            const newBgSound = createAudioPlayer(bgUrl, {
                updateInterval: 500,
                downloadFirst: false,
            });

            newBgSound.loop = true;
            newBgSound.volume = 0;

            const bgStatusSubNew = newBgSound.addListener('playbackStatusUpdate', () => { });

            if (get().loadToken !== nextToken) {
                try { newSound.remove(); } catch { }
                try { newBgSound.remove(); } catch { }
                return;
            }

            set({
                sound: newSound,
                bgSound: newBgSound,
                audioUrl: url,
                currentContent: mapCurrentContent(content),
                mainStatusSub: mainStatusSubNew,
                bgStatusSub: bgStatusSubNew,
            });

            if (autoPlay) {
                try {
                    newSound.setActiveForLockScreen(true, buildLockScreenMetadata(content));
                } catch { }

                try {
                    newBgSound.play();
                } catch (e) {
                    console.log('background bed play error', e);
                }

                newSound.play();
                get()._fadeBgAudio(get().targetBgVolume, 1800);
            }
        } catch (error) {
            console.error('Error loading audio in store:', error);
        }
    },

    unloadAudio: async () => {
        await get().stopAllAudio();
    },

    togglePlayPause: async () => {
        const { sound, bgSound, isPlaying, position, duration, targetBgVolume, currentContent } = get();
        if (!sound) return;

        if (isPlaying) {
            if (bgSound) {
                get()._fadeBgAudio(0, 500);
            }
            try { bgSound?.pause(); } catch { }
            sound.pause();
            return;
        }

        try {
            sound.setActiveForLockScreen(true, buildLockScreenMetadata(currentContent || {}));
        } catch { }

        if (position >= duration) {
            await sound.seekTo(0);
            if (bgSound) {
                await bgSound.seekTo(0);
            }
        }

        try { bgSound?.play(); } catch { }
        sound.play();

        if (bgSound) {
            get()._fadeBgAudio(targetBgVolume, 1000);
        }
    },

    seek: async (pos) => {
        const { sound } = get();
        if (!sound) return;

        const duration = get().duration || 0;
        const clamped = Math.max(0, Math.min(pos, duration > 0 ? duration : pos));

        await sound.seekTo(clamped / 1000);
        set({ position: clamped });
    },

    setPlaybackRate: async (rate) => {
        const { sound } = get();

        if (sound) {
            sound.setPlaybackRate(rate, 'medium');
        }

        set({ playbackRate: rate });
    },
}));