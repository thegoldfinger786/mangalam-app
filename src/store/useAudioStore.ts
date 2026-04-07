import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
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
    lockScreenActivated: boolean;

    bgFadeInterval: ReturnType<typeof setInterval> | null;
    narrationVolume: number;
    targetBgVolume: number;
    lastBgVolume: number;
    bgEnabled: boolean;
    audioSettingsLoaded: boolean;
    mainStatusSub: SubscriptionLike;
    bgStatusSub: SubscriptionLike;
    loadToken: number;

    hydrateAudioSettings: () => Promise<void>;
    setNarrationVolume: (volume: number, persist?: boolean) => Promise<void>;
    setBgVolume: (volume: number, persist?: boolean) => Promise<void>;
    setBgEnabled: (enabled: boolean, persist?: boolean) => Promise<void>;
    loadAudio: (url: string, content: any, autoPlay?: boolean, onFinish?: () => void) => Promise<void>;
    unloadAudio: () => Promise<void>;
    togglePlayPause: () => Promise<void>;
    seek: (position: number) => Promise<void>;
    seekForward: () => Promise<void>;
    seekBackward: () => Promise<void>;
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
        artworkUrl: getArtworkUrl(content) || DEFAULT_ARTWORK_URL,
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

const AUDIO_SETTINGS_KEY = 'audio_settings';
const DEFAULT_NARRATION_VOLUME = 0.9;
const DEFAULT_BG_VOLUME = 0.6;
const MIN_BG_VOLUME = 0.01;
const DEFAULT_ARTWORK_URL = Image.resolveAssetSource(require('../../assets/images/Mangalam-cover.jpeg')).uri;
const clampNarrationVolume = (volume: number) => Math.min(1, Math.max(0.7, volume));
const clampBgVolume = (volume: number) => Math.min(0.8, Math.max(0, volume));
const normalize = (url?: string | null) =>
    url ? url.split('?')[0] : null;

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
    lockScreenActivated: false,

    bgFadeInterval: null,
    narrationVolume: DEFAULT_NARRATION_VOLUME,
    targetBgVolume: DEFAULT_BG_VOLUME,
    lastBgVolume: DEFAULT_BG_VOLUME,
    bgEnabled: true,
    audioSettingsLoaded: false,
    mainStatusSub: null,
    bgStatusSub: null,
    loadToken: 0,

    hydrateAudioSettings: async () => {
        if (get().audioSettingsLoaded) return;

        try {
            const raw = await AsyncStorage.getItem(AUDIO_SETTINGS_KEY);
            if (raw) {
                let parsed = null;
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    parsed = null;
                }
                const narrationVolume =
                    typeof parsed?.narrationVolume === 'number'
                        ? clampNarrationVolume(parsed.narrationVolume)
                        : DEFAULT_NARRATION_VOLUME;
                const bgVolume =
                    typeof parsed?.bgVolume === 'number'
                        ? clampBgVolume(parsed.bgVolume)
                        : DEFAULT_BG_VOLUME;
                const lastBgVolume =
                    typeof parsed?.lastBgVolume === 'number'
                        ? Math.max(clampBgVolume(parsed.lastBgVolume), MIN_BG_VOLUME)
                        : Math.max(bgVolume, MIN_BG_VOLUME);
                const bgEnabled = typeof parsed?.bgEnabled === 'boolean' ? parsed.bgEnabled : true;

                set({
                    narrationVolume,
                    targetBgVolume: bgEnabled ? Math.max(bgVolume, MIN_BG_VOLUME) : MIN_BG_VOLUME,
                    lastBgVolume,
                    bgEnabled,
                    audioSettingsLoaded: true,
                });
                return;
            }
        } catch (error) {
            console.error('Error loading audio settings:', error);
        }

        set({ audioSettingsLoaded: true });
    },

    setNarrationVolume: async (volume, persist = true) => {
        const { sound, bgEnabled, lastBgVolume } = get();
        const nextVolume = clampNarrationVolume(volume);

        set({ narrationVolume: nextVolume });

        if (sound) {
            try {
                sound.volume = nextVolume;
            } catch { }
        }

        if (persist) {
            try {
                await AsyncStorage.setItem(
                    AUDIO_SETTINGS_KEY,
                    JSON.stringify({
                        narrationVolume: nextVolume,
                        bgVolume: lastBgVolume,
                        lastBgVolume,
                        bgEnabled,
                    })
                );
            } catch (error) {
                console.error('Error saving narration volume:', error);
            }
        }
    },

    setBgVolume: async (volume, persist = true) => {
        const { narrationVolume, bgSound, bgEnabled, lastBgVolume } = get();
        const nextVolume = clampBgVolume(volume);
        const nextEnabled = nextVolume > MIN_BG_VOLUME;
        const nextLastBgVolume = nextVolume > MIN_BG_VOLUME ? nextVolume : lastBgVolume;
        const effectiveBgVolume = nextEnabled ? Math.max(nextVolume, MIN_BG_VOLUME) : MIN_BG_VOLUME;

        set({
            targetBgVolume: effectiveBgVolume,
            lastBgVolume: nextLastBgVolume,
            bgEnabled: nextEnabled,
        });

        if (bgSound) {
            try {
                bgSound.volume = Math.max(effectiveBgVolume, MIN_BG_VOLUME);
            } catch { }
        }

        if (persist) {
            try {
                await AsyncStorage.setItem(
                    AUDIO_SETTINGS_KEY,
                    JSON.stringify({
                        narrationVolume,
                        bgVolume: nextLastBgVolume,
                        lastBgVolume: nextLastBgVolume,
                        bgEnabled: nextEnabled,
                    })
                );
            } catch (error) {
                console.error('Error saving background volume:', error);
            }
        }
    },

    setBgEnabled: async (enabled, persist = true) => {
        const { narrationVolume, lastBgVolume, bgSound } = get();
        const restoredBgVolume = Math.max(lastBgVolume, MIN_BG_VOLUME);
        const nextBgVolume = enabled ? restoredBgVolume : MIN_BG_VOLUME;

        set({
            bgEnabled: enabled,
            targetBgVolume: nextBgVolume,
        });

        if (bgSound) {
            try {
                if (!enabled) {
                    get()._fadeBgAudio(MIN_BG_VOLUME, 500);
                    const capturedBg = bgSound;
                    setTimeout(() => {
                        try {
                            if (get().bgSound === capturedBg) {
                                capturedBg.pause();
                            }
                        } catch { }
                    }, 500);
                } else {
                    bgSound.play();
                    bgSound.volume = MIN_BG_VOLUME;
                    get()._fadeBgAudio(nextBgVolume, 800);
                }
            } catch { }
        }

        if (persist) {
            try {
                await AsyncStorage.setItem(
                    AUDIO_SETTINGS_KEY,
                    JSON.stringify({
                        narrationVolume,
                        bgVolume: restoredBgVolume,
                        lastBgVolume: restoredBgVolume,
                        bgEnabled: enabled,
                    })
                );
            } catch (error) {
                console.error('Error saving background toggle:', error);
            }
        }
    },

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
        const startVolume = typeof bgSound.volume === 'number' ? Math.max(bgSound.volume, MIN_BG_VOLUME) : MIN_BG_VOLUME;
        const volumeStep = (toVolume - startVolume) / steps;

        console.log(`[DEBUG-AMBIENT] _fadeBgAudio started -> targeting volume: ${toVolume} over ${durationMs}ms`);
        console.log(`[DEBUG-AMBIENT] fade starting from current native volume: ${startVolume}`);

        let currentVolume = startVolume;
        let stepCount = 0;

        const interval = setInterval(() => {
            stepCount += 1;
            currentVolume += volumeStep;

            if (currentVolume < MIN_BG_VOLUME) currentVolume = MIN_BG_VOLUME;
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
            console.log(`[DIAG-AMBIENT-PAUSE] bgSound.pause() triggered by stopAllAudio (keepBg=false)`);
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
            lockScreenActivated: false,
            mainStatusSub: null,
            bgStatusSub: keepBg ? state.bgStatusSub : null,
            ...(keepBg ? {} : { bgFadeInterval: null }),
        }));
    },

    loadAudio: async (url, content, autoPlay = false, onFinish) => {
        await get().hydrateAudioSettings();

        const nextToken = get().loadToken + 1;
        set({ loadToken: nextToken });

        const {
            sound: existingSound,
            bgSound: existingBgSound,
            audioUrl,
            playbackRate,
            narrationVolume,
        } = get();

        get()._stopFade();

        if (audioUrl === url && existingSound) {
            set({
                onFinish,
                currentContent: mapCurrentContent(content),
            });

            try {
                existingSound.updateLockScreenMetadata(
                    buildLockScreenMetadata(content)
                );
            } catch { }

            if (autoPlay && !get().isPlaying) {
                // Do NOT call setActiveForLockScreen(true) here — the player is already registered
                // from its initial creation. Re-registering stacks duplicate remote command handlers
                // in native MediaController, which silently breaks lock-screen resume.
                if (existingBgSound) {
                    try {
                        existingBgSound.play();
                        if (get().bgEnabled) {
                            get()._fadeBgAudio(get().targetBgVolume, 1200);
                        } else {
                            existingBgSound.pause();
                        }
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
                lockScreenActivated: false,
                ...(keepBg ? {} : { bgSound: null, bgStatusSub: null, currentBgUrl: null }),
            });

            if (!url) {
                set({
                    position: 0,
                    duration: 1,
                    isPlaying: false,
                    currentContent: mapCurrentContent(content),
                    lockScreenActivated: false,
                });
                return;
            }
            if (get().loadToken !== nextToken) return;

            const newSound = createAudioPlayer(url, {
                updateInterval: 100,
                downloadFirst: false,
            });
            newSound.volume = narrationVolume;
            newSound.setPlaybackRate(playbackRate, 'medium');

            let isInitialPlayback = true;

            const mainStatusSubNew = newSound.addListener('playbackStatusUpdate', (status: any) => {
                const currentState = get();
                if (currentState.sound !== newSound) return;
                if (!status?.isLoaded) return;

                const positionMs = Math.max(0, Math.floor((status.currentTime || 0) * 1000));
                const durationMs = Math.max(1, Math.floor((status.duration || 0) * 1000));

                const isNowPlaying = !!status.playing;
                const wasPlaying = currentState.isPlaying;

                set({
                    position: (status.positionMillis ?? positionMs),
                    duration: (status.durationMillis ?? durationMs),
                    isPlaying: isNowPlaying,
                });

                if (audioUrl && isNowPlaying && (status.positionMillis ?? positionMs) > 0) {
                    const pos = status.positionMillis ?? positionMs;

                    // Save every ~5 seconds
                    if (pos % 5000 < 200) {
                        try {
                            const key = `progress_${normalize(audioUrl)}`;
                            AsyncStorage.setItem(key, String(pos));
                        } catch { }
                    }
                }

                if (
                    !currentState.lockScreenActivated &&
                    isNowPlaying &&
                    (status.durationMillis ?? durationMs) > 0
                ) {
                    try {
                        newSound.setActiveForLockScreen(
                            true,
                            buildLockScreenMetadata(content),
                            { showSeekForward: true, showSeekBackward: true }
                        );
                    } catch { }

                    set({ lockScreenActivated: true });
                }

                // Clear initial lock when first stable playing packet arrives
                if (isInitialPlayback && isNowPlaying) {
                    isInitialPlayback = false;
                }

                if (wasPlaying && !isNowPlaying) {
                    console.log(`[DIAG-AMBIENT-PAUSE] bgSound.pause() triggered by narration sync (wasPlaying->!isNowPlaying)`);
                    console.log(`[DIAG-AMBIENT-PAUSE] bgSound exists: ${!!currentState.bgSound}, bgSound.volume: ${currentState.bgSound?.volume}`);
                    // Narration paused (e.g. by lock screen or OS interruption)
                    if (currentState.bgSound) {
                        try { currentState.bgSound.pause(); } catch (e) {
                            console.log(`[DIAG-AMBIENT-PAUSE] Sync pause failed`, e);
                        }
                    }
                } else if (!isInitialPlayback && !wasPlaying && isNowPlaying) {
                    console.log(`[DEBUG-AMBIENT] Sync logic: Narration RESUMED. Playing ambient & fading in.`);
                    // Narration resumed (e.g. by lock screen or OS command)
                    // Fire activation to violently wake the AVAudioSession if dead
                    setIsAudioActiveAsync(true).catch(() => { });

                    if (currentState.bgSound) {
                        try {
                            if (get().bgEnabled) {
                                currentState.bgSound.play();
                                get()._fadeBgAudio(get().targetBgVolume, 1000);
                            } else {
                                currentState.bgSound.pause();
                            }
                        } catch (e) {
                            console.log(`[DEBUG-AMBIENT] Sync logic: ambient resume failed`, e);
                        }
                    }
                }

                const msRemaining = durationMs - positionMs;
                const { bgSound, bgFadeInterval } = get();

                if (msRemaining < 4500 && msRemaining > 0 && bgSound && !bgFadeInterval) {
                    console.log(`[DIAG-AMBIENT-PAUSE] Fade-to-zero triggered by end-of-narration (msRemaining: ${msRemaining})`);
                    get()._fadeBgAudio(MIN_BG_VOLUME, 3500);
                }

                if (status.didJustFinish) {
                    set({
                        isPlaying: false,
                        position: durationMs,
                    });

                    try {
                        if (audioUrl) {
                            const key = `progress_${normalize(audioUrl)}`;
                            AsyncStorage.removeItem(key);
                        }
                    } catch { }

                    const bg = get().bgSound;
                    if (bg) {
                        console.log(`[DIAG-AMBIENT-PAUSE] bgSound.pause() triggered by didJustFinish`);
                        try {
                            bg.pause();
                            bg.seekTo(0);
                            bg.volume = MIN_BG_VOLUME;
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

                // ===== DIAGNOSTIC: Final sourceUrl analysis =====
                const isLocalFile = !sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://');
                const startsWithFileProtocol = sourceUrl.startsWith('file://');
                console.log(`[DIAG-AMBIENT-SOURCE] ====================================`);
                console.log(`[DIAG-AMBIENT-SOURCE] Final sourceUrl: ${sourceUrl}`);
                console.log(`[DIAG-AMBIENT-SOURCE] Is LOCAL file path: ${isLocalFile}`);
                console.log(`[DIAG-AMBIENT-SOURCE] Starts with file://: ${startsWithFileProtocol}`);
                console.log(`[DIAG-AMBIENT-SOURCE] Is REMOTE URL: ${!isLocalFile}`);
                console.log(`[DIAG-AMBIENT-SOURCE] Original remote bgUrl: ${bgUrl}`);
                console.log(`[DIAG-AMBIENT-SOURCE] ====================================`);

                console.log(`[DIAG-AMBIENT] About to call createAudioPlayer(sourceUrl) ...`);
                newBgSound = createAudioPlayer(sourceUrl, {
                    updateInterval: 500,
                    // downloadFirst: false — let the native HTTP streamer open the connection
                    // independently. downloadFirst: true caused the player to silently ignore
                    // .play() calls because the 7.6MB file hadn't fully downloaded yet.
                    downloadFirst: false,
                });
                console.log(`[DIAG-AMBIENT] createAudioPlayer returned. Player object exists: ${!!newBgSound}`);

                newBgSound.loop = true;
                // Initialize with 0.01 to force AVPlayer to eagerly allocate network buffers.
                // Volume 0 makes iOS background resource allocation heuristics stall the stream.
                newBgSound.volume = 0.01;
                console.log(`[DIAG-AMBIENT] Set loop=true, initial volume=0.01`);

                let ambientStatusUpdateCount = 0;
                bgStatusSubNew = newBgSound.addListener('playbackStatusUpdate', (status: any) => {
                    ambientStatusUpdateCount++;
                    const bgRef = get().bgSound;
                    console.log(`[DIAG-AMBIENT-STATUS] #${ambientStatusUpdateCount} | playing: ${status?.playing}, isLoaded: ${status?.isLoaded}, isBuffering: ${status?.isBuffering}, didJustFinish: ${status?.didJustFinish}, error: ${status?.error}`);
                    console.log(`[DIAG-AMBIENT-STATUS] #${ambientStatusUpdateCount} | durationMillis: ${status?.duration != null ? Math.floor(status.duration * 1000) : 'N/A'}, positionMillis: ${status?.currentTime != null ? Math.floor(status.currentTime * 1000) : 'N/A'}`);
                    console.log(`[DIAG-AMBIENT-STATUS] #${ambientStatusUpdateCount} | bgSound.volume at status update: ${bgRef?.volume}`);
                    if (status?.playing === true) {
                        console.log(`[DIAG-AMBIENT-STATUS] ★★★ AMBIENT REACHED playing === true ★★★ (update #${ambientStatusUpdateCount})`);
                    }
                    if (status?.error) {
                        console.log(`[DIAG-AMBIENT-STATUS] ✖✖✖ AMBIENT ERROR: ${JSON.stringify(status.error)} ✖✖✖`);
                    }
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
                lockScreenActivated: false,
                mainStatusSub: mainStatusSubNew,
                bgStatusSub: bgStatusSubNew,
            });

            if (autoPlay) {
                try {
                    const key = `progress_${normalize(url)}`;
                    const saved = await AsyncStorage.getItem(key);
                    if (saved) {
                        await newSound.seekTo(Number(saved) / 1000);
                    }
                } catch { }

                newSound.play();

                // Delay ambient start by 500ms so the narration HTTP stream claims its
                // native AVAudioSession slot first. In production/native builds, firing
                // two new AVPlayer instances simultaneously causes the ambient buffer to
                // be silently dropped by the OS media engine.
                const capturedBg = newBgSound;
                const capturedKeepBg = keepBg;

                console.log(`[DIAG-AMBIENT-PLAY] Will attempt bg .play() in 500ms...`);
                console.log(`[DIAG-AMBIENT-PLAY] capturedBg exists: ${!!capturedBg}, capturedKeepBg: ${capturedKeepBg}`);
                setTimeout(() => {
                    if (get().sound !== newSound) {
                        console.log(`[DIAG-AMBIENT-PLAY] setTimeout guard ABORTED — sound changed during 500ms delay.`);
                        return; // guard: verse changed during delay
                    }
                    const bgBeforePlay = get().bgSound;
                    console.log(`[DIAG-AMBIENT-PLAY] Inside setTimeout. bgSound from store: ${!!bgBeforePlay}, capturedBg: ${!!capturedBg}`);
                    console.log(`[DIAG-AMBIENT-PLAY] capturedBg.volume BEFORE .play(): ${capturedBg?.volume}`);
                    try {
                        console.log(`[DIAG-AMBIENT-PLAY] >>> Calling capturedBg?.play() NOW <<<`);
                        capturedBg?.play();
                        console.log(`[DIAG-AMBIENT-PLAY] >>> capturedBg?.play() returned successfully <<<`);
                        console.log(`[DIAG-AMBIENT-PLAY] capturedBg.volume AFTER .play(): ${capturedBg?.volume}`);
                    } catch (e) {
                        console.log(`[DIAG-AMBIENT-PLAY] ✖✖✖ FAILED capturedBg?.play() ✖✖✖`, e);
                    }
                    if (!capturedKeepBg) {
                        console.log(`[DIAG-AMBIENT-PLAY] Starting fade to targetBgVolume: ${get().targetBgVolume} over 1200ms`);
                        if (get().bgEnabled) {
                            get()._fadeBgAudio(get().targetBgVolume, 1200);
                        } else {
                            capturedBg?.pause();
                        }
                    } else {
                        try {
                            if (capturedBg) {
                                if (get().bgEnabled) {
                                    console.log(`[DIAG-AMBIENT-PLAY] capturedKeepBg=true, forcing volume to targetBgVolume: ${get().targetBgVolume}`);
                                    capturedBg.volume = get().targetBgVolume;
                                } else {
                                    capturedBg.pause();
                                }
                            }
                        } catch { }
                    }
                }, 500);
            } else {
                if (keepBg && newBgSound) {
                    console.log(`[DIAG-AMBIENT-PAUSE] bgSound.pause() triggered by autoPlay=false with keepBg=true`);
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
        const { sound, bgSound, isPlaying, position, duration, targetBgVolume, currentContent, bgEnabled } = get();
        if (!sound) return;

        if (isPlaying) {
            if (bgSound) {
                console.log(`[DIAG-AMBIENT-PAUSE] bgSound.pause() triggered by togglePlayPause (user paused)`);
                get()._fadeBgAudio(MIN_BG_VOLUME, 500);
                const capturedBg = bgSound;
                setTimeout(() => {
                    try {
                        if (get().bgSound === capturedBg) {
                            capturedBg.pause();
                        }
                    } catch { }
                }, 500);
            }
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

        if (bgEnabled) {
            try { bgSound?.play(); } catch { }
        }
        sound.play();

        if (bgSound && bgEnabled) {
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

    seekForward: async () => {
        const { sound, position, duration } = get();
        if (!sound) return;

        const target = Math.min(position + 15000, duration > 0 ? duration : position + 15000);
        await sound.seekTo(target / 1000);
        set({ position: target });
    },

    seekBackward: async () => {
        const { sound, position } = get();
        if (!sound) return;

        const target = Math.max(position - 15000, 0);
        await sound.seekTo(target / 1000);
        set({ position: target });
    },

    setPlaybackRate: async (rate) => {
        const { sound } = get();

        if (sound) {
            sound.setPlaybackRate(rate, 'medium');
        }

        set({ playbackRate: rate });
    },
}));
