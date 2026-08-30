import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DynamicBackground } from '../components/DynamicBackground';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { Skeleton } from '../components/Skeleton';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { WeeklyStreak } from '../components/WeeklyStreak';
import { ContentPath } from '../data/types';
import { auditBookIds, assertValidBookId, assertBookIdentityConsistency, getBookByCode } from '../lib/bookIdentity';
import { DailyVerse, fetchActiveBooks, fetchBookById, fetchDailyVerse, fetchStreakData, fetchUserProgress, fetchVerseByIdAndBookId } from '../lib/queries';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../navigation/routes';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

type ResumeState = {
    book_id: string;
    verse_id: string;
    chapter_no: number;
    verse_no: number;
    last_position_seconds: number;
    book_slug: ContentPath;
    book_title: string;
};

const EXPLORE_PATHS = [
    { id: 'gita', title: 'Bhagavad Gita', icon: 'book-outline', color: '#E88B4A' },
    { id: 'ramayan', title: 'Ramayan', icon: 'navigate-outline', color: '#DE5D3D' },
    { id: 'mahabharat', title: 'Mahabharat', icon: 'flash-outline', color: '#D6A621' },
    { id: 'shiv_puran', title: 'Shiv Puran', icon: 'moon-outline', color: '#5C7485', isComingSoon: true },
    { id: 'upanishads', title: 'Upanishads', icon: 'leaf-outline', color: '#568E65', isComingSoon: true },
];

const EXPLORE_PATH_DISPLAY: Record<string, { title: string; color: string }> = {
    gita: { title: 'Bhagavad Gita', color: '#E88B4A' },
    ramayan: { title: 'Ramayan', color: '#DE5D3D' },
    mahabharat: { title: 'Mahabharat', color: '#D6A621' },
    shiv_puran: { title: 'Shiv Puran', color: '#5C7485' },
    upanishads: { title: 'Upanishads', color: '#568E65' },
};

