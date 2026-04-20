import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DynamicBackground } from '../components/DynamicBackground';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { Skeleton } from '../components/Skeleton';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { WeeklyStreak } from '../components/WeeklyStreak';
import { ContentPath } from '../data/types';
import { auditBookIds, assertValidBookId, assertBookIdentityConsistency } from '../lib/bookIdentity';
import { fetchActiveBooks, fetchBookById, fetchDailyUsage, fetchStreakData, fetchUserProgress, fetchVerseByIdAndBookId } from '../lib/queries';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../navigation/routes';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useAudioStore } from '../store/useAudioStore';
import { useTheme } from '../theme';
import { useRef } from 'react';

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
    console.log("HOME_RENDER");
    const { colors, spacing, typography, layout } = useTheme();
    const navigation = useNavigation<NavigationProp>();
    
    // Strict selector-based subscriptions to prevent unnecessary re-renders
    const session = useAppStore(state => state.session);
    const activeBookId = useAppStore(state => state.activeBookId);
    const setActiveBookId = useAppStore(state => state.setActiveBookId);
    const userName = useAppStore(state => state.userName);
    const setUserName = useAppStore(state => state.setUserName);

    // Decoupled from playback ticks (position, isPlaying)
    const currentPlayingBookId = useAudioStore(state => state.currentContent?.bookId);

    const styles = useMemo(() => createStyles(spacing), [spacing]);
    const hasLoadedRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [books, setBooks] = useState<any[]>([]);
    const [usage, setUsage] = useState<any>(null);
    const [streakCount, setStreakCount] = useState(0);
    const [resumeLoading, setResumeLoading] = useState(true);
    const [resumeState, setResumeState] = useState<ResumeState | null>(null);

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
                console.log('CURRENT_PATH_UI_SOURCE', null);
                // Only set null if we truly have no progress
                setResumeState(null);
                return;
            }

            const cachedBook = activeBooks.find((book) => book.book_id === progress.bookId);
            const resolvedBook = cachedBook ?? await fetchBookById(progress.bookId);

            if (!resolvedBook?.slug) {
                console.error('Missing book slug for progress', { progress, resolvedBook });
                console.log('CURRENT_PATH_UI_SOURCE', null);
                setResumeState(null);
                return;
            }

            const verse = await fetchVerseByIdAndBookId(progress.bookId, progress.verseId);
            if (!verse) {
                console.error('Missing verse metadata for current path UI', { progress });
                console.log('CURRENT_PATH_UI_SOURCE', null);
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

            console.log('CURRENT_PATH_UI_SOURCE', nextResumeState);
            console.log('RESUME_DEBUG', {
                source: 'remote',
                book_id: nextResumeState.book_id,
                chapter_no: nextResumeState.chapter_no,
                verse_no: nextResumeState.verse_no,
                verse_id: nextResumeState.verse_id,
                audio_path: null,
            });
            setActiveBookId(progress.bookId);
            setResumeState(nextResumeState);
        } catch (error) {
            console.error('Error loading current path resume state:', error);
            console.log('CURRENT_PATH_UI_SOURCE', null);
            setResumeState(null);
        } finally {
            setResumeLoading(false);
        }
    }, [session?.user?.id, setActiveBookId]);

    const loadData = useCallback(async () => {
        if (!session?.user || hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        try {
            setLoading(true);
            const [activeBooks, dailyUsage, streakData] = await Promise.all([
                fetchActiveBooks(),
                fetchDailyUsage(session.user.id),
                fetchStreakData(session.user.id)
            ]);
            auditBookIds(activeBooks);
            console.log('BOOKS_LOADED', activeBooks.map((b: any) => ({
                title: b.title,
                book_id: b.book_id,
                slug: b.slug,
            })));

            if (!userName) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profile?.display_name) {
                    setUserName(profile.display_name);
                }
            }

            setBooks(activeBooks);
            await hydrateResumeState(activeBooks);
            setUsage(dailyUsage);

            // Basic streak calculation for MVP: count unique dates in the last 30 days
            // (Real logic would check for gaps, but user says "compute streak from user_daily_usage rows")
            setStreakCount(streakData?.length || 0);
        } catch (error) {
            console.error('Error loading home data:', error);
        } finally {
            setLoading(false);
        }
    }, [hydrateResumeState, session, setUserName, userName]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleOpenPath = async () => {
        console.log('handleOpenPath START');

        try {
            if (resumeState) {
                const navBookId = resumeState.book_id;
                const navVerseId = resumeState.verse_id;
                console.log('RESUME_COMPARE', {
                    ui_book_id: resumeState.book_id,
                    ui_verse_id: resumeState.verse_id,
                    nav_book_id: navBookId,
                    nav_verse_id: navVerseId,
                });
                if (resumeState.verse_id !== navVerseId) {
                    console.warn('RESUME_COMPARE mismatch', {
                        ui_verse_id: resumeState.verse_id,
                        nav_verse_id: navVerseId,
                    });
                }
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
            console.log('Continue error:', e);
        }
    };

    const handlePathPress = (book: any) => {
        const clickedTitle = book?.title_en || book?.title_hi || book?.title || book?.name || 'Unknown';
        console.log('BOOK_CLICK', {
            clicked_title: clickedTitle,
            clicked_book_id: book?.book_id ?? null,
        });

        const navigateToBookDashboard = () => {
            if (!assertValidBookId(book?.book_id, 'HomeScreen.handlePathPress')) {
                console.warn('BOOK_MISMATCH_DETECTED', {
                    clicked_title: clickedTitle,
                    clicked_book_id: null,
                    reason: 'missing_book_mapping',
                });
                Alert.alert('Unavailable', 'This book is not available right now.');
                return;
            }
            console.log('NAVIGATE_BOOK', {
                passed_book_id: book.book_id,
            });
            assertBookIdentityConsistency({ source: 'HomeScreen.handlePathPress', bookId: book.book_id });
            navigation.navigate(ROUTES.BOOK_DASHBOARD, {
                bookId: book.book_id,
                clickedBookId: book.book_id,
                clickedTitle: clickedTitle,
            });
        };

        if (book.book_id === activeBookId) {
            navigateToBookDashboard();
        } else {
            console.log('Alert triggered');
            Alert.alert(
                'Change Path?',
                `You are currently focused on the ${currentPathTitle} path. Subtle persistence leads to deeper wisdom. Are you sure you want to change paths?`,
                [
                    { text: 'Stay Focused', style: 'cancel' },
                    {
                        text: 'Change Path',
                        onPress: () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setActiveBookId(book.book_id);
                            navigateToBookDashboard();
                        }
                    }
                ]
            );
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        let timeGreeting = 'Good morning';
        if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
        else if (hour >= 17) timeGreeting = 'Good evening';

        const displayFirstName = session?.user?.user_metadata?.first_name || userName;
        return displayFirstName ? `${timeGreeting}, ${displayFirstName}.` : `${timeGreeting}.`;
    };

    // Memoize derived UI values to improve stability
    const currentPathColor = useMemo(() => resumeState
        ? (EXPLORE_PATH_DISPLAY[resumeState.book_slug]?.color || colors.primary)
        : colors.primary, [resumeState, colors.primary]);

    const currentPathTitle = useMemo(() => resumeState?.book_title || 'No recent verse', [resumeState]);

    const currentPathDesc = useMemo(() => resumeState
        ? `Chapter ${resumeState.chapter_no} · Verse ${resumeState.verse_no}`
        : 'Your current path will appear here after you start a verse.', [resumeState]);

    const currentPathMeta = useMemo(() => resumeState
        ? `Resume at ${Math.max(0, Math.floor(resumeState.last_position_seconds))}s`
        : 'Resume is unavailable until remote progress exists.', [resumeState]);

    const exploreBooks = useMemo(() => books.map((book) => ({
        ...book,
        displayTitle: book.title_en || book.title_hi || book.title || book.name || EXPLORE_PATH_DISPLAY[book.slug]?.title || 'Untitled',
        displayColor: EXPLORE_PATH_DISPLAY[book.slug]?.color || colors.primary,
    })), [books, colors.primary]);
    console.log('handleOpenPath exists:', typeof handleOpenPath);

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
                        See what others are studying today
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Current Path Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>My Current Path</Text>
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
                    ) : (
                        <View style={{ height: layout.placeholderHeight }} />
                    )}
                </View>

                {/* Weekly Streak UI - Linked to Supabase */}
                <WeeklyStreak
                    currentStreak={streakCount}
                    sessionsToday={usage?.sessions_used || 0}
                />

                {/* Explore Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Explore Paths</Text>
                    <View style={styles.exploreGrid}>
                        {exploreBooks.map((book) => (
                            <TouchableOpacity
                                key={book.book_id}
                                style={[
                                    styles.exploreItem,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: activeBookId === book.book_id ? book.displayColor : colors.border,
                                        borderWidth: activeBookId === book.book_id ? 2 : 1,
                                    }
                                ]}
                                onPress={() => handlePathPress(book)}
                            >
                                <View style={[styles.exploreIconBox, { backgroundColor: book.displayColor + '15' }]}>
                                    {getScriptureIcon(book.slug || 'book', 28, book.displayColor)}
                                </View>
                                <Text style={[styles.exploreItemTitle, { color: colors.text }]}>{book.displayTitle}</Text>
                            </TouchableOpacity>
                        ))}
                        {EXPLORE_PATHS.filter((path) => path.isComingSoon).map((path) => (
                            <TouchableOpacity
                                key={path.id}
                                style={[
                                    styles.exploreItem,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.border,
                                        borderWidth: 1,
                                        opacity: 0.6,
                                    }
                                ]}
                                disabled
                            >
                                <View style={[styles.exploreIconBox, { backgroundColor: path.color + '15' }]}>
                                    {getScriptureIcon(path.id, 28, path.color)}
                                </View>
                                <Text style={[styles.exploreItemTitle, { color: colors.text }]}>{path.title}</Text>
                                <View style={[styles.miniBadge, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Text style={[styles.miniBadgeText, { color: colors.textTertiary }]}>Soon</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>
            </ScreenContainer>
        </DynamicBackground>
    );
};

const createStyles = (spacing: ReturnType<typeof useTheme>['spacing']) => StyleSheet.create({
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
    exploreGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.l,
        justifyContent: 'space-between',
    },
    exploreItem: {
        width: '48%',
        marginBottom: spacing.m,
        padding: spacing.xl,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    exploreIconBox: {
        width: 64, // Slightly increased
        height: 64, // Slightly increased
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    sectionSubtitle: {
        fontSize: typography.sizes.s,
        marginTop: spacing.xs,
    },
    exploreItemTitle: {
        fontSize: typography.sizes.s,
        textAlign: 'center',
        fontWeight: '500',
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
    miniBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: spacing.s,
        paddingVertical: spacing.micro,
        borderRadius: 6,
    },
    miniBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }
});
