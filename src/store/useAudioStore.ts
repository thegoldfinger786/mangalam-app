import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
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
    currentBgUrl: string | null;
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
    stopAllAudio: (options?: { keepBg?: boolean }) => Promise<void>;
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
    const slug = (content?.book_slug || content?.slug || content?.type || '').toLowerCase();
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
    currentBgUrl: null,
    isPlaying: false,
    position: 0,
    duration: 1,
    playbackRate: 1.0,
    audioUrl: null,
    currentContent: null,
    onFinish: undefined,

    bgFadeInterval: null,
    targetBgVolume: 0.4,
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
        if (!bgSound) {
            console.log('[DEBUG-AMBIENT] _fadeBgAudio skipped: bgSound is null');
            return;
        }

        const steps = 20;
        const stepTime = Math.max(25, Math.floor(durationMs / steps));
        const startVolume = typeof bgSound.volume === 'number' ? bgSound.volume : 0;
        const volumeStep = (toVolume - startVolume) / steps;

        console.log(`[DEBUG-AMBIENT] _fadeBgAudio started -> targeting volume: ${toVolume} over ${durationMs}ms`);
        console.log(`[DEBUG-AMBIENT] fade starting from current native volume: ${startVolume}`);

        let currentVolume = startVolume;
        let stepCount = 0;

        const interval = setInterval(() => {
            stepCount += 1;
            currentVolume += volumeStep;

            if (currentVolume < 0) currentVolume = 0;
            if (currentVolume > 1) currentVolume = 1;

            if (stepCount % 5 === 0) {
                console.log(`[DEBUG-AMBIENT] fade step ${stepCount}/${steps} -> setting volume to: ${currentVolume}`);
            }

            try {
                bgSound.volume = currentVolume;
            } catch (e) {
                console.log(`[DEBUG-AMBIENT] fade assignment failed at step ${stepCount}:`, e);
            }

            if (stepCount >= steps) {
                try {
                    bgSound.volume = toVolume;
                    console.log(`[DEBUG-AMBIENT] fade complete. Final volume set to: ${toVolume}`);
                } catch (e) {
                    console.log(`[DEBUG-AMBIENT] fade final assignment failed`, e);
                }
                get()._stopFade();
            }
        }, stepTime);

        set({ bgFadeInterval: interval });
    },

    stopAllAudio: async (options?: { keepBg?: boolean }) => {
        const keepBg = options?.keepBg || false;

        if (!keepBg) {
            get()._stopFade();
        }

        const { sound, bgSound, mainStatusSub, bgStatusSub } = get();

        mainStatusSub?.remove?.();
        if (!keepBg) {
            bgStatusSub?.remove?.();
        }

        if (sound) {
            try { sound.setActiveForLockScreen(false); } catch { }
            try { sound.pause(); } catch { }
            try { sound.remove(); } catch { }
        }

        if (bgSound && !keepBg) {
            try { bgSound.pause(); } catch { }
            try { bgSound.remove(); } catch { }
        }

        set((state) => ({
            sound: null,
            bgSound: keepBg ? state.bgSound : null,
            currentBgUrl: keepBg ? state.currentBgUrl : null,
            isPlaying: false,
            position: 0,
            duration: 1,
            audioUrl: null,
            currentContent: null,
            onFinish: undefined,
            mainStatusSub: null,
            bgStatusSub: keepBg ? state.bgStatusSub : null,
            ...(keepBg ? {} : { bgFadeInterval: null }),
        }));
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
                // Do NOT call setActiveForLockScreen(true) here — the player is already registered
                // from its initial creation. Re-registering stacks duplicate remote command handlers
                // in native MediaController, which silently breaks lock-screen resume.
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

        const expectedMood = getBackgroundMood(content?.type || content?.book_id || content?.book_slug);
        const expectedBgUrl = getBackgroundTrackUrl(expectedMood, 60000);
        const keepBg = existingBgSound !== null && get().currentBgUrl === expectedBgUrl;

        await get().stopAllAudio({ keepBg });

        try {
            set({
                onFinish,
                audioUrl: url,
                sound: null,
                mainStatusSub: null,
                ...(keepBg ? {} : { bgSound: null, bgStatusSub: null, currentBgUrl: null }),
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
            if (get().loadToken !== nextToken) return;

            const newSound = createAudioPlayer(url, {
                updateInterval: 100,
                downloadFirst: false,
            });

            newSound.setPlaybackRate(playbackRate, 'medium');

            let isInitialPlayback = true;

            const mainStatusSubNew = newSound.addListener('playbackStatusUpdate', (status: any) => {
                const currentState = get();
                if (currentState.sound !== newSound) return;

                const positionMs = Math.max(0, Math.floor((status.currentTime || 0) * 1000));
                const durationMs = Math.max(1, Math.floor((status.duration || 0) * 1000));

                const isNowPlaying = !!status.playing;
                const wasPlaying = currentState.isPlaying;

                set({
                    position: positionMs,
                    duration: durationMs,
                    isPlaying: isNowPlaying,
                });

                // Clear initial lock when first stable playing packet arrives
                if (isInitialPlayback && isNowPlaying) {
                    isInitialPlayback = false;
                }

                if (wasPlaying && !isNowPlaying) {
                    console.log(`[DEBUG-AMBIENT] Sync logic: Narration PAUSED. Pausing ambient.`);
                    // Narration paused (e.g. by lock screen or OS interruption)
                    if (currentState.bgSound) {
                        try { currentState.bgSound.pause(); } catch (e) {
                            console.log(`[DEBUG-AMBIENT] Sync logic: ambient pause failed`, e);
                        }
                    }
                } else if (!isInitialPlayback && !wasPlaying && isNowPlaying) {
                    console.log(`[DEBUG-AMBIENT] Sync logic: Narration RESUMED. Playing ambient & fading in.`);
                    // Narration resumed (e.g. by lock screen or OS command)
                    // Fire activation to violently wake the AVAudioSession if dead
                    setIsAudioActiveAsync(true).catch(() => { });

                    if (currentState.bgSound) {
                        try {
                            currentState.bgSound.play();
                            get()._fadeBgAudio(get().targetBgVolume, 1000);
                        } catch (e) {
                            console.log(`[DEBUG-AMBIENT] Sync logic: ambient resume failed`, e);
                        }
                    }
                }

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

            let newBgSound = get().bgSound;
            let bgStatusSubNew = get().bgStatusSub;

            if (!keepBg || !newBgSound) {
                console.log(`[DEBUG-AMBIENT] Creating new ambient player for bgUrl: ${bgUrl}`);

                let sourceUrl = bgUrl;
                try {
                    const localPath = FileSystem.cacheDirectory + encodeURIComponent(bgUrl);
                    const fileInfo = await FileSystem.getInfoAsync(localPath);
                    if (!fileInfo.exists) {
                        console.log(`[DEBUG-AMBIENT] Downloading ambient to cache: ${localPath}`);
                        await FileSystem.downloadAsync(bgUrl, localPath);
                    } else {
                        console.log(`[DEBUG-AMBIENT] Using cached ambient audio: ${localPath}`);
                    }
                    sourceUrl = localPath;
                } catch (err) {
                    console.log(`[DEBUG-AMBIENT] Cache failed, falling back to remote URL`, err);
                }

                newBgSound = createAudioPlayer(sourceUrl, {
                    updateInterval: 500,
                    // downloadFirst: false — let the native HTTP streamer open the connection
                    // independently. downloadFirst: true caused the player to silently ignore
                    // .play() calls because the 7.6MB file hadn't fully downloaded yet.
                    downloadFirst: false,
                });
                console.log(`[DEBUG-AMBIENT] Ambient player created successfully`);

                newBgSound.loop = true;
                // Initialize with 0.01 to force AVPlayer to eagerly allocate network buffers.
                // Volume 0 makes iOS background resource allocation heuristics stall the stream.
                newBgSound.volume = 0.01;

                bgStatusSubNew = newBgSound.addListener('playbackStatusUpdate', (status: any) => {
                    console.log(`[DEBUG-AMBIENT-STATUS] playing: ${status?.playing}, isLoaded: ${status?.isLoaded}, isBuffering: ${status?.isBuffering}, didJustFinish: ${status?.didJustFinish}, error: ${status?.error}`);
                });
            }

            if (get().loadToken !== nextToken) {
                try { newSound.remove(); } catch { }
                if (!keepBg) {
                    try { newBgSound?.remove(); } catch { }
                }
                return;
            }

            set({
                sound: newSound,
                bgSound: newBgSound,
                currentBgUrl: bgUrl,
                audioUrl: url,
                currentContent: mapCurrentContent(content),
                mainStatusSub: mainStatusSubNew,
                bgStatusSub: bgStatusSubNew,
            });

            if (autoPlay) {
                // Register this player as the sole lock-screen owner exactly once —
                // at first creation. Never re-register on the same instance to avoid
                // stacking duplicate MPRemoteCommandCenter handlers in native code.
                try {
                    newSound.setActiveForLockScreen(true, buildLockScreenMetadata(content));
                } catch { }

                // Start narration immediately.
                newSound.play();

                // Delay ambient start by 500ms so the narration HTTP stream claims its
                // native AVAudioSession slot first. In production/native builds, firing
                // two new AVPlayer instances simultaneously causes the ambient buffer to
                // be silently dropped by the OS media engine.
                const capturedBg = newBgSound;
                const capturedKeepBg = keepBg;

                console.log(`[DEBUG-AMBIENT] Will attempt bg .play() in 500ms...`);
                setTimeout(() => {
                    if (get().sound !== newSound) {
                        console.log(`[DEBUG-AMBIENT] setTimeout guard fired — sound changed during delay.`);
                        return; // guard: verse changed during delay
                    }
                    try {
                        console.log(`[DEBUG-AMBIENT] Executing capturedBg?.play()...`);
                        capturedBg?.play();
                        console.log(`[DEBUG-AMBIENT] Executed capturedBg?.play() successfully.`);
                    } catch (e) {
                        console.log(`[DEBUG-AMBIENT] FAILED to execute capturedBg?.play()`, e);
                    }
                    if (!capturedKeepBg) {
                        get()._fadeBgAudio(get().targetBgVolume, 1800);
                    } else {
                        try {
                            if (capturedBg) {
                                console.log(`[DEBUG-AMBIENT] capturedKeepBg is true, forcing volume to targetBgVolume: ${get().targetBgVolume}`);
                                capturedBg.volume = get().targetBgVolume;
                            }
                        } catch { }
                    }
                }, 500);
            } else {
                if (keepBg && newBgSound) {
                    try { newBgSound.pause(); } catch { }
                }
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

        // Do NOT call setActiveForLockScreen(true) here — the player was already registered
        // at creation time. Re-registering adds a new MPRemoteCommandCenter handler on
        // every in-app resume, which stacks up and breaks lock-screen controls.

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