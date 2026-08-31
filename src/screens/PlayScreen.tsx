import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Image,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { AppText } from '../components/AppText';
import { HighlightedText } from '../components/HighlightedText';
import { LoadError } from '../components/LoadError';
import { Skeleton } from '../components/Skeleton';
import { BottomSafeAreaContainer } from '../components/layout/BottomSafeAreaContainer';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { COLLECTION_METADATA } from '../data/collectionMetadata';
import { assertValidBookId, assertBookIdentityConsistency, getBookCode } from '../lib/bookIdentity';
import { formatRef } from '../lib/bookTerminology';
import { cleanContentText, stripMarkup } from '../lib/contentText';
import { checkAudioCache, fetchAdjacentVerse, fetchIsBookmarked, fetchUserProgress, fetchVerseAudio, fetchVerseByIdAndBookId, incrementDailyUsage, logActivity, toggleBookmark, upsertUserProgress } from '../lib/queries';
import { navigationRef } from '../navigation/navigationRef';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabaseClient';
import { useAppStore } from '../store/useAppStore';
import { useAudioStore } from '../store/useAudioStore';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

const GITA_COVER = require('../../assets/images/gita-cover.jpg');
const RAMAYAN_COVER = require('../../assets/images/ramayan-cover.jpg');
const MAHABHARAT_COVER = require('../../assets/images/mahabharat-cover.jpg');

// ── App download links ───────────────────────────────────────────────────────────────
// Included in every share message so recipients can download the app.
// TODO: confirm iOS App Store numeric ID once listing is live, then update APP_STORE_URL.
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dailyshlokyaag.mangalam';
const APP_STORE_URL  = 'https://apps.apple.com/app/mangalam/id6741428426'; // ← update ID if needed

// How long the transcript follow-along waits after the listener stops scrolling
// by hand before it resumes tracking playback.
const AUTO_SCROLL_RESUME_DELAY_MS = 6000;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PlayRouteProp = RouteProp<RootStackParamList, 'Play'>;

export const PlayScreen = () => {
    const { colors, spacing, typography, borderRadius, layout } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, spacing, typography, borderRadius),
        [colors, spacing, typography, borderRadius]
    );
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<PlayRouteProp>();
    const params = route.params;
    const itemId = 'itemId' in params ? params.itemId : params.verseId;
    const autoPlay = params.autoPlay ?? false;
    const resumePosition = params.startPosition ?? params.position ?? 0;
    const resumeSource = params.resumeSource ?? 'default';
    const bookId = params.bookId;
    assertBookIdentityConsistency({ source: 'PlayScreen', bookId });
    if (!bookId) {
        throw new Error("BOOK_ID_REQUIRED");
    }

    const { voicePreference, session, playbackRate, setPlaybackRate, setVoicePreference } = useAppStore();
    const {
        loadAudio,
        syncRemoteProgress,
        togglePlayPause: storeTogglePlayPause,
        isPlaying,
        audioLoadError,
        position,
        duration,
        seek,
        setPlaybackRate: setStoreRate
    } = useAudioStore();

    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<any>(null);

    const [currentBookSlug, setCurrentBookSlug] = useState<string | null>(null);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [prevVerseId, setPrevVerseId] = useState<string | null>(null);
    const [nextVerseId, setNextVerseId] = useState<string | null>(null);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [hasLoggedListen, setHasLoggedListen] = useState(false);

    // NEW: For Focus/Immersive mode
    const [isFocusMode, setIsFocusMode] = useState(false);

    // Shared values for animations
    const playPauseAnim = useSharedValue(isPlaying ? 1 : 0);
    const focusModeAnim = useSharedValue(0);

    useEffect(() => {
        playPauseAnim.value = withSpring(isPlaying ? 1 : 0, { damping: 15 });
    }, [isPlaying, playPauseAnim]);

    useEffect(() => {
        focusModeAnim.value = withTiming(isFocusMode ? 1 : 0, { duration: 400 });
    }, [isFocusMode, focusModeAnim]);

    const scrollRef = useRef<ScrollView>(null);
    // Timestamp until which the transcript follow-along stays out of the listener's way.
    const autoScrollPausedUntilRef = useRef(0);
    // The verse whose "session" was already counted — so a language switch (which
    // re-runs the loader via the voicePreference dep) doesn't re-increment usage.
    const usageCountedForRef = useRef<string | null>(null);
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            void syncRemoteProgress('unmount', { force: true });
            // Do not stop audio on screen unmount
        };
    }, [syncRemoteProgress]);



    const [scrollContentHeight, setScrollContentHeight] = useState(0);
    const [scrollViewHeight, setScrollViewHeight] = useState(0);
    const [playerBarHeight, setPlayerBarHeight] = useState(layout.placeholderHeight);
    const invalidPlaybackContext = !itemId || !assertValidBookId(bookId, 'PlayScreen.render');

    const meta = COLLECTION_METADATA[currentBookSlug as string] || { title: 'Unknown', icon: 'book', color: colors.primary };

    // Single cache lookup for classification — avoids 3 separate scans
    const bookCode = getBookCode(bookId);
    const isRamayan = bookCode === 'ramayan';
    const isMahabharat = bookCode === 'mahabharat';
    const isGita = bookCode === 'gita' || bookCode === 'bhagavad_gita';

    const loadContentAndCheckUsage = useCallback(async () => {
        // Read session and playbackRate at call time instead of closing over them.
        // Neither identifies *which* verse to load, but both change for unrelated
        // reasons: the session object is replaced on every token refresh, and
        // playbackRate changes whenever the user taps the speed pill. As
        // dependencies they re-ran this entire loader — re-incrementing daily
        // usage each time and inflating the streak data it feeds.
        // Same getState() pattern already used elsewhere in this file.
        const { session: currentSession, playbackRate: currentPlaybackRate } =
            useAppStore.getState();

        if (!currentSession) return;

        try {
            if (!isMountedRef.current) return;
            setLoading(true);
            setPlaybackError(null);

            // 1. Content Fetching
            const lang = voicePreference.startsWith('hindi') ? 'hi' : 'en';

            if (!bookId || typeof bookId !== 'string') {
                logger.warn('PlayScreen missing bookId for playback', { params });
                if (isMountedRef.current) {
                    setPlaybackError("We couldn't open this verse.");
                    setLoading(false);
                }
                return;
            }

            const verse = await fetchVerseByIdAndBookId(bookId, itemId);
            if (!verse) {
                logger.warn('Verse not found for playback', { params });
                if (isMountedRef.current) {
                    setPlaybackError("We couldn't find this verse.");
                    setLoading(false);
                }
                return;
            }

            const resolvedBookSlug = verse?.books?.slug ?? null;

            if (bookId && verse.book_id !== bookId) {
                logger.error('BOOK MISMATCH BUG', { 
                    context: { params, verseId: verse?.verse_id },
                    level: 'fatal',
                    tags: { module: 'audio' }
                });
            }

            let data: any = {
                ...verse,
                book_slug: resolvedBookSlug,
                book_title: verse?.books?.title ?? verse?.books?.title_en ?? verse?.books?.title_hi ?? null,
            };
            delete data.books;

            const { data: verseContent } = await supabase
                .from('verse_content')
                .select('*')
                .eq('verse_id', itemId)
                .eq('language', lang)
                .single();

            data = { ...verse, ...verseContent };
            delete data.books;
            data.book_slug = resolvedBookSlug;
            data.book_title = verse?.books?.title ?? verse?.books?.title_en ?? verse?.books?.title_hi ?? null;

            if (!isMountedRef.current) return;
            setContent(data);
            setCurrentBookSlug(resolvedBookSlug);

            let nextId: string | null = null;
            if (data?.book_id) {
                if (!isMountedRef.current) return;
                const [prev, next] = await Promise.all([
                    fetchAdjacentVerse(data.book_id, data.chapter_no, data.verse_no, 'prev'),
                    fetchAdjacentVerse(data.book_id, data.chapter_no, data.verse_no, 'next'),
                ]);
                if (!isMountedRef.current) return;
                setPrevVerseId(prev?.verse_id ?? null);
                setNextVerseId(next?.verse_id ?? null);
                nextId = next?.verse_id ?? null;
            } else {
                if (!isMountedRef.current) return;
                setPrevVerseId(null);
                setNextVerseId(null);
            }

            // Check bookmark status
            if (session) {
                const bookmarked = await fetchIsBookmarked(currentSession.user.id, itemId);
                if (!isMountedRef.current) return;
                setIsBookmarked(bookmarked);
            }

            // 2. Increment Usage (Non-blocking) — once per verse, not per reload
            if (usageCountedForRef.current !== itemId) {
                usageCountedForRef.current = itemId;
                try {
                    await incrementDailyUsage(currentSession.user.id);
                } catch {
                    // Ignore usage error silently
                }
            }

            // 3. Audio Cache Check
            const gender = voicePreference.endsWith('-male') ? 'male' : 'female';

            // Unified Voice Map covering both Wavenet and Neural2 standards found in DB
            const VOICE_OPTIONS: Record<string, string[]> = {
                'en-male': ['en-IN-Wavenet-B', 'en-IN-Neural2-B'],
                'en-female': ['en-IN-Wavenet-A', 'en-IN-Neural2-A'],
                'hi-male': ['hi-IN-Wavenet-C', 'hi-IN-Neural2-B'],
                'hi-female': ['hi-IN-Wavenet-A', 'hi-IN-Neural2-A']
            };

            const preferredKey = `${lang}-${gender}`;
            const voiceCandidates = VOICE_OPTIONS[preferredKey] || [];

            try {
                let cache = null;
                const isCanonicalBook = isGita || isRamayan || isMahabharat;

                if (isCanonicalBook && data.book_id) {
                    // Refined canonical layer: use is_primary_playback and status='ready'
                    cache = await fetchVerseAudio(data.book_id, itemId, lang, voicePreference);
                } else {
                    // Fallback to legacy cache for other content
                    for (const voiceId of voiceCandidates) {
                        const result = await checkAudioCache({
                            contentType: 'verse',
                            contentId: itemId,
                            section: 'full_narrative',
                            lang,
                            voice: voiceId,
                            engine: 'google-tts'
                        });
                        if (result?.storage_path) {
                            cache = result;
                            break;
                        }
                    }
                }


                let resolvedArtworkUrl: string | undefined;
                if (isGita) resolvedArtworkUrl = Image.resolveAssetSource(GITA_COVER).uri;
                else if (isRamayan) resolvedArtworkUrl = Image.resolveAssetSource(RAMAYAN_COVER).uri;
                else if (isMahabharat) resolvedArtworkUrl = Image.resolveAssetSource(MAHABHARAT_COVER).uri;

                if (cache?.storage_path) {
                    const bucket = (cache as any).storage_bucket || 'audio-content';
                    const { data: urlData } = supabase.storage
                        .from(bucket)
                        .getPublicUrl(cache.storage_path);

                    if (urlData?.publicUrl) {
                        const onFinish = () => {
                            // A verse counts as completed only when its audio actually
                            // finishes — not when the screen opens (LIB-06 / UX-04).
                            useAppStore.getState().addCompletedVerse(itemId);
                            if (nextId) {
                                navigateToVerse(nextId, true);
                            }
                        };
                        const { audioUrl } = useAudioStore.getState();

                        const normalize = (url?: string | null) =>
                            url ? url.split('?')[0] : null;

                        const currentAudioUrl = normalize(audioUrl);
                        const nextAudioUrl = normalize(urlData.publicUrl);

                        if (currentAudioUrl && currentAudioUrl === nextAudioUrl) {
                            return;
                        }

                        const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`;
                        
                        loadAudio(freshUrl, { ...data, artworkUrl: resolvedArtworkUrl }, autoPlay, onFinish, resumePosition);
                    }
                } else {
                    // Ensure state is updated so user can still see text and manually navigate
                    loadAudio('', { ...data, artworkUrl: resolvedArtworkUrl }, false, () => {
                        useAppStore.getState().addCompletedVerse(itemId);
                        if (nextId) navigateToVerse(nextId, true);
                    }, resumePosition);
                }
            } catch (cacheError) {
                logger.warn('Audio cache lookup failed', { cacheError });
            }
            // 4. Progress Persistence (Sync current verse and restore speed)
            if (data?.book_id) {
                try {
                    const progress = await fetchUserProgress(currentSession.user.id, data.book_id);

                    // If we have saved progress, and this is the first load of the session (optional check)
                    // or just generally restore the speed if available.
                    if (progress?.playback_speed) {
                        setPlaybackRate(progress.playback_speed);
                    }

                    // Save current position
                    await upsertUserProgress({
                        userId: currentSession.user.id,
                        bookId: data.book_id,
                        lastContentId: itemId,
                        contentType: 'verse',
                        lastPositionSeconds: Math.max(0, Math.floor(resumePosition)),
                        playbackSpeed: progress?.playback_speed || currentPlaybackRate
                    });
                } catch (progError) {
                    logger.error('Progress sync failed', { error: progError });
                }
            }

        } catch (error) {
            logger.error('PlayScreen initialization failed', { 
                error,
                tags: { module: 'audio' }
            });
            if (isMountedRef.current) {
                setPlaybackError("We couldn't load this verse just now.");
            }
        } finally {
            if (isMountedRef.current) setLoading(false);
        }
        // `session` is read fresh via `useAppStore.getState()` on purpose, so it is
        // not a dep — otherwise an hourly token refresh would reload all content.
        // The identity helpers and `navigateToVerse` are stable (memoised on bookId).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoPlay, itemId, loadAudio, params, bookId, resumePosition, resumeSource, setPlaybackRate, voicePreference]);

    useEffect(() => {
        loadContentAndCheckUsage();
    }, [loadContentAndCheckUsage]);

    // A failed audio load in the store → the same retry screen as a content error.
    useEffect(() => {
        if (audioLoadError) setPlaybackError("The audio for this verse wouldn't load.");
    }, [audioLoadError]);

    useEffect(() => {
        if (isPlaying && !hasLoggedListen && session) {
            setHasLoggedListen(true);
            logActivity(session.user.id, itemId, 'verse', 'listen');
        }
        // Fires only on play/pause transitions; the `hasLoggedListen` guard is
        // reset per verse elsewhere, so it must not itself be a dep.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    useEffect(() => {
        const unsubscribeBlur = navigation.addListener('blur', () => {
            void syncRemoteProgress('unmount', { force: true });
        });

        return () => {
            unsubscribeBlur();
        };
    }, [navigation, syncRemoteProgress]);

    // Auto-scroll transcript proportionally to audio position.
    // While the listener is scrolling by hand — and for a short settle period after
    // they let go — the follow-along yields, so reading ahead or back isn't yanked
    // away on the next position tick. It resumes on its own once they stop.
    useEffect(() => {
        if (!isPlaying || duration <= 1 || scrollContentHeight <= scrollViewHeight) return;
        if (Date.now() < autoScrollPausedUntilRef.current) return;
        const progress = position / duration;
        const maxScroll = scrollContentHeight - scrollViewHeight;
        const targetY = progress * maxScroll;
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
        // Deliberately driven by `position` alone (the ~4Hz ticker); the other
        // values are always fresh by the next tick. See PLAY-04 / PLAY-16.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [position]);

    const deferAutoScroll = useCallback(() => {
        autoScrollPausedUntilRef.current = Date.now() + AUTO_SCROLL_RESUME_DELAY_MS;
    }, []);

    const togglePlayPause = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await storeTogglePlayPause();
    };

    const skipForward = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newPosition = Math.min(position + 15000, duration);
        await seek(newPosition);
    };

    const skipBackward = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newPosition = Math.max(position - 15000, 0);
        await seek(newPosition);
    };

    const handleSlidingComplete = async (value: number) => {
        await seek(value);
    };

    const toggleSpeed = async () => {
        const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
        const currentIdx = rates.indexOf(playbackRate);
        const newRate = rates[(currentIdx + 1) % rates.length];

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await setStoreRate(newRate);
        setPlaybackRate(newRate);

        // Persist speed change
        if (session && bookId) {
            try {
                await upsertUserProgress({
                    userId: session.user.id,
                    bookId: bookId,
                    lastContentId: itemId,
                    contentType: 'verse',
                    lastPositionSeconds: Math.max(0, Math.floor(position / 1000)),
                    playbackSpeed: newRate
                });
            } catch (e) {
                logger.error('Failed to save playback speed', { error: e });
            }
        }
    };

    const handleBookmark = async () => {
        if (!session) return;
        try {
            const { bookmarked } = await toggleBookmark(session.user.id, itemId, 'verse');
            setIsBookmarked(bookmarked);
        } catch (error) {
            logger.error('Bookmark toggle failed', { error });
        }
    };

    const handleShare = async () => {
        try {
            const verseTitle = content?.title || formatRef(bookId, content?.chapter_no, content?.verse_no);
            const bookTitle = meta.title || 'Mangalam';

            // Platform-specific download link embedded in the message.
            // iOS: App Store link  |  Android: Play Store link
            const downloadUrl = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

            const message =
                `🌟 Wisdom from ${bookTitle}:\n\n` +
                `"${verseTitle}"\n\n` +
                `Listen to the full story and commentary on the Mangalam app. 🙏\n\n` +
                `📱 Download free: ${downloadUrl}`;

            // On iOS, passing `url` (the App Store link) causes the share sheet
            // to render a rich App Store preview card instead of the generic
            // plain-text document icon. On Android, `url` is not used here
            // because the download link is already in the message text.
            const shareContent: { message: string; url?: string; title?: string } = {
                message,
                title: `${bookTitle} Wisdom`,
            };
            if (Platform.OS === 'ios') {
                shareContent.url = APP_STORE_URL;
            }

            await Share.share(shareContent);

            // Log activity
            if (session) {
                await logActivity(session.user.id, itemId, 'verse', 'share');
            }
        } catch (error) {
            logger.error('Share action failed', { error });
        }
    };

    const navigateToVerse = async (targetVerseId: string, forceAutoPlay?: boolean) => {
        if (!targetVerseId || !bookId) {
            logger.warn('Playback navigation missing book context', { targetVerseId, bookId });
            return;
        }

        const wasPlaying = forceAutoPlay ?? isPlaying;
        void syncRemoteProgress('track_change', { force: true });
        setHasLoggedListen(false); // Reset listen tracking for the new verse

        // Use the ROOT navigation ref, not the screen-scoped `navigation.replace`.
        // This is what the mini-player's next/prev already use, and it is safe
        // whether the player is focused, sitting behind the mini-player, on another
        // tab, or dismissed — so `onFinish` can advance to the next verse/episode
        // for continuous listening (PLAY-14) without the stale-`replace` stack
        // collapse that PLAY-01 fixed. When Play is the current route this just
        // updates its params and the loader re-runs; otherwise Play is brought
        // forward / pushed onto the tabs.
        if (navigationRef.isReady()) {
            navigationRef.navigate('Play', {
                itemId: targetVerseId,
                bookId,
                autoPlay: wasPlaying,
            });
        }
    };

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Content-language toggle. Language and voice (gender) are separate: switching
    // language keeps the chosen voice, and the loader (keyed on voicePreference)
    // reloads this verse's text + narration in the new language.
    const contentLang: 'english' | 'hindi' = voicePreference.startsWith('hindi') ? 'hindi' : 'english';
    const switchLanguage = (next: 'english' | 'hindi') => {
        if (next === contentLang) return;
        const gender = voicePreference.endsWith('female') ? 'female' : 'male';
        setVoicePreference(`${next}-${gender}` as typeof voicePreference);
    };

    const animatedPlayPauseStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: interpolate(playPauseAnim.value, [0, 1], [1, 0.9]) },
                { rotate: `${interpolate(playPauseAnim.value, [0, 1], [0, 180])}deg` }
            ],
            opacity: withTiming(1, { duration: 100 })
        };
    });

    const animatedFocusHeaderStyle = useAnimatedStyle(() => {
        return {
            // Keep header visible, but slightly transparent for focus
            opacity: interpolate(focusModeAnim.value, [0, 1], [1, 0.95]),
            transform: [{ translateY: 0 }]
        };
    });

    const animatedFocusTopStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(focusModeAnim.value, [0, 1], [1, 0]),
            height: interpolate(focusModeAnim.value, [0, 1], [320, 0]),
            marginBottom: interpolate(focusModeAnim.value, [0, 1], [spacing.m, 0]),
            overflow: 'hidden'
        };
    });

    if (invalidPlaybackContext) {
        logger.warn('PlayScreen missing playback context', { params });
        return (
            <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: spacing.m, paddingHorizontal: spacing.m }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                        <Ionicons name="chevron-down" size={26} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <View style={[styles.center, { flex: 1, paddingHorizontal: spacing.xl }]}>
                    <Ionicons name="cloud-offline-outline" size={40} color={colors.textTertiary} />
                    <AppText variant="body" style={[styles.trackSubtitle, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.m }]}>
                        We couldn&rsquo;t open this verse.
                    </AppText>
                </View>
            </ScreenContainer>
        );
    }

    if (playbackError) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { paddingTop: spacing.m, paddingHorizontal: spacing.m }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                        <Ionicons name="chevron-down" size={26} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <LoadError message={playbackError} onRetry={loadContentAndCheckUsage} />
            </ScreenContainer>
        );
    }

    if (loading) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.skeletonBody}>
                    <Skeleton width={160} height={160} borderRadius={borderRadius.xl} style={{ marginBottom: spacing.l }} />
                    <Skeleton width="55%" height={22} borderRadius={borderRadius.s} style={{ marginBottom: spacing.s }} />
                    <Skeleton width="35%" height={16} borderRadius={borderRadius.s} style={{ marginBottom: spacing.xxl }} />
                    {(['90%', '80%', '85%', '70%', '82%'] as const).map((w, i) => (
                        <Skeleton key={i} width={w} height={16} borderRadius={borderRadius.s} style={{ marginBottom: spacing.m }} />
                    ))}
                </View>
            </ScreenContainer>
        );
    }

    const playerBarBg = colors.background + 'E8';

    // Header context: which book and where in it. Prefer the verse's own book
    // title, fall back to the classification metadata (skip its "Unknown" default).
    const headerBookName = content?.book_title || (meta.title !== 'Unknown' ? meta.title : null);
    const headerRef = formatRef(bookId, content?.chapter_no, content?.verse_no, '  ·  ') || null;

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            {/* ── Fixed Top Header ── */}
            <Animated.View style={[styles.header, { paddingTop: spacing.m, paddingHorizontal: spacing.m }, animatedFocusHeaderStyle]}>
                {!isFocusMode ? (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                        <Ionicons name="chevron-down" size={26} color={colors.text} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.headerSideSpacer} />
                )}

                <View style={styles.headerCenter}>
                    <AppText variant="bodySmall" style={[styles.headerTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {headerBookName || 'Now Playing'}
                    </AppText>
                    {headerRef ? (
                        <AppText variant="caption" style={[styles.headerRef, { color: colors.textTertiary }]} numberOfLines={1}>
                            {headerRef}
                        </AppText>
                    ) : null}
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={handleShare} style={[styles.iconButton, { marginRight: spacing.s }]}>
                        <Ionicons name="share-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsFocusMode(!isFocusMode)} style={[styles.iconButton, { marginRight: spacing.s }]}>
                        <Ionicons name={isFocusMode ? "contract-outline" : "expand-outline"} size={22} color={isFocusMode ? colors.primary : colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleBookmark} style={styles.iconButton}>
                        <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color={isBookmarked ? colors.primary : colors.text} />
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {/* ── Cover Art + Titles (fixed, not scrollable) ── */}
            <Animated.View style={[styles.topSection, { paddingHorizontal: spacing.xl }, animatedFocusTopStyle]}>
                <View style={styles.coverWrapper}>
                    {isGita ? (
                        <Image source={GITA_COVER} style={[styles.coverImage, { borderRadius: borderRadius.xl }]} resizeMode="cover" />
                    ) : isRamayan ? (
                        <Image source={RAMAYAN_COVER} style={[styles.coverImage, { borderRadius: borderRadius.xl }]} resizeMode="cover" />
                    ) : isMahabharat ? (
                        <Image source={MAHABHARAT_COVER} style={[styles.coverImage, { borderRadius: borderRadius.xl }]} resizeMode="cover" />
                    ) : (
                        <View style={[styles.coverArt, { backgroundColor: meta.color + '20', borderRadius: borderRadius.xl }]}>
                            {getScriptureIcon(currentBookSlug || 'book', 64, meta.color)}
                        </View>
                    )}
                </View>
                <AppText variant="subheading" style={[styles.trackTitle, { color: colors.text, marginTop: spacing.xs }]}>
                    {content?.title || formatRef(bookId, content?.chapter_no, content?.verse_no)}
                </AppText>
                <AppText variant="body" style={[styles.trackSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>{meta.title}</AppText>

                <View style={[styles.langToggle, { borderColor: colors.border }]}>
                    {(['english', 'hindi'] as const).map((l) => {
                        const active = contentLang === l;
                        return (
                            <TouchableOpacity
                                key={l}
                                onPress={() => switchLanguage(l)}
                                style={[styles.langOption, active && { backgroundColor: colors.primary }]}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                            >
                                <AppText variant="label" style={[styles.langOptionText, { color: active ? colors.textInverse : colors.textSecondary }]}>
                                    {l === 'english' ? 'English' : 'हिन्दी'}
                                </AppText>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Animated.View>

            {/* ── Auto-scrolling Transcript ── */}
            <ScrollView
                ref={scrollRef}
                style={styles.transcriptScroll}
                contentContainerStyle={[styles.transcriptContent, { paddingHorizontal: spacing.xl, paddingTop: isFocusMode ? spacing.xxxl : spacing.m, paddingBottom: playerBarHeight + spacing.l }]}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={(_, h) => setScrollContentHeight(h)}
                onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
                scrollEventThrottle={200}
                onScrollBeginDrag={deferAutoScroll}
                onScrollEndDrag={deferAutoScroll}
            >
                {(() => {
                    const voicePref = voicePreference || 'english-male';
                    const isHindi = voicePref.startsWith('hindi');
                    const chapterNo = content?.chapter_no;
                    const verseNo = content?.verse_no;

                    // ==========================================
                    // EXACT AUDIO NARRATIVE REPLICATION
                    // Mirrors the exact text sent to Google TTS in generate-tts/index.ts
                    // ==========================================
                    const pe: string[] = content?.practicalExamples || content?.practical_examples || [];
                    // For Mahabharat/Ramayan, practical_examples is just ["Jai Shri Krishna"] sign-off
                    // shown centered at bottom — keep as-is (no doubling)
                    const greeting = pe.length > 0 ? pe.join(' ') : '';

                    const intro = isHindi
                        ? `\u0906\u091c \u0915\u0947 \u092a\u093e\u0920 \u092e\u0947\u0902 \u0906\u092a\u0915\u093e \u0938\u094d\u0935\u093e\u0917\u0924 \u0939\u0948\u0964 \u0939\u092e \u0905\u0927\u094d\u092f\u093e\u092f ${chapterNo} \u0936\u094d\u0932\u094b\u0915 ${verseNo} \u092e\u0947\u0902 \u0939\u0948\u0902\u0964`
                        : `Welcome to today's lesson. We are in Chapter ${chapterNo} Verse ${verseNo}`;

                    const rawSanskrit = content?.sanskrit || content?.sanskrit_text || '';
                    // Body text is LLM-generated — clean generation artifacts once,
                    // here, so display and audio-sync both use the same string
                    // (tracker CONTENT-03 / PLAY-07). Stored content is untouched.
                    const translationText = cleanContentText(content?.translation || '');
                    const commentaryText = cleanContentText(content?.commentary || '');
                    const dailyLifeText = cleanContentText(content?.dailyLifeApplication || content?.daily_life_application || '');

                    // Always show the sanskrit/opening text (including "Jai Shri Krishna" sign-off shown in orange)
                    const sanskritText = stripMarkup(rawSanskrit);

                    // Build the narrative exactly matching what's displayed on screen
                    let narrativeSections: string[];
                    if (isRamayan || isMahabharat) {
                        narrativeSections = [sanskritText, translationText, commentaryText, dailyLifeText, greeting];
                    } else {
                        narrativeSections = [intro, sanskritText, translationText, commentaryText, dailyLifeText, greeting];
                    }

                    const exactAudioNarrative = narrativeSections
                        .filter(t => t && t.trim().length > 0)
                        .map(t => stripMarkup(t))
                        .join('\n\n');

                    // Split dailyLifeText for UI display only
                    const splitApplication = (text: string): string[] => {
                        if (!text) return [];
                        const numberedParts = text.split(/\d+\.\s+/).map(p => p.trim()).filter(Boolean);
                        if (numberedParts.length > 1) return numberedParts;
                        const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean);
                        if (paragraphs.length > 1) return paragraphs;
                        return [text.trim()].filter(Boolean);
                    };
                    const appBullets = splitApplication(dailyLifeText);
                    const isNumberedList = Boolean(dailyLifeText.match(/^\d+\.\s+/m));

                    // --- Weighted Sync Logic ---
                    const getVirtualLength = (text: string): number => {
                        let length = 0;
                        for (let i = 0; i < text.length; i++) {
                            const char = text[i];
                            const code = char.charCodeAt(0);
                            if (code >= 0x0900 && code <= 0x097F) {
                                length += 2.0;
                            } else if (char === '\n') {
                                length += 15.0;
                            } else if (/[.,!?;।॥]/.test(char)) {
                                length += 25.0;
                            } else {
                                length += 1.0;
                            }
                        }
                        return length;
                    };

                    const totalVirtualLength = getVirtualLength(exactAudioNarrative) || 1;
                    const globalProgress = duration > 0 ? position / duration : 0;

                    const getLocalProgress = (snippet: string): number => {
                        if (!snippet) return 0;
                        let startIndex = exactAudioNarrative.indexOf(snippet);
                        // Fallback: match on first 30 chars (handles stripped bullets)
                        if (startIndex === -1 && snippet.length > 30) {
                            startIndex = exactAudioNarrative.indexOf(snippet.substring(0, 30));
                        }
                        if (startIndex === -1) return 0;
                        const blockStart = getVirtualLength(exactAudioNarrative.substring(0, startIndex));
                        const blockLen = getVirtualLength(snippet);
                        const startRatio = blockStart / totalVirtualLength;
                        const endRatio = (blockStart + blockLen) / totalVirtualLength;
                        return Math.max(0, Math.min(1, (globalProgress - startRatio) / (endRatio - startRatio)));
                    };

                    // For Gita the opening field is the verse in Sanskrit; for the
                    // epics it holds only the devotional sign-off (see PLAY-06),
                    // which also appears — now labelled — at the very end, so it is
                    // not shown here.
                    const isEpic = isRamayan || isMahabharat;
                    const showSanskrit = sanskritText && !isEpic;

                    return (
                        <>
                            {showSanskrit ? (
                                <AppText variant="body" style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>
                                    Sanskrit verse
                                </AppText>
                            ) : null}
                            {showSanskrit ? (
                                <HighlightedText
                                    text={sanskritText}
                                    progress={getLocalProgress(sanskritText)}
                                    style={[styles.contentSanskrit, { color: colors.primary, marginBottom: spacing.xl, fontSize: isFocusMode ? 28 : 22 }]}
                                    activeColor={colors.text}
                                    inactiveColor={colors.primary}
                                />
                            ) : null}

                            <AppText variant="body" style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>
                                {(isRamayan || isMahabharat) ? 'Story' : 'Translation'}
                            </AppText>
                            <HighlightedText
                                text={translationText}
                                progress={getLocalProgress(translationText)}
                                style={[styles.contentText, { color: colors.textSecondary, marginBottom: spacing.xl, fontSize: isFocusMode ? 20 : 17 }]}
                                activeColor={colors.text}
                                inactiveColor={colors.textSecondary}
                            />

                            <AppText variant="body" style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>Commentary</AppText>
                            <HighlightedText
                                text={commentaryText}
                                progress={getLocalProgress(commentaryText)}
                                style={[styles.contentText, { color: colors.textSecondary, marginBottom: spacing.xl, fontSize: isFocusMode ? 20 : 17 }]}
                                activeColor={colors.text}
                                inactiveColor={colors.textSecondary}
                            />

                            {appBullets.length > 0 && (
                                <>
                                    <AppText variant="body" style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>Daily Life Application</AppText>
                                    {appBullets.map((bullet: string, idx: number) => (
                                        <View key={`app-${idx}`} style={{ flexDirection: 'row', marginBottom: isNumberedList ? spacing.m : spacing.l }}>
                                            {isNumberedList && <Text style={{ color: colors.text, marginRight: spacing.s, marginTop: spacing.xs }}>•</Text>}
                                            <HighlightedText
                                                text={bullet}
                                                progress={getLocalProgress(bullet)}
                                                style={[styles.contentText, { color: colors.textSecondary, flex: 1, fontSize: isFocusMode ? 20 : 17 }]}
                                                activeColor={colors.text}
                                                inactiveColor={colors.textSecondary}
                                            />
                                        </View>
                                    ))}
                                </>
                            )}

                            {pe.length > 0 && (
                                <>
                                    <AppText variant="body" style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>
                                        {isEpic ? 'A traditional closing blessing' : 'Practical Examples'}
                                    </AppText>
                                    {pe.map((ex: string, idx: number) => (
                                        <View key={idx} style={{ flexDirection: 'row', marginBottom: spacing.m }}>
                                            {!isEpic && <Text style={{ color: colors.text, marginRight: spacing.s }}>•</Text>}
                                            <HighlightedText
                                                text={ex}
                                                progress={getLocalProgress(ex)}
                                                style={[styles.contentText, { color: colors.textSecondary, flex: 1, fontSize: isFocusMode ? 20 : 17, textAlign: isEpic ? 'center' : 'left' }]}
                                                activeColor={colors.text}
                                                inactiveColor={colors.textSecondary}
                                            />
                                        </View>
                                    ))}
                                </>
                            )}
                        </>
                    );
                })()}
            </ScrollView>

            {/* ── Floating Player Bar ── */}
            <BottomSafeAreaContainer
                style={[styles.playerBar, { backgroundColor: playerBarBg, borderTopColor: colors.border, paddingHorizontal: spacing.m, paddingTop: spacing.xs }]}
                onLayout={(e) => setPlayerBarHeight(e.nativeEvent.layout.height)}
            >
                <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={duration}
                    value={position}
                    onSlidingComplete={handleSlidingComplete}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.secondary}
                />
                <View style={styles.timeAndSpeedRow}>
                    <AppText variant="label" style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(position)}</AppText>
                    <TouchableOpacity onPress={toggleSpeed} style={[styles.speedPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: spacing.s, paddingHorizontal: spacing.m }]}>
                        <AppText variant="bodySmall" style={[styles.speedPillText, { color: colors.primary }]}>{playbackRate}x</AppText>
                    </TouchableOpacity>
                    <AppText variant="label" style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(duration)}</AppText>
                </View>

                <View style={[styles.controlsRow, { marginTop: spacing.m, marginBottom: spacing.s }]}>
                    <TouchableOpacity
                        onPress={() => prevVerseId && navigateToVerse(prevVerseId)}
                        style={[styles.edgeBtn, !prevVerseId && styles.btnDisabled]}
                        disabled={!prevVerseId}
                    >
                        <Ionicons name="play-skip-back" size={22} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={skipBackward} style={styles.skipBtn}>
                        <Ionicons name="play-back" size={24} color={colors.text} />
                        <AppText variant="label" maxFontSizeMultiplier={1.1} style={[styles.skipLabel, { color: colors.textSecondary }]}>15</AppText>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={togglePlayPause}>
                        <Animated.View style={[
                            styles.playBtnLarge,
                            {
                                backgroundColor: colors.primary,
                                shadowColor: colors.primary,
                            },
                            animatedPlayPauseStyle
                        ]}>
                            <Ionicons
                                name={isPlaying ? 'pause' : 'play'}
                                size={34}
                                color={colors.textInverse}
                                style={{ marginLeft: isPlaying ? 0 : 4 }}
                            />
                        </Animated.View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={skipForward} style={styles.skipBtn}>
                        <Ionicons name="play-forward" size={24} color={colors.text} />
                        <AppText variant="label" maxFontSizeMultiplier={1.1} style={[styles.skipLabel, { color: colors.textSecondary }]}>15</AppText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => nextVerseId && navigateToVerse(nextVerseId)}
                        style={[styles.edgeBtn, !nextVerseId && styles.btnDisabled]}
                        disabled={!nextVerseId}
                    >
                        <Ionicons name="play-skip-forward" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </BottomSafeAreaContainer>
        </ScreenContainer>
    );
};

