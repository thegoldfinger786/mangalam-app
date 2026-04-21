import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setIsAudioActiveAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, Image } from 'react-native';
import { create } from 'zustand';
import { upsertUserProgress } from '../lib/queries';
import { getBackgroundMood, getBackgroundTrackUrl } from '../utils/backgroundAudioUtils';
import { isRamayan, isGita, isMahabharat, assertBookIdentityConsistency, isBookIdentityReady } from '../lib/bookIdentity';
import { useAppStore } from './useAppStore';
import { logger } from '../lib/logger';

type AudioPlayerLike = ReturnType<typeof createAudioPlayer>;

type SubscriptionLike = {
    remove?: () => void;
} | null;

interface CurrentContent {
    id: string;
    title: string;
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
    lastVerseId: string | null;
    lastPlaybackPosition: number;
    lastBookId: string | null;
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
    appStateSub: SubscriptionLike;
    loadToken: number;
    lastRemoteSyncAt: number;
    remoteSyncInFlight: boolean;

    hydrateAudioSettings: () => Promise<void>;
    setNarrationVolume: (volume: number, persist?: boolean) => Promise<void>;
    setBgVolume: (volume: number, persist?: boolean) => Promise<void>;
    setBgEnabled: (enabled: boolean, persist?: boolean) => Promise<void>;
    loadAudio: (url: string, content: any, autoPlay?: boolean, onFinish?: () => void, startPositionSeconds?: number | null) => Promise<void>;
    unloadAudio: () => Promise<void>;
    togglePlayPause: () => Promise<void>;
    seek: (position: number) => Promise<void>;
    seekForward: () => Promise<void>;
    seekBackward: () => Promise<void>;
    setPlaybackRate: (rate: number) => Promise<void>;
    stopAllAudio: (options?: { keepBg?: boolean; syncEvent?: 'progress' | 'pause' | 'background' | 'unmount' | 'track_change' | 'complete' }) => Promise<void>;
    syncRemoteProgress: (reason: 'progress' | 'pause' | 'background' | 'unmount' | 'track_change' | 'complete', options?: { force?: boolean; positionMs?: number; verseId?: string | null }) => Promise<void>;
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

function getBookDisplayName(content: any): string {
    const explicit =
        content?.book_title ||
        content?.bookTitle ||
        content?.collection_title ||
        content?.collectionTitle;

    if (explicit) return explicit;
    
    // Strict identity-based resolution
    const bookId = content?.book_id || content?.bookId;
    if (isGita(bookId)) return 'Bhagavad Gita';
    if (isRamayan(bookId)) return 'Ramayan';
    if (isMahabharat(bookId)) return 'Mahabharat';
    
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
const REMOTE_SYNC_INTERVAL_MS = 15000;
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
    lastVerseId: null,
    lastPlaybackPosition: 0,
    lastBookId: null,
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
    appStateSub: null,
    loadToken: 0,
    lastRemoteSyncAt: 0,
    remoteSyncInFlight: false,

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
            logger.error('Failed to load audio settings', { 
                error,
                tags: { module: 'audio_store' }
            });
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
                logger.error('Failed to save narration volume', { error });
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
                logger.error('Failed to save background volume', { error });
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
                logger.error('Failed to save background toggle', { error });
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
            return;
        }

        const steps = 20;
        const stepTime = Math.max(25, Math.floor(durationMs / steps));
        const startVolume = typeof bgSound.volume === 'number' ? Math.max(bgSound.volume, MIN_BG_VOLUME) : MIN_BG_VOLUME;
        const volumeStep = (toVolume - startVolume) / steps;

                
        let currentVolume = startVolume;
        let stepCount = 0;

        const interval = setInterval(() => {
            stepCount += 1;
            currentVolume += volumeStep;

            if (currentVolume < MIN_BG_VOLUME) currentVolume = MIN_BG_VOLUME;
            if (currentVolume > 1) currentVolume = 1;

            if (stepCount % 5 === 0) {
                            }

            try {
                bgSound.volume = currentVolume;
            } catch (e) {
            }

            if (stepCount >= steps) {
                try {
                    bgSound.volume = toVolume;
                                    } catch (e) {
                }
                get()._stopFade();
            }
        }, stepTime);

        set({ bgFadeInterval: interval });
    },

    syncRemoteProgress: async (reason, options) => {
        const { currentContent, position, playbackRate, lastRemoteSyncAt, remoteSyncInFlight } = get();
        const session = useAppStore.getState().session;
        const userId = session?.user?.id;
        const bookId = currentContent?.bookId;
        const verseId = options?.verseId ?? currentContent?.id ?? null;
        const force = options?.force ?? false;
        const positionMs = options?.positionMs ?? position;
        const now = Date.now();

        if (!userId || !bookId || !verseId) return;
        if (remoteSyncInFlight) return;

        const posSeconds = Math.max(0, Math.floor(positionMs / 1000));

        // GUARD 1: Prevent duplicate syncs of the exact same position (e.g. during logout)
        if (get().lastVerseId === verseId && get().lastPlaybackPosition === posSeconds) {
            return;
        }

        // GUARD 2: Prevent stale overwrites of remote progress when unmounting before playback starts
        if (reason === 'unmount' && posSeconds === 0 && !get().isPlaying) {
            return;
        }

        if (!force && now - lastRemoteSyncAt < REMOTE_SYNC_INTERVAL_MS) return;

        set({ 
            remoteSyncInFlight: true,
            lastVerseId: verseId,
            lastPlaybackPosition: posSeconds,
            lastBookId: bookId
        });
        

        try {
            await upsertUserProgress({
                userId,
                bookId,
                lastContentId: verseId,
                contentType: 'verse',
                lastPositionSeconds: Math.max(0, Math.floor(positionMs / 1000)),
                playbackSpeed: playbackRate,
            });
            set({ lastRemoteSyncAt: now });
            
        } catch (error) {
            logger.error('Failed to sync remote progress', { 
                error, 
                context: { action: 'syncRemoteProgress', bookId: get().currentContent?.bookId },
                tags: { module: 'audio_store' }
            });
        } finally {
            set({ remoteSyncInFlight: false });
        }
    },

    stopAllAudio: async (options?: { keepBg?: boolean; syncEvent?: 'progress' | 'pause' | 'background' | 'unmount' | 'track_change' | 'complete' }) => {
        const keepBg = options?.keepBg || false;
        const syncEvent = options?.syncEvent || 'unmount';

        if (!keepBg) {
            get()._stopFade();
        }

        const { sound, bgSound, mainStatusSub, bgStatusSub, appStateSub } = get();

        await get().syncRemoteProgress(syncEvent, { force: true });

        mainStatusSub?.remove?.();
        if (!keepBg) {
            bgStatusSub?.remove?.();
            appStateSub?.remove?.();
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
            lockScreenActivated: false,
            mainStatusSub: null,
            bgStatusSub: keepBg ? state.bgStatusSub : null,
            appStateSub: keepBg ? state.appStateSub : null,
            ...(keepBg ? {} : { bgFadeInterval: null }),
        }));
    },

    loadAudio: async (url, content, autoPlay = false, onFinish, startPositionSeconds = null) => {
        const bookId = content?.book_id || content?.bookId;
        assertBookIdentityConsistency({ source: 'useAudioStore.loadAudio', bookId });
        if (!isBookIdentityReady()) {
            // Book identity not ready
        }
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

        const expectedMood = getBackgroundMood(content?.book_id);
        const expectedBgUrl = getBackgroundTrackUrl(expectedMood, 60000);
        const keepBg = existingBgSound !== null && get().currentBgUrl === expectedBgUrl;
        const currentContent = get().currentContent;
        const nextContentId = getContentId(content);
        const syncEvent =
            currentContent?.id && currentContent.id !== nextContentId
                ? 'track_change'
                : 'unmount';

        await get().stopAllAudio({ keepBg, syncEvent });

        try {
            if (get().loadToken !== nextToken) return;

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

            const newSound = createAudioPlayer(url, {
                updateInterval: 100,
                downloadFirst: false,
            });
            newSound.volume = narrationVolume;
            newSound.setPlaybackRate(playbackRate, 'medium');

            let isInitialPlayback = true;
            let hasLoadedAudio = false;
            let resolveLoadedAudio: (() => void) | null = null;
            const loadedAudioPromise = new Promise<void>((resolve) => {
                resolveLoadedAudio = resolve;
            });

            const mainStatusSubNew = newSound.addListener('playbackStatusUpdate', (status: any) => {
                const currentState = get();
                if (currentState.sound !== newSound) return;
                if (!status?.isLoaded) return;
                if (!hasLoadedAudio) {
                    hasLoadedAudio = true;
                    resolveLoadedAudio?.();
                    resolveLoadedAudio = null;
                }

                const positionMs = Math.max(0, Math.floor((status.currentTime || 0) * 1000));
                const durationMs = Math.max(1, Math.floor((status.duration || 0) * 1000));

                const isNowPlaying = !!status.playing;
                const wasPlaying = currentState.isPlaying;

                set({
                    position: (status.positionMillis ?? positionMs),
                    duration: (status.durationMillis ?? durationMs),
                    isPlaying: isNowPlaying,
                });

                const currentAudioUrl = get().audioUrl;

                if (currentAudioUrl && isNowPlaying && (status.positionMillis ?? positionMs) > 0) {
                    const pos = status.positionMillis ?? positionMs;

                    // Save every ~5 seconds
                    if (pos % 5000 < 200) {
                        try {
                            const key = `progress_${normalize(currentAudioUrl)}`;
                            AsyncStorage.setItem(key, String(pos));
                        } catch { }

                        void get().syncRemoteProgress('progress', { positionMs: pos });
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
                                                            void get().syncRemoteProgress('pause', { force: true, positionMs: status.positionMillis ?? positionMs });
                    // Narration paused (e.g. by lock screen or OS interruption)
                    if (currentState.bgSound) {
                        try { currentState.bgSound.pause(); } catch (e) {
                                                    }
                    }
                } else if (!isInitialPlayback && !wasPlaying && isNowPlaying) {
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
                        }
                    }
                }

                const msRemaining = durationMs - positionMs;
                const { bgSound, bgFadeInterval } = get();

                if (msRemaining < 4500 && msRemaining > 0 && bgSound && !bgFadeInterval) {
                                        get()._fadeBgAudio(MIN_BG_VOLUME, 3500);
                }

                if (status.didJustFinish) {
                    set({
                        isPlaying: false,
                        position: 0,
                    });

                    try {
                        if (currentAudioUrl) {
                            const key = `progress_${normalize(currentAudioUrl)}`;
                            AsyncStorage.removeItem(key);
                        }
                    } catch { }

                    void get().syncRemoteProgress('complete', { force: true, positionMs: 0, verseId: getContentId(content) || null });

                    const bg = get().bgSound;
                    if (bg) {
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

            const mood = getBackgroundMood(content?.book_id);
            const bgUrl = getBackgroundTrackUrl(mood, durationMsForBed);

            if (get().loadToken !== nextToken) {
                try { newSound.remove(); } catch { }
                return;
            }

            let newBgSound = get().bgSound;
            let bgStatusSubNew = get().bgStatusSub;
            let appStateSubNew = get().appStateSub;

            if (!keepBg || !newBgSound) {
                
                let sourceUrl = bgUrl;
                try {
                    const localPath = FileSystem.cacheDirectory + encodeURIComponent(bgUrl);
                    const fileInfo = await FileSystem.getInfoAsync(localPath);
                    if (!fileInfo.exists) {
                                                await FileSystem.downloadAsync(bgUrl, localPath);
                    } else {
                                            }
                    sourceUrl = localPath;
                } catch (err) {
                }

                // ===== DIAGNOSTIC: Final sourceUrl analysis =====
                const isLocalFile = !sourceUrl.startsWith('http://') && !sourceUrl.startsWith('https://');
                const startsWithFileProtocol = sourceUrl.startsWith('file://');
                                                                                                                
                                newBgSound = createAudioPlayer(sourceUrl, {
                    updateInterval: 500,
                    // downloadFirst: false — let the native HTTP streamer open the connection
                    // independently. downloadFirst: true caused the player to silently ignore
                    // .play() calls because the 7.6MB file hadn't fully downloaded yet.
                    downloadFirst: false,
                });
                
                newBgSound.loop = true;
                // Initialize with 0.01 to force AVPlayer to eagerly allocate network buffers.
                // Volume 0 makes iOS background resource allocation heuristics stall the stream.
                newBgSound.volume = 0.01;
                
                let ambientStatusUpdateCount = 0;
                bgStatusSubNew = newBgSound.addListener('playbackStatusUpdate', (status: any) => {
                    ambientStatusUpdateCount++;
                    const bgRef = get().bgSound;
                                                                                if (status?.playing === true) {
                                            }
                    if (status?.error) {
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

            if (!appStateSubNew) {
                appStateSubNew = AppState.addEventListener('change', (nextState) => {
                    if (nextState !== 'active') {
                        void get().syncRemoteProgress('background', { force: true });
                    }
                });
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
                appStateSub: appStateSubNew,
            });

            if (autoPlay) {
                let localPositionMs = 0;
                let remotePositionMs = 0;
                let finalPositionMs = 0;
                try {
                    const key = `progress_${normalize(url)}`;
                    const saved = await AsyncStorage.getItem(key);
                    localPositionMs = saved ? Number(saved) : 0;
                    remotePositionMs = startPositionSeconds != null && startPositionSeconds > 0
                        ? Math.floor(startPositionSeconds * 1000)
                        : 0;
                    finalPositionMs = remotePositionMs || localPositionMs || 0;

                    
                    
                    if (remotePositionMs === 0 && localPositionMs > 0) {
                        
                    }
                    await Promise.race([
                        loadedAudioPromise,
                        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
                    ]);
                    if (hasLoadedAudio && finalPositionMs > 0) {
                        await newSound.seekTo(finalPositionMs / 1000);
                    }
                } catch { }

                newSound.play();

                // Delay ambient start by 500ms so the narration HTTP stream claims its
                // native AVAudioSession slot first. In production/native builds, firing
                // two new AVPlayer instances simultaneously causes the ambient buffer to
                // be silently dropped by the OS media engine.
                const capturedBg = newBgSound;
                const capturedKeepBg = keepBg;

                                                setTimeout(() => {
                    if (get().sound !== newSound) {
                                                return; // guard: verse changed during delay
                    }
                    const bgBeforePlay = get().bgSound;
                                                            try {
                                                capturedBg?.play();
                                                                    } catch (e) {
                                            }
                    if (!capturedKeepBg) {
                                                if (get().bgEnabled) {
                            get()._fadeBgAudio(get().targetBgVolume, 1200);
                        } else {
                            capturedBg?.pause();
                        }
                    } else {
                        try {
                            if (capturedBg) {
                                if (get().bgEnabled) {
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
                                        try { newBgSound.pause(); } catch { }
                }
            }
        } catch (error) {
            logger.error('Failed to load audio in store', { 
                error, 
                context: { action: 'loadAudio', url },
                tags: { module: 'audio_store' }
            });
        }
    },

    unloadAudio: async () => {
        await get().syncRemoteProgress('unmount', { force: true });
        await get().stopAllAudio({ syncEvent: 'unmount' });
    },

    togglePlayPause: async () => {
        const { sound, bgSound, isPlaying, position, duration, targetBgVolume, currentContent, bgEnabled } = get();
        if (!sound) return;

        if (isPlaying) {
            await get().syncRemoteProgress('pause', { force: true });
            if (bgSound) {
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

export const stopAudio = async (): Promise<void> => {
    await useAudioStore.getState().stopAllAudio({ keepBg: false, syncEvent: 'unmount' });
};

export const resetAudioState = (): void => {
    const state = useAudioStore.getState();
    if (state.bgFadeInterval) {
        clearInterval(state.bgFadeInterval);
    }
    
    useAudioStore.setState({
        sound: null,
        bgSound: null,
        currentBgUrl: null,
        isPlaying: false,
        position: 0,
        duration: 1,
        audioUrl: null,
        currentContent: null,
        onFinish: undefined,
        lockScreenActivated: false,
        mainStatusSub: null,
        bgStatusSub: null,
        appStateSub: null,
        bgFadeInterval: null,
        remoteSyncInFlight: false,
    });
};