export const HomeScreen = () => {
    const { colors, spacing, typography, layout } = useTheme();
    const navigation = useNavigation<NavigationProp>();
    
    // Strict selector-based subscriptions to prevent unnecessary re-renders
    const session = useAppStore(state => state.session);
    const setActiveBookId = useAppStore(state => state.setActiveBookId);
    const userName = useAppStore(state => state.userName);
    const setUserName = useAppStore(state => state.setUserName);

    const styles = useMemo(() => createStyles(spacing, typography), [spacing, typography]);
    const hasLoadedRef = useRef(false);
    const booksRef = useRef<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [books, setBooks] = useState<any[]>([]);
    const [activeDates, setActiveDates] = useState<string[]>([]);
    const [resumeLoading, setResumeLoading] = useState(true);
    const [resumeState, setResumeState] = useState<ResumeState | null>(null);
    const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);

    const hydrateResumeState = useCallback(async (activeBooks: any[]) => {
        if (!session?.user?.id) {
            setResumeState(null);
            setResumeLoading(false);
            return;
        }

        // REMOVED: setResumeState(null) to stabilize UI during refresh
        setResumeLoading(true);

        try {
            const progress = await fetchUserProgress(session.user.id);

            if (!progress?.bookId || !progress?.verseId) {
                // Only set null if we truly have no progress
                setResumeState(null);
                return;
            }

            const cachedBook = activeBooks.find((book) => book.book_id === progress.bookId);
            const resolvedBook = cachedBook ?? await fetchBookById(progress.bookId);

            if (!resolvedBook?.slug) {
                logger.warn('Missing book slug for progress', { progress, resolvedBook });
                setResumeState(null);
                return;
            }

            const verse = await fetchVerseByIdAndBookId(progress.bookId, progress.verseId);
            if (!verse) {
                logger.warn('Missing verse metadata for current path UI', { progress });
                setResumeState(null);
                return;
            }

            const nextResumeState: ResumeState = {
                book_id: progress.bookId,
                verse_id: progress.verseId,
                chapter_no: verse.chapter_no,
                verse_no: verse.verse_no,
                last_position_seconds: progress.position ?? 0,
                book_slug: resolvedBook.slug as ContentPath,
                book_title: resolvedBook.title ?? resolvedBook.name ?? resolvedBook.slug,
            };
            
            setActiveBookId(progress.bookId);
            setResumeState(nextResumeState);
        } catch (error) {
            logger.error('Failed to load current path resume state', { error });
            setResumeState(null);
        } finally {
            setResumeLoading(false);
        }
    }, [session?.user?.id, setActiveBookId]);

    const loadData = useCallback(async () => {
        // Read the name at call time rather than closing over it, so setting it
        // below doesn't change this callback's identity and re-trigger the focus effect.
        const { session: currentSession, userName: currentUserName } = useAppStore.getState();
        const userId = currentSession?.user?.id;
        if (!userId) return;

        // The catalogue and the display name are stable for the session, so they are
        // fetched once. Resume position, today's usage and the streak all change as
        // soon as the listener plays something — those are refreshed on every focus,
        // otherwise the "continue" card keeps showing where they were before the
        // session they just finished.
        const isFirstLoad = !hasLoadedRef.current;

        try {
            if (isFirstLoad) setLoading(true);

            const streakData = await fetchStreakData(userId);

            let activeBooks = booksRef.current;

            if (isFirstLoad) {
                activeBooks = await fetchActiveBooks();
                auditBookIds(activeBooks);
                booksRef.current = activeBooks;
                setBooks(activeBooks);

                if (!currentUserName) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('display_name')
                        .eq('id', userId)
                        .maybeSingle();

                    if (profile?.display_name) {
                        setUserName(profile.display_name);
                    }
                }
            }

            await hydrateResumeState(activeBooks);

            // A calm, deterministic "verse of the day" (Gita) — the obvious thing to
            // open when there's nothing to resume. Failure here is non-fatal.
            const gitaId = (activeBooks || []).find((b: any) => b.slug === 'gita')?.book_id
                ?? getBookByCode('gita')?.book_id;
            const dailyLang = useAppStore.getState().voicePreference.startsWith('hindi') ? 'hi' : 'en';
            if (gitaId) {
                try {
                    setDailyVerse(await fetchDailyVerse(gitaId, dailyLang));
                } catch (e) {
                    logger.warn('Failed to load daily verse', { error: e });
                }
            }

            // A real per-day record of activity — one ISO date per day the listener
            // spent time in Mangalam. The weekly widget derives everything it shows
            // from this, so Home and the Streaks screen always agree.
            setActiveDates((streakData || []).map((row: any) => row.usage_date));

            hasLoadedRef.current = true;
        } catch (error) {
            logger.error('Failed to load home data', { error });
        } finally {
            if (isFirstLoad) setLoading(false);
        }
    }, [hydrateResumeState, setUserName]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleOpenPath = async () => {
        try {
            if (resumeState) {
                const navBookId = resumeState.book_id;
                const navVerseId = resumeState.verse_id;
                assertBookIdentityConsistency({ source: 'HomeScreen.resume', bookId: navBookId });
                navigation.navigate(ROUTES.PLAY, {
                    bookId: navBookId,
                    verseId: navVerseId,
                    autoPlay: true,
                    startPosition: resumeState.last_position_seconds,
                    position: resumeState.last_position_seconds,
                    resumeSource: 'remote',
                });
                return;
            }

            const { activeBookId: currentActiveBookId } = useAppStore.getState();
            assertBookIdentityConsistency({ source: 'HomeScreen.handleOpenPath', bookId: currentActiveBookId });
            if (!assertValidBookId(currentActiveBookId, 'HomeScreen.handleOpenPath')) {
                Alert.alert('Unavailable', 'No book is selected yet.');
                return;
            }
            navigation.navigate(ROUTES.BOOK_DASHBOARD, {
                bookId: currentActiveBookId,
            });
        } catch (e) {
            logger.error('Failed to continue path', { error: e });
        }
    };

    const handleOpenDailyVerse = () => {
        if (!dailyVerse || !assertValidBookId(dailyVerse.book_id, 'HomeScreen.handleOpenDailyVerse')) return;
        setActiveBookId(dailyVerse.book_id);
        navigation.navigate(ROUTES.PLAY, { itemId: dailyVerse.verse_id, bookId: dailyVerse.book_id });
    };

    // Memoize derived UI values to improve stability
    const currentPathColor = useMemo(() => resumeState
        ? (EXPLORE_PATH_DISPLAY[resumeState.book_slug]?.color || colors.primary)
        : colors.primary, [resumeState, colors.primary]);

    const currentPathTitle = useMemo(() => resumeState?.book_title || 'Ready to begin', [resumeState]);

    const currentPathDesc = useMemo(() => resumeState
        ? `Chapter ${resumeState.chapter_no} · Verse ${resumeState.verse_no}`
        : 'Choose a path below to start listening.', [resumeState]);

    const currentPathMeta = useMemo(() => {
        if (!resumeState) return 'Take a few quiet minutes whenever you are ready.';
        const seconds = Math.max(0, Math.floor(resumeState.last_position_seconds));
        if (seconds < 5) return 'Ready when you are';
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        return `Continue from ${minutes}:${remainder < 10 ? '0' : ''}${remainder}`;
    }, [resumeState]);

    if (loading && !books.length) {
        return (
            <DynamicBackground style={styles.container}>
                <ScreenContainer edges={['top']} style={styles.container}>
                    {/* Header Skeleton */}
                    <View style={[styles.header, { marginTop: spacing.m }]}>
                    <Skeleton width={120} height={28} borderRadius={4} />
                    <Skeleton width={100} height={28} borderRadius={4} style={{ marginLeft: spacing.s }} />
                </View>

                {/* Discovery Bar Skeleton */}
                <View style={{ paddingHorizontal: spacing.l, marginBottom: spacing.l }}>
                    <Skeleton width="100%" height={56} borderRadius={16} />
                </View>

                {/* Primary Card Skeleton */}
                <View style={[styles.section, { paddingHorizontal: spacing.l }]}>
                    <Skeleton width={150} height={22} borderRadius={4} style={{ marginBottom: spacing.m }} />
                    <Skeleton width="100%" height={160} borderRadius={20} />
                </View>

                {/* Weekly Streak Skeleton */}
                <View style={[styles.section, { paddingHorizontal: spacing.l, marginTop: spacing.m }]}>
                    <Skeleton width="100%" height={120} borderRadius={20} />
                </View>
                </ScreenContainer>
            </DynamicBackground>
        );
    }

    return (
        <DynamicBackground style={styles.container}>
            <ScreenContainer edges={['top']} style={styles.container}>
            <ScrollView 
                style={styles.container} 
                contentContainerStyle={{ 
                    paddingTop: spacing.m,
                    paddingBottom: layout.miniPlayerHeight + spacing.m 
                }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={[styles.greeting, { color: colors.textSecondary }]}>Namaste, </Text>
                    <Text style={[styles.userName, { color: colors.text }]}>{userName || 'Seeker'}</Text>
                </View>

                {/* Community Discovery Bar */}
                <TouchableOpacity
                    style={[styles.discoveryBar, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => navigation.navigate('CommunityWisdom')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.discoveryIconBox, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="sparkles" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.discoveryText, { color: colors.textSecondary }]}>
                        See what others are finding meaningful
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Current Path Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                        {resumeState || resumeLoading ? 'Continue' : 'Today'}
                    </Text>
                    {resumeState || resumeLoading ? (
                        <TouchableOpacity activeOpacity={0.85} onPress={() => handleOpenPath?.()} disabled={resumeLoading}>
                            <Card style={[
                                styles.primaryCard,
                                {
                                    backgroundColor: 'transparent',
                                    borderColor: currentPathColor,
                                    borderWidth: 1.5,
                                    elevation: 0,
                                    shadowOpacity: 0
                                }
                            ]}>
                                {resumeLoading && !resumeState ? (
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardInfo}>
                                            <Skeleton width={140} height={24} borderRadius={4} style={{ marginBottom: spacing.s }} />
                                            <Skeleton width={170} height={18} borderRadius={4} style={{ marginBottom: spacing.xs }} />
                                            <Skeleton width={120} height={16} borderRadius={4} />
                                        </View>
                                        <View style={[styles.cardIconBox, { backgroundColor: currentPathColor + '15' }]}>
                                            <ActivityIndicator color={currentPathColor} />
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardInfo}>
                                            <Text style={[styles.cardTitle, { color: colors.text }]}>{currentPathTitle}</Text>
                                            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{currentPathDesc}</Text>
                                            <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>{currentPathMeta}</Text>
                                        </View>
                                        <View style={[styles.cardIconBox, { backgroundColor: currentPathColor + '15' }]}>
                                            {getScriptureIcon(resumeState?.book_slug || 'book', 32, currentPathColor)}
                                        </View>
                                    </View>
                                )}
                                <Button
                                    title="Continue"
                                    onPress={() => handleOpenPath?.()}
                                    style={styles.continueButton}
                                    disabled={resumeLoading}
                                />
                            </Card>
                        </TouchableOpacity>
                    ) : loading ? (
                        <View style={styles.primaryCard}>
                            <Skeleton width={200} height={22} borderRadius={4} style={{ marginBottom: spacing.s }} />
                            <Skeleton width={150} height={16} borderRadius={4} style={{ marginBottom: spacing.l }} />
                            <Skeleton width="100%" height={44} borderRadius={22} />
                        </View>
                    ) : dailyVerse ? (
                        <TouchableOpacity activeOpacity={0.85} onPress={handleOpenDailyVerse}>
                            <Card style={[
                                styles.primaryCard,
                                { backgroundColor: 'transparent', borderColor: colors.primary, borderWidth: 1.5, elevation: 0, shadowOpacity: 0 },
                            ]}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardInfo}>
                                        <Text style={[styles.cardTitle, { color: colors.text }]}>
                                            {dailyVerse.title || dailyVerse.sanskrit || 'Today’s verse'}
                                        </Text>
                                        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                                            Bhagavad Gita · Chapter {dailyVerse.chapter_no}, Verse {dailyVerse.verse_no}
                                        </Text>
                                        <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                                            A few quiet minutes to begin.
                                        </Text>
                                    </View>
                                    <View style={[styles.cardIconBox, { backgroundColor: colors.primary + '15' }]}>
                                        {getScriptureIcon('gita', 32, colors.primary)}
                                    </View>
                                </View>
                                <Button title="Listen" onPress={handleOpenDailyVerse} style={styles.continueButton} />
                            </Card>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ height: layout.placeholderHeight }} />
                    )}
                </View>

                {/* Weekly rhythm — same component and data as the Streaks screen */}
                <WeeklyStreak activeDates={activeDates} />

                {/* Explore Section — a single entry into the Library tab */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Explore</Text>
                    <TouchableOpacity
                        style={[styles.discoveryBar, { backgroundColor: colors.surfaceSecondary }]}
                        onPress={() => navigation.navigate('MainTabs', { screen: 'Library' })}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.discoveryIconBox, { backgroundColor: colors.primary + '15' }]}>
                            <Ionicons name="book-outline" size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.discoveryText, { color: colors.text }]}>Browse the library</Text>
                            <Text style={[styles.exploreSubtext, { color: colors.textSecondary }]}>
                                Bhagavad Gita, Ramayan, Mahabharat and more
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                    <Text style={[styles.exploreSubtext, { color: colors.textTertiary, paddingHorizontal: spacing.l, marginTop: spacing.s }]}>
                        {EXPLORE_PATHS.filter((p) => p.isComingSoon).map((p) => p.title).join(' and ')} are on the way.
                    </Text>
                </View>
            </ScrollView>
            </ScreenContainer>
        </DynamicBackground>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography']
) => StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingTop: spacing.m,
        paddingBottom: spacing.xl,
    },
    header: {
        paddingHorizontal: spacing.l,
        marginBottom: spacing.s,
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    greeting: {
        fontSize: 24,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    section: {
        marginBottom: spacing.s,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: spacing.m,
        paddingHorizontal: spacing.l,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    discoveryBar: {
        marginHorizontal: spacing.l,
        marginBottom: spacing.l,
        padding: spacing.m,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    discoveryIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.m,
    },
    discoveryText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    primaryCard: {
        marginHorizontal: spacing.l,
        marginBottom: spacing.xl,
        padding: spacing.xl,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.xl,
    },
    cardInfo: {
        flex: 1,
        marginRight: spacing.m,
    },
    cardIconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: spacing.xs,
    },
    cardDesc: {
        fontSize: 15,
        lineHeight: 22,
    },
    cardMeta: {
        fontSize: 13,
        lineHeight: 18,
        marginTop: spacing.s,
        fontWeight: '500',
    },
    continueButton: {
        width: '100%',
    },
    exploreSubtext: {
        fontSize: typography.sizes.s,
        marginTop: spacing.xs,
    },
    statGroup: {
        marginBottom: spacing.l,
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '700',
        marginLeft: spacing.s,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statCard: {
        width: 220,
        padding: spacing.m,
        borderRadius: 20,
        marginRight: spacing.m,
        borderWidth: 1,
        // Premium shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    statCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    miniIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionBadge: {
        paddingHorizontal: spacing.s,
        paddingVertical: spacing.xs,
        borderRadius: 8,
    },
    actionBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    statCardTitle: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
        marginBottom: spacing.xs,
        height: 40, // Ensure fixed height for 2 lines
    },
    statCardSubtitle: {
        fontSize: typography.sizes.xs,
        fontWeight: '500',
    },
});