const createStyles = (
    colors: ReturnType<typeof useTheme>['colors'],
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography'],
    borderRadius: ReturnType<typeof useTheme>['borderRadius']
) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    skeletonBody: {
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xxl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.m,
        paddingTop: spacing.m,
    },
    iconButton: {
        padding: spacing.xs,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: spacing.s,
    },
    headerTitle: {
        fontFamily: typography.fontFamilies.medium,
        fontSize: typography.sizes.s,
        color: colors.textSecondary,
    },
    headerRef: {
        fontFamily: typography.fontFamilies.regular,
        fontSize: typography.sizes.xs,
        marginTop: 1,
    },
    headerSideSpacer: {
        width: 34,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topSection: {
        alignItems: 'center',
        paddingTop: spacing.s,
        paddingBottom: spacing.s,
        paddingHorizontal: spacing.xl,
    },
    coverWrapper: {
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.xl,
    },
    coverArt: {
        width: 160,
        height: 160,
        borderRadius: borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.cardShadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 6,
        marginBottom: spacing.s,
    },
    coverImage: {
        width: 160,
        height: 160,
        borderRadius: borderRadius.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
        marginBottom: spacing.s,
    },
    trackTitle: {
        fontFamily: typography.fontFamilies.semiBold,
        fontSize: typography.sizes.l,
        color: colors.text,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.micro,
    },
    trackSubtitle: {
        fontFamily: typography.fontFamilies.medium,
        fontSize: typography.sizes.m,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.s,
    },
    langToggle: {
        flexDirection: 'row',
        alignSelf: 'center',
        borderWidth: 1,
        borderRadius: 999,
        overflow: 'hidden',
    },
    langOption: {
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.xs,
    },
    langOptionText: {
        fontFamily: typography.fontFamilies.medium,
        fontSize: typography.sizes.xs,
    },
    // ── Transcript area ──
    transcriptScroll: {
        flex: 1,
    },
    transcriptContent: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.m,
    },
    // ── Player bar (in normal flex flow, not floating) ──
    playerBar: {
        paddingHorizontal: spacing.m,
        paddingTop: spacing.xs,
        paddingBottom: spacing.l,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    slider: {
        width: '100%',
        height: 32,
        marginHorizontal: -spacing.xs,
    },
    timeAndSpeedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.s,
        marginTop: -spacing.s,
        marginBottom: spacing.xs,
    },
    timeText: {
        fontFamily: typography.fontFamilies.medium,
        fontSize: typography.sizes.xs,
        color: colors.textSecondary,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.m,
        marginBottom: spacing.s,
    },
    edgeBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnDisabled: {
        opacity: 0.3,
    },
    playBtnLarge: {
        width: 68,
        height: 68,
        borderRadius: borderRadius.round,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 4,
    },
    skipBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    skipLabel: {
        position: 'absolute',
        bottom: -2,
        right: -spacing.micro,
        fontSize: 9,
        fontFamily: typography.fontFamilies.semiBold,
        color: colors.textSecondary,
    },
    speedPill: {
        alignSelf: 'center',
        marginTop: spacing.s,
        backgroundColor: colors.surfaceSecondary,
        borderRadius: borderRadius.round,
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
    },
    speedPillText: {
        fontFamily: typography.fontFamilies.semiBold,
        fontSize: typography.sizes.s,
        color: colors.primary,
        letterSpacing: 0.5,
    },
    contentSanskrit: {
        fontFamily: typography.fontFamilies.medium,
        fontSize: typography.sizes.xl,
        color: colors.text,
        textAlign: 'center',
        lineHeight: typography.lineHeights.xl,
        marginBottom: spacing.xl,
    },
    contentSubtitle: {
        fontFamily: typography.fontFamilies.semiBold,
        fontSize: typography.sizes.m,
        color: colors.textSecondary,
        marginBottom: spacing.s,
    },
    contentText: {
        fontFamily: typography.fontFamilies.regular,
        fontSize: typography.sizes.l,
        color: colors.text,
        lineHeight: typography.lineHeights.l,
        marginBottom: spacing.xl,
    }
});
