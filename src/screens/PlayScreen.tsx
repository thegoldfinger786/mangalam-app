import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
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
import { Button } from '../components/Button';
import { HighlightedText } from '../components/HighlightedText';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { COLLECTION_METADATA } from '../data/mockGita';
import { checkAudioCache, fetchAdjacentVerse, fetchIsBookmarked, fetchUserProgress, fetchVerseAudio, incrementDailyUsage, logActivity, toggleBookmark, upsertUserProgress } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import { BottomSafeAreaContainer } from '../components/layout/BottomSafeAreaContainer';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { useAppStore } from '../store/useAppStore';
import { useAudioStore } from '../store/useAudioStore';
import { useTheme } from '../theme';

const { width } = Dimensions.get('window');
const GITA_COVER = require('../../assets/images/gita-cover.jpg');
const RAMAYAN_COVER = require('../../assets/images/ramayan-cover.jpg');
const MAHABHARAT_COVER = require('../../assets/images/mahabharat-cover.jpg');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const PlayScreen = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const styles = useMemo(
        () => createStyles(colors, spacing, typography, borderRadius),
        [colors, spacing, typography, borderRadius]
    );
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<any>();
    const params = route.params ?? {};
    const itemId = params.itemId ?? params.verseId;
    const type = params.type ?? useAppStore.getState().activePath;
    const autoPlay = params.autoPlay ?? false;
    const resumePosition = params.position ?? 0;

    const { voicePreference, session, playbackRate, setPlaybackRate } = useAppStore();
    const {
        loadAudio,
        togglePlayPause: storeTogglePlayPause,
        isPlaying,
        position,
        duration,
        seek,
        setPlaybackRate: setStoreRate
    } = useAudioStore();

    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<any>(null);
    const [isAllowed, setIsAllowed] = useState(true);
    const [bookId, setBookId] = useState<string | null>(null);
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
    }, [isPlaying]);

    useEffect(() => {
        focusModeAnim.value = withTiming(isFocusMode ? 1 : 0, { duration: 400 });
    }, [isFocusMode]);

    const scrollRef = useRef<ScrollView>(null);
    const isNavigatingToVerse = useRef(false);
    const isMountedRef = useRef(true);
    const hasRestoredRoutePositionRef = useRef(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            // Do not stop audio on screen unmount
        };
    }, []);
    const [scrollContentHeight, setScrollContentHeight] = useState(0);
    const [scrollViewHeight, setScrollViewHeight] = useState(0);
    const [playerBarHeight, setPlayerBarHeight] = useState(220);

    if (!itemId || !type) {
        return null;
    }

    const meta = COLLECTION_METADATA[type as string] || { title: 'Unknown', icon: 'book', color: colors.primary };
    const isVerse = true; // Hardcoded to true as all content utilizes the unified Verses DB structure now

    // Robust checks for scripture types
    const isRamayan = type?.toLowerCase().includes('ramayan');
    const isMahabharat = type?.toLowerCase().includes('mahabharat');
    const isGita = type?.toLowerCase().includes('gita');

    const loadContentAndCheckUsage = useCallback(async () => {
        if (!session) return;

        try {
            if (!isMountedRef.current) return;
            setLoading(true);

            // 1. Content Fetching
            const lang = voicePreference.startsWith('hindi') ? 'hi' : 'en';

            let data: any = {};

            const { data: verse, error: verseErr } = await supabase.from('verses').select('*').eq('verse_id', itemId).single();
            if (verseErr) throw verseErr;

            const { data: verseContent } = await supabase
                .from('verse_content')
                .select('*')
                .eq('verse_id', itemId)
                .eq('language', lang)
                .single();

            data = { ...verse, ...verseContent };

            // Track progress
            useAppStore.getState().addCompletedVerse(itemId);

            if (!isMountedRef.current) return;
            setContent(data);
            setIsAllowed(true);

            let nextId: string | null = null;
            if (data?.book_id) {
                if (!isMountedRef.current) return;
                setBookId(data.book_id);
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
                const bookmarked = await fetchIsBookmarked(session.user.id, itemId);
                if (!isMountedRef.current) return;
                setIsBookmarked(bookmarked);
            }

            // 2. Increment Usage (Non-blocking)
            try {
                await incrementDailyUsage(session.user.id);
            } catch (usageError: any) {
                console.warn('Usage tracking issue:', usageError.message);
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
                        loadAudio(freshUrl, { ...data, type, artworkUrl: resolvedArtworkUrl }, autoPlay, onFinish);
                    }
                } else {
                    console.log(`[PlayScreen] No audio found for ${itemId} in ${lang}-${gender}`);
                    // Ensure state is updated so user can still see text and manually navigate
                    loadAudio('', { ...data, type, artworkUrl: resolvedArtworkUrl }, false, () => {
                        if (nextId) navigateToVerse(nextId, true);
                    });
                }
            } catch (cacheError) {
                console.error('Audio cache error:', cacheError);
            }
            // 4. Progress Persistence (Sync current verse and restore speed)
            if (data?.book_id) {
                try {
                    const progress = await fetchUserProgress(session.user.id, data.book_id);

                    // If we have saved progress, and this is the first load of the session (optional check)
                    // or just generally restore the speed if available.
                    if (progress?.playback_speed) {
                        setPlaybackRate(progress.playback_speed);
                    }

                    // Save current position
                    await upsertUserProgress({
                        userId: session.user.id,
                        bookId: data.book_id,
                        lastContentId: itemId,
                        contentType: 'verse',
                        playbackSpeed: progress?.playback_speed || playbackRate
                    });
                } catch (progError) {
                    console.error('Progress sync error:', progError);
                }
            }

        } catch (error: any) {
            console.error('PlayScreen init error:', error);
            console.log('Alert triggered');
            Alert.alert('Error', 'Failed to load content. Please check your connection.');
        } finally {
            if (isMountedRef.current) setLoading(false);
        }
    }, [session, itemId, type, voicePreference]);

    useEffect(() => {
        loadContentAndCheckUsage();
    }, [loadContentAndCheckUsage]);

    useEffect(() => {
        if (isPlaying && !hasLoggedListen && session) {
            setHasLoggedListen(true);
            logActivity(session.user.id, itemId, 'verse', 'listen');
        }
    }, [isPlaying]);

    useEffect(() => {
        if (
            resumePosition >= 0 &&
            duration > 1 &&
            !hasRestoredRoutePositionRef.current
        ) {
            hasRestoredRoutePositionRef.current = true;
            seek(resumePosition * 1000);
        }
    }, [duration, resumePosition, seek]);

    // Auto-scroll transcript proportionally to audio position
    useEffect(() => {
        if (!isPlaying || duration <= 1 || scrollContentHeight <= scrollViewHeight) return;
        const progress = position / duration;
        const maxScroll = scrollContentHeight - scrollViewHeight;
        const targetY = progress * maxScroll;
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
    }, [position]);

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
                    playbackSpeed: newRate
                });
            } catch (e) {
                console.error('Failed to save speed:', e);
            }
        }
    };

    const handleBookmark = async () => {
        if (!session) return;
        try {
            const { bookmarked } = await toggleBookmark(session.user.id, itemId, 'verse');
            setIsBookmarked(bookmarked);
        } catch (error) {
            console.error('Bookmark error:', error);
        }
    };

    const handleShare = async () => {
        try {
            const verseTitle = content?.title || `Chapter ${content?.chapter_no}  ·  Verse ${content?.verse_no}`;
            const bookTitle = meta.title || 'Daily Shlokya';

            // Build a more attractive share message
            const message = `🌟 Wisdom from ${bookTitle}:\n\n"${verseTitle}"\n\nListen to the full story and commentary on the Mangalam app. 🙏`;

            await Share.share({
                message,
                title: `Share ${bookTitle} Wisdom`,
            });

            // Log activity
            if (session) {
                await logActivity(session.user.id, itemId, 'verse', 'share');
            }
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const navigateToVerse = async (targetVerseId: string, forceAutoPlay?: boolean) => {
        const wasPlaying = forceAutoPlay ?? isPlaying;
        isNavigatingToVerse.current = true;
        navigation.replace('Play', { itemId: targetVerseId, type, autoPlay: wasPlaying });
        setHasLoggedListen(false); // Reset tracking for new verse
    };

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
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

    if (loading) {
        return (
            <View style={[styles.center, { flex: 1, backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (isAllowed === false) {
        return (
            <View style={[styles.center, { flex: 1, padding: spacing.xl, backgroundColor: colors.background }]}>
                <Ionicons name="lock-closed" size={64} color={colors.primary} style={{ marginBottom: spacing.l }} />
                <Text style={[styles.trackTitle, { marginBottom: spacing.m, color: colors.text }]}>Daily Limit Reached</Text>
                <Text style={[styles.trackSubtitle, { marginBottom: spacing.xl, textAlign: 'center', color: colors.textSecondary }]}>
                    You have reached your free limit of 3 sessions today. Support us to unlock unlimited wisdom.
                </Text>
                <Button
                    title="Become a Supporter"
                    onPress={() => navigation.navigate('SupportMangalam')}
                />
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.xl }}>
                    <Text style={{ color: colors.textSecondary }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const playerBarBg = colors.background + 'E8';

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            {/* ── Fixed Top Header ── */}
            <Animated.View style={[styles.header, { paddingTop: spacing.m, paddingHorizontal: spacing.m }, animatedFocusHeaderStyle]}>
                {!isFocusMode ? (
                    <>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                            <Ionicons name="chevron-down" size={26} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>Now Playing</Text>
                    </>
                ) : (
                    <View style={{ flex: 1 }} /> // Spacer to keep icons on the right
                )}
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
                            {getScriptureIcon(type as string, 64, meta.color)}
                        </View>
                    )}
                </View>
                <Text style={[styles.trackTitle, { color: colors.text, marginTop: spacing.xs }]}>
                    {content?.title || `Chapter ${content?.chapter_no}  ·  Verse ${content?.verse_no}`}
                </Text>
                <Text style={[styles.trackSubtitle, { color: colors.textSecondary, marginBottom: spacing.xs }]}>{meta.title}</Text>
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
                    const translationText = content?.translation || '';
                    const commentaryText = content?.commentary || '';
                    const dailyLifeText = content?.dailyLifeApplication || content?.daily_life_application || '';

                    // Strip SSML tags from displayed text (same as HighlightedText does)
                    const stripDisplay = (t: string) => t
                        .replace(/<break\s+time="[^"]*"\s*\/>/gi, '')
                        .replace(/<break\s*\/>/gi, '')
                        .replace(/\*\*/g, '')
                        .replace(/\s{2,}/g, ' ')
                        .trim();

                    // Always show the sanskrit/opening text (including "Jai Shri Krishna" sign-off shown in orange)
                    const sanskritText = stripDisplay(rawSanskrit);

                    // Build the narrative exactly matching what's displayed on screen
                    let narrativeSections: string[];
                    if (isRamayan || isMahabharat) {
                        narrativeSections = [sanskritText, translationText, commentaryText, dailyLifeText, greeting];
                    } else {
                        narrativeSections = [intro, sanskritText, translationText, commentaryText, dailyLifeText, greeting];
                    }

                    const exactAudioNarrative = narrativeSections
                        .filter(t => t && t.trim().length > 0)
                        .map(t => stripDisplay(t))
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

                    return (
                        <>
                            {sanskritText ? (
                                <HighlightedText
                                    text={sanskritText}
                                    progress={getLocalProgress(sanskritText)}
                                    style={[styles.contentSanskrit, { color: colors.primary, marginBottom: spacing.xl, fontSize: isFocusMode ? 28 : 22 }]}
                                    activeColor={colors.primary}
                                    inactiveColor={colors.primary}
                                />
                            ) : null}

                            <Text style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>
                                {(isRamayan || isMahabharat) ? 'Story' : 'Translation'}
                            </Text>
                            <HighlightedText
                                text={translationText}
                                progress={getLocalProgress(translationText)}
                                style={[styles.contentText, { color: colors.textSecondary, marginBottom: spacing.xl, fontSize: isFocusMode ? 20 : 17 }]}
                                activeColor={colors.text}
                                inactiveColor={colors.textSecondary}
                            />

                            <Text style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>Commentary</Text>
                            <HighlightedText
                                text={commentaryText}
                                progress={getLocalProgress(commentaryText)}
                                style={[styles.contentText, { color: colors.textSecondary, marginBottom: spacing.xl, fontSize: isFocusMode ? 20 : 17 }]}
                                activeColor={colors.text}
                                inactiveColor={colors.textSecondary}
                            />

                            {appBullets.length > 0 && (
                                <>
                                    <Text style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>Daily Life Application</Text>
                                    {appBullets.map((bullet: string, idx: number) => (
                                        <View key={`app-${idx}`} style={{ flexDirection: 'row', marginBottom: isNumberedList ? spacing.m : spacing.l }}>
                                            {isNumberedList && <Text style={{ color: colors.text, marginRight: spacing.s, marginTop: spacing.xs }}>•</Text>}
                                            <HighlightedText
                                                text={bullet}
                                                progress={getLocalProgress(bullet)}
                                                style={[styles.contentText, { color: colors.textSecondary, marginBottom: 0, flex: 1, fontSize: isFocusMode ? 20 : 17 }]}
                                                activeColor={colors.text}
                                                inactiveColor={colors.textSecondary}
                                            />
                                        </View>
                                    ))}
                                </>
                            )}

                            {pe.length > 0 && (
                                <>
                                    {(!isRamayan && !isMahabharat) && (
                                        <Text style={[styles.contentSubtitle, { color: colors.textSecondary, marginBottom: spacing.s }]}>Practical Examples</Text>
                                    )}
                                    {pe.map((ex: string, idx: number) => (
                                        <View key={idx} style={{ flexDirection: 'row', marginBottom: spacing.m }}>
                                            {(!isRamayan && !isMahabharat) && <Text style={{ color: colors.text, marginRight: spacing.s }}>•</Text>}
                                            <HighlightedText
                                                text={ex}
                                                progress={getLocalProgress(ex)}
                                                style={[styles.contentText, { color: colors.textSecondary, marginBottom: 0, flex: 1, fontSize: isFocusMode ? 20 : 17, textAlign: (isRamayan || isMahabharat) ? 'center' : 'left' }]}
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
                    <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(position)}</Text>
                    <TouchableOpacity onPress={toggleSpeed} style={[styles.speedPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginTop: spacing.s, paddingHorizontal: spacing.m }]}>
                        <Text style={[styles.speedPillText, { color: colors.primary }]}>{playbackRate}x</Text>
                    </TouchableOpacity>
                    <Text style={[styles.timeText, { color: colors.textSecondary }]}>{formatTime(duration)}</Text>
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
                        <Text style={[styles.skipLabel, { color: colors.textSecondary }]}>15</Text>
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
                        <Text style={[styles.skipLabel, { color: colors.textSecondary }]}>15</Text>
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
    headerTitle: {
        fontFamily: typography.fontFamilies.medium,
        fontSize: typography.sizes.s,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: spacing.xxxl,
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
    titleInfo: {
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.l,
        alignItems: 'center',
    },
    trackTitle: {
        fontFamily: typography.fontFamilies.semiBold,
        fontSize: typography.sizes.l,
        color: colors.text,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: 2,
    },
    trackSubtitle: {
        fontFamily: typography.fontFamilies.medium,
        fontSize: typography.sizes.m,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.s,
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
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.s,
        marginTop: -spacing.s,
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
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.l,
        marginHorizontal: spacing.xl,
    },
    transcriptHeader: {
        fontFamily: typography.fontFamilies.semiBold,
        fontSize: typography.sizes.l,
        color: colors.text,
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.l,
    },
    transcriptBox: {
        paddingHorizontal: spacing.xl,
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
