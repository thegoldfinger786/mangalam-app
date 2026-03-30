import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Button } from '../components/Button';
import { COLLECTION_METADATA } from '../data/mockGita';
import { checkAudioCache, fetchAdjacentVerse, incrementDailyUsage } from '../lib/queries';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

const { width } = Dimensions.get('window');
const GITA_COVER = require('../../assets/images/gita-cover.png');

export const PlayScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { itemId, type, autoPlay } = route.params;

    const { voicePreference, session } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<any>(null);
    const [isAllowed, setIsAllowed] = useState(true);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [bookId, setBookId] = useState<string | null>(null);
    const [prevVerseId, setPrevVerseId] = useState<string | null>(null);
    const [nextVerseId, setNextVerseId] = useState<string | null>(null);

    const sound = useRef<Audio.Sound | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const [scrollContentHeight, setScrollContentHeight] = useState(0);
    const [scrollViewHeight, setScrollViewHeight] = useState(0);

    const meta = COLLECTION_METADATA[type as string] || { title: 'Unknown', icon: 'book', color: theme.colors.primary };

    const loadContentAndCheckUsage = useCallback(async () => {
        if (!session) return;

        try {
            setLoading(true);

            // 1. Content Fetching
            const isVerse = type === 'gita' || type === 'upanishads';
            const lang = voicePreference.startsWith('hindi') ? 'hi' : 'en';

            let data: any = {};

            if (isVerse) {
                const { data: verse, error: verseErr } = await supabase.from('verses').select('*').eq('verse_id', itemId).single();
                if (verseErr) throw verseErr;

                const { data: verseContent } = await supabase
                    .from('verse_content')
                    .select('*')
                    .eq('verse_id', itemId)
                    .eq('language', lang)
                    .single();

                data = { ...verse, ...verseContent };
            } else {
                const { data: episode, error: epErr } = await supabase.from('episodes').select('*').eq('episode_id', itemId).single();
                if (epErr) throw epErr;

                const { data: epContent } = await supabase
                    .from('episode_content')
                    .select('*')
                    .eq('episode_id', itemId)
                    .eq('language', lang)
                    .single();

                data = { ...episode, ...epContent };
            }

            setContent(data);
            setIsAllowed(true);

            // Fetch adjacent verses for prev/next navigation (verse types only)
            if (isVerse && data?.book_id) {
                setBookId(data.book_id);
                const [prev, next] = await Promise.all([
                    fetchAdjacentVerse(data.book_id, data.chapter_no, data.verse_no, 'prev'),
                    fetchAdjacentVerse(data.book_id, data.chapter_no, data.verse_no, 'next'),
                ]);
                setPrevVerseId(prev?.verse_id ?? null);
                setNextVerseId(next?.verse_id ?? null);
            } else {
                setPrevVerseId(null);
                setNextVerseId(null);
            }

            // 2. Increment Usage (Non-blocking)
            try {
                await incrementDailyUsage(session.user.id);
            } catch (usageError: any) {
                // If the error is specific to "Daily Limit Reached" (we can handle this if we return a status from RPC)
                // For now, we just log and continue so the UI doesn't break
                console.warn('Usage tracking issue:', usageError.message);
            }

            // 3. Audio Cache Check
            const gender = voicePreference.endsWith('-male') ? 'male' : 'female';
            const VOICE_MAP: Record<string, Record<string, string>> = {
                en: { male: 'en-IN-Neural2-B', female: 'en-IN-Neural2-A' },
                hi: { male: 'hi-IN-Neural2-B', female: 'hi-IN-Neural2-A' }
            };
            const voiceId = VOICE_MAP[lang][gender];

            try {
                const cache = await checkAudioCache({
                    contentType: isVerse ? 'verse' : 'narrative',
                    contentId: itemId,
                    section: 'full_narrative',
                    lang,
                    voice: voiceId,
                    engine: 'google-tts'
                });

                if (cache?.storage_path) {
                    const { data: urlData } = supabase.storage
                        .from('audio-content')
                        .getPublicUrl(cache.storage_path);

                    if (urlData?.publicUrl) {
                        setAudioUrl(urlData.publicUrl);
                    }
                }
            } catch (cacheError) {
                console.error('Audio cache error:', cacheError);
            }

        } catch (error: any) {
            console.error('PlayScreen init error:', error);
            Alert.alert('Error', 'Failed to load content. Please check your connection.');
        } finally {
            setLoading(false);
        }
    }, [session, itemId, type, voicePreference]);

    useEffect(() => {
        loadContentAndCheckUsage();

        return () => {
            if (sound.current) {
                sound.current.unloadAsync();
            }
        };
    }, [loadContentAndCheckUsage]);

    // Audio loading effect
    useEffect(() => {
        let activeSound: Audio.Sound | null = null;

        const loadAudio = async () => {
            if (!audioUrl) return;
            try {
                await Audio.setAudioModeAsync({
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                });

                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: audioUrl },
                    { shouldPlay: false, rate: playbackRate },
                    onPlaybackStatusUpdate
                );
                sound.current = newSound;
                activeSound = newSound;

                // Carry forward play state from previous verse (prev/next navigation)
                if (autoPlay) {
                    await newSound.playAsync();
                }
            } catch (error) {
                console.warn("Failed to load audio", error);
            }
        };

        loadAudio();

        return () => {
            if (activeSound) {
                activeSound.unloadAsync();
            }
        };
    }, [audioUrl]);

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            setPosition(status.positionMillis);
            setDuration(status.durationMillis || 1);
            setIsPlaying(status.isPlaying);

            if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(status.durationMillis);
            }
        }
    };

    // Auto-scroll transcript proportionally to audio position
    useEffect(() => {
        if (!isPlaying || duration <= 1 || scrollContentHeight <= scrollViewHeight) return;
        const progress = position / duration;
        const maxScroll = scrollContentHeight - scrollViewHeight;
        const targetY = progress * maxScroll;
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
    }, [position]);

    const togglePlayPause = async () => {
        if (!sound.current) {
            if (!audioUrl) Alert.alert('Audio Coming Soon', 'Audio generation is not yet available for this item.');
            return;
        }

        if (isPlaying) {
            await sound.current.pauseAsync();
        } else {
            if (position >= duration) {
                await sound.current.playFromPositionAsync(0);
            } else {
                await sound.current.playAsync();
            }
        }
    };

    const skipForward = async () => {
        if (!sound.current) return;
        const newPosition = Math.min(position + 15000, duration);
        await sound.current.setPositionAsync(newPosition);
    };

    const skipBackward = async () => {
        if (!sound.current) return;
        const newPosition = Math.max(position - 15000, 0);
        await sound.current.setPositionAsync(newPosition);
    };

    const handleSlidingComplete = async (value: number) => {
        if (!sound.current) return;
        await sound.current.setPositionAsync(value);
    };

    const toggleSpeed = async () => {
        if (!sound.current) return;
        const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
        const currentIdx = rates.indexOf(playbackRate);
        const newRate = rates[(currentIdx + 1) % rates.length];
        await sound.current.setRateAsync(newRate, true);
        setPlaybackRate(newRate);
    };

    const navigateToVerse = async (targetVerseId: string) => {
        const wasPlaying = isPlaying;
        if (sound.current) {
            await sound.current.stopAsync();
            await sound.current.unloadAsync();
            sound.current = null;
        }
        setIsPlaying(false);
        setPosition(0);
        setDuration(1);
        setAudioUrl(null);
        navigation.replace('Play', { itemId: targetVerseId, type, autoPlay: wasPlaying });
    };

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (isAllowed === false) {
        return (
            <View style={[styles.container, styles.center, { padding: theme.spacing.xl }]}>
                <Ionicons name="lock-closed" size={64} color={theme.colors.primary} style={{ marginBottom: theme.spacing.l }} />
                <Text style={[styles.trackTitle, { marginBottom: theme.spacing.m }]}>Daily Limit Reached</Text>
                <Text style={[styles.trackSubtitle, { marginBottom: theme.spacing.xl, textAlign: 'center' }]}>
                    You have reached your free limit of 3 sessions today. Support us to unlock unlimited wisdom.
                </Text>
                <Button
                    title="Become a Supporter"
                    onPress={() => Alert.alert('Coming Soon', 'In-app purchases will be enabled in the final version.')}
                />
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: theme.spacing.xl }}>
                    <Text style={{ color: theme.colors.textSecondary }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const isVerse = type === 'gita' || type === 'upanishads';

    const playerBarBg = theme.colors.background + 'E8'; // ~91% opacity, slightly transparent

    return (
        <SafeAreaView style={styles.container}>
            {/* ── Fixed Top Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <Ionicons name="chevron-down" size={26} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Now Playing</Text>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            {/* ── Cover Art + Titles (fixed, not scrollable) ── */}
            <View style={styles.topSection}>
                {type === 'gita' ? (
                    <Image source={GITA_COVER} style={styles.coverImage} resizeMode="cover" />
                ) : (
                    <View style={[styles.coverArt, { backgroundColor: meta.color + '20' }]}>
                        <Ionicons name={meta.icon + '-outline' as any} size={64} color={meta.color} />
                    </View>
                )}
                <Text style={styles.trackTitle}>
                    {isVerse ? `Chapter ${content?.chapter_no}  ·  Verse ${content?.verse_no}` : content?.title}
                </Text>
                <Text style={styles.trackSubtitle}>{meta.title}</Text>
            </View>

            {/* ── Auto-scrolling Transcript ── */}
            <ScrollView
                ref={scrollRef}
                style={styles.transcriptScroll}
                contentContainerStyle={styles.transcriptContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={(_, h) => setScrollContentHeight(h)}
                onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
                scrollEventThrottle={200}
            >
                {isVerse ? (
                    <>
                        {content?.sanskrit && <Text style={styles.contentSanskrit}>{content.sanskrit}</Text>}

                        <Text style={styles.contentSubtitle}>Translation</Text>
                        <Text style={styles.contentText}>{content?.translation}</Text>

                        <Text style={styles.contentSubtitle}>Commentary</Text>
                        <Text style={styles.contentText}>{content?.commentary}</Text>

                        {(content?.dailyLifeApplication || content?.daily_life_application) && (
                            <>
                                <Text style={styles.contentSubtitle}>Daily Life Application</Text>
                                <Text style={styles.contentText}>
                                    {content?.dailyLifeApplication || content?.daily_life_application}
                                </Text>
                            </>
                        )}

                        {(content?.practicalExamples || content?.practical_examples)?.length > 0 && (
                            <>
                                <Text style={styles.contentSubtitle}>Practical Examples</Text>
                                {(content?.practicalExamples || content?.practical_examples).map((ex: string, idx: number) => (
                                    <Text key={idx} style={[styles.contentText, { marginBottom: theme.spacing.m }]}>
                                        • {ex}
                                    </Text>
                                ))}
                            </>
                        )}
                        {/* Extra padding so last text isn't hidden behind player */}
                        <View style={{ height: 200 }} />
                    </>
                ) : (
                    <>
                        <Text style={styles.contentText}>{content?.story_segment}</Text>
                        <Text style={styles.contentSubtitle}>Context</Text>
                        <Text style={styles.contentText}>{content?.context_explanation}</Text>
                        <Text style={styles.contentSubtitle}>Application</Text>
                        <Text style={styles.contentText}>{content?.modern_application}</Text>
                        <View style={{ height: 200 }} />
                    </>
                )}
            </ScrollView>

            {/* ── Floating Player Bar (bottom, semi-transparent) ── */}
            <View style={[styles.playerBar, { backgroundColor: playerBarBg }]}>
                {/* Progress Slider */}
                <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={duration}
                    value={position}
                    onSlidingComplete={handleSlidingComplete}
                    minimumTrackTintColor={theme.colors.primary}
                    maximumTrackTintColor={theme.colors.border}
                    thumbTintColor={theme.colors.secondary}
                />
                {/* Time + Speed row */}
                <View style={styles.timeAndSpeedRow}>
                    <Text style={styles.timeText}>{formatTime(position)}</Text>
                    <TouchableOpacity onPress={toggleSpeed} style={styles.speedPill}>
                        <Text style={styles.speedPillText}>{playbackRate}x</Text>
                    </TouchableOpacity>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>

                {/* 5-Button Controls */}
                <View style={styles.controlsRow}>
                    <TouchableOpacity
                        onPress={() => prevVerseId && navigateToVerse(prevVerseId)}
                        style={[styles.edgeBtn, !prevVerseId && styles.btnDisabled]}
                        disabled={!prevVerseId}
                    >
                        <Ionicons name="play-skip-back" size={22} color={theme.colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={skipBackward} style={styles.skipBtn}>
                        <Ionicons name="play-back" size={24} color={theme.colors.text} />
                        <Text style={styles.skipLabel}>15</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={togglePlayPause} style={styles.playBtnLarge}>
                        <Ionicons
                            name={isPlaying ? 'pause' : 'play'}
                            size={34}
                            color={theme.colors.textInverse}
                            style={{ marginLeft: isPlaying ? 0 : 3 }}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={skipForward} style={styles.skipBtn}>
                        <Ionicons name="play-forward" size={24} color={theme.colors.text} />
                        <Text style={styles.skipLabel}>15</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => nextVerseId && navigateToVerse(nextVerseId)}
                        style={[styles.edgeBtn, !nextVerseId && styles.btnDisabled]}
                        disabled={!nextVerseId}
                    >
                        <Ionicons name="play-skip-forward" size={22} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.m,
        paddingTop: theme.spacing.m,
    },
    iconButton: {
        padding: theme.spacing.xs,
    },
    headerTitle: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.s,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    scrollContent: {
        paddingBottom: theme.spacing.xxxl,
    },
    topSection: {
        alignItems: 'center',
        paddingTop: theme.spacing.s,
        paddingBottom: theme.spacing.s,
        paddingHorizontal: theme.spacing.xl,
    },
    coverWrapper: {
        alignItems: 'center',
        marginTop: theme.spacing.xl,
        marginBottom: theme.spacing.xl,
    },
    coverArt: {
        width: 160,
        height: 160,
        borderRadius: theme.borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.cardShadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 6,
        marginBottom: theme.spacing.s,
    },
    coverImage: {
        width: 160,
        height: 160,
        borderRadius: theme.borderRadius.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
        marginBottom: theme.spacing.s,
    },
    titleInfo: {
        paddingHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.l,
        alignItems: 'center',
    },
    trackTitle: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.text,
        textAlign: 'center',
        marginTop: theme.spacing.xs,
        marginBottom: 2,
    },
    trackSubtitle: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: theme.spacing.xs,
    },
    // ── Transcript area ──
    transcriptScroll: {
        flex: 1,
    },
    transcriptContent: {
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.m,
    },
    // ── Floating player bar ──
    playerBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: theme.spacing.m,
        paddingTop: theme.spacing.xs,
        paddingBottom: theme.spacing.l,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    slider: {
        width: '100%',
        height: 32,
        marginHorizontal: -4,
    },
    timeAndSpeedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.s,
        marginTop: -6,
        marginBottom: 4,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.s,
        marginTop: -8,
    },
    timeText: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.xs,
        color: theme.colors.textSecondary,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: theme.spacing.m,
        marginBottom: theme.spacing.s,
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
        borderRadius: 34,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.primary,
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
        right: -4,
        fontSize: 9,
        fontFamily: theme.typography.fontFamilies.semiBold,
        color: theme.colors.textSecondary,
    },
    speedPill: {
        alignSelf: 'center',
        marginTop: theme.spacing.s,
        backgroundColor: theme.colors.surfaceSecondary,
        borderRadius: 20,
        paddingHorizontal: theme.spacing.m,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    speedPillText: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.s,
        color: theme.colors.primary,
        letterSpacing: 0.5,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: theme.spacing.l,
        marginHorizontal: theme.spacing.xl,
    },
    transcriptHeader: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.text,
        paddingHorizontal: theme.spacing.xl,
        marginBottom: theme.spacing.l,
    },
    transcriptBox: {
        paddingHorizontal: theme.spacing.xl,
    },
    contentSanskrit: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.xl,
        color: theme.colors.text,
        textAlign: 'center',
        lineHeight: theme.typography.lineHeights.xl,
        marginBottom: theme.spacing.xl,
    },
    contentSubtitle: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.s,
    },
    contentText: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.text,
        lineHeight: theme.typography.lineHeights.l,
        marginBottom: theme.spacing.xl,
    }
});

