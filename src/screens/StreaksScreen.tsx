import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../components/Card';
import { LoadError } from '../components/LoadError';
import { Skeleton } from '../components/Skeleton';
import { VerseListRow } from '../components/VerseListRow';
import { WeeklyStreak } from '../components/WeeklyStreak';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { COLLECTION_METADATA } from '../data/mockGita';
import {
    BookmarkedVerse,
    fetchActiveBooks,
    fetchBookmarkedVerses,
    fetchDailyUsage,
    fetchStreakData,
    fetchVerseBookIndex,
    removeBookmark,
} from '../lib/queries';
import { formatRef } from '../lib/bookTerminology';
import { ROUTES } from '../navigation/routes';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type StreakRow = { usage_date: string; sessions_used: number | null };

type BookProgress = {
    book_id: string;
    name: string;
    slug: string;
    completed: number;
    total: number;
};

const toIsoDay = (d: Date) => d.toISOString().split('T')[0];

// ISO dates for the last seven calendar days (today back six), matching how
// user_daily_usage.usage_date is stored — used to scope "this week" figures.
const lastSevenDays = (): Set<string> => {
    const today = new Date();
    const out = new Set<string>();
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        out.add(toIsoDay(d));
    }
    return out;
};

const progressLabel = ({ completed, total }: BookProgress): string => {
    if (total === 0) return 'Coming soon';
    if (completed === 0) return 'Yet to start';
    if (completed >= total) return 'Complete';
    const pct = Math.max(1, Math.round((completed / total) * 100));
    return `${pct}% complete`;
};

export const StreaksScreen = () => {
    const { colors, spacing, typography, borderRadius, layout } = useTheme();
    const styles = useMemo(() => createStyles(typography, spacing), [typography, spacing]);
    const navigation = useNavigation<NavigationProp>();
    const { session, completedVerses, voicePreference } = useAppStore();
    const lang = voicePreference.startsWith('hindi') ? 'hi' : 'en';
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [usageToday, setUsageToday] = useState(0);
    const [streakRows, setStreakRows] = useState<StreakRow[]>([]);
    const [bookProgress, setBookProgress] = useState<BookProgress[]>([]);
    const [bookmarks, setBookmarks] = useState<BookmarkedVerse[]>([]);

    const loadData = useCallback(async () => {
        if (!session?.user) return;
        try {
            setLoading(true);
            setLoadError(false);
            const [streakData, todayUsage, books, verseIndex, bms] = await Promise.all([
                fetchStreakData(session.user.id),
                fetchDailyUsage(session.user.id),
                fetchActiveBooks(),
                fetchVerseBookIndex(),
                fetchBookmarkedVerses(session.user.id, lang),
            ]);

            setStreakRows((streakData as StreakRow[]) || []);
            setUsageToday(todayUsage?.sessions_used || 0);
            setBookmarks(bms);

            const totalByBook = new Map<string, number>();
            for (const row of verseIndex) {
                totalByBook.set(row.book_id, (totalByBook.get(row.book_id) || 0) + 1);
            }
            const completedSet = new Set(completedVerses);
            const completedByBook = new Map<string, number>();
            for (const row of verseIndex) {
                if (completedSet.has(row.verse_id)) {
                    completedByBook.set(row.book_id, (completedByBook.get(row.book_id) || 0) + 1);
                }
            }
            setBookProgress(
                (books || []).map((b: any) => ({
                    book_id: b.book_id,
                    name: b.title_en || b.title || b.title_hi || COLLECTION_METADATA[b.slug]?.title || 'Wisdom',
                    slug: b.slug,
                    completed: completedByBook.get(b.book_id) || 0,
                    total: totalByBook.get(b.book_id) || 0,
                })),
            );
        } catch (error) {
            logger.error('Failed to load Journey data', { error });
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [session, lang, completedVerses]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    // Distinct days the listener has spent time in Mangalam (their most recent year).
    const daysOfPractice = streakRows.length;
    const activeDates = useMemo(() => streakRows.map((r) => r.usage_date), [streakRows]);

    // Sessions across the last seven days — a measured sum, not an estimate.
    const sessionsThisWeek = useMemo(() => {
        const week = lastSevenDays();
        return streakRows
            .filter((r) => week.has(r.usage_date))
            .reduce((sum, r) => sum + (r.sessions_used || 0), 0);
    }, [streakRows]);

    const handleOpenBookmark = (b: BookmarkedVerse) => {
        navigation.navigate(ROUTES.PLAY, { itemId: b.verse_id, bookId: b.book_id });
    };

    const handleRemoveBookmark = async (b: BookmarkedVerse) => {
        setBookmarks((prev) => prev.filter((x) => x.bookmarkId !== b.bookmarkId));
        try {
            await removeBookmark(b.bookmarkId);
        } catch (error) {
            logger.error('Failed to remove bookmark', { error });
            loadData(); // reconcile on failure
        }
    };

    if (loading) {
        return (
            <ScreenContainer
                edges={['top']}
                style={[styles.container, { backgroundColor: colors.background, paddingHorizontal: spacing.l, paddingTop: spacing.m }]}
            >
                <Skeleton width={150} height={32} borderRadius={borderRadius.s} style={{ marginBottom: spacing.l }} />
                <Skeleton width="100%" height={180} borderRadius={borderRadius.l} style={{ marginBottom: spacing.xl }} />
                <Skeleton width="100%" height={130} borderRadius={borderRadius.l} style={{ marginBottom: spacing.xl }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Skeleton width="48%" height={90} borderRadius={borderRadius.l} />
                    <Skeleton width="48%" height={90} borderRadius={borderRadius.l} />
                </View>
            </ScreenContainer>
        );
    }

    if (loadError) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
                <LoadError onRetry={loadData} />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={{
                    paddingHorizontal: spacing.l,
                    paddingTop: spacing.m,
                    paddingBottom: layout.miniPlayerHeight + spacing.m,
                }}
            >
                <Text style={[styles.screenTitle, { color: colors.text, marginBottom: spacing.l }]}>Your Journey</Text>

                <Card style={[styles.practiceCard, { paddingVertical: spacing.xxl, marginBottom: spacing.xl }]}>
                    <View style={[styles.practiceHeader, { marginBottom: spacing.xl }]}>
                        <Text style={[styles.practiceNumber, { color: colors.primary }]}>{daysOfPractice}</Text>
                        <Text style={[styles.practiceLabel, { color: colors.textSecondary }]}>
                            {daysOfPractice === 1 ? 'day of practice' : 'days of practice'}
                        </Text>
                    </View>

                    <Text style={[styles.encouragementText, { color: colors.textSecondary, paddingHorizontal: spacing.m }]}>
                        Consistency over intensity. Taking ten minutes a day for reflection builds a resilient mind.
                    </Text>
                </Card>

                <WeeklyStreak activeDates={activeDates} />

                <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: spacing.m }]}>Stats</Text>
                <View style={[styles.statsRow, { gap: spacing.m }]}>
                    <Card style={[styles.statCard, { paddingVertical: spacing.l }]}>
                        <Text style={[styles.statValue, { color: colors.primary, marginBottom: spacing.xs }]}>{usageToday}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sessions today</Text>
                    </Card>
                    <Card style={[styles.statCard, { paddingVertical: spacing.l }]}>
                        <Text style={[styles.statValue, { color: colors.primary, marginBottom: spacing.xs }]}>{sessionsThisWeek}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sessions this week</Text>
                    </Card>
                </View>

                {/* ── Your progress ── */}
                {bookProgress.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.m }]}>
                            Your progress
                        </Text>
                        <Card style={{ paddingVertical: spacing.xs }}>
                            {bookProgress.map((bp, i) => {
                                const pct = bp.total > 0 ? Math.min(1, bp.completed / bp.total) : 0;
                                return (
                                    <View
                                        key={bp.book_id}
                                        style={[
                                            styles.progressRow,
                                            i < bookProgress.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                        ]}
                                    >
                                        <View style={[styles.progressIconBox, { backgroundColor: colors.surfaceSecondary }]}>
                                            {getScriptureIcon(bp.slug, 18, colors.primary)}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.progressName, { color: colors.text }]}>{bp.name}</Text>
                                            {pct > 0 && pct < 1 && (
                                                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
                                                    <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${pct * 100}%` }]} />
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.progressStatus, { color: colors.textSecondary }]}>
                                            {progressLabel(bp)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </Card>
                    </>
                )}

                {/* ── Your bookmarks ── */}
                <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.m }]}>
                    Your bookmarks
                </Text>
                {bookmarks.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Verses you bookmark while listening will gather here.
                    </Text>
                ) : (
                    bookmarks.map((b) => (
                        <VerseListRow
                            key={b.bookmarkId}
                            badge={b.verse_no}
                            title={b.title || b.sanskrit || 'Verse'}
                            subtitle={formatRef(b.book_id, b.chapter_no, b.verse_no, ', ')}
                            onPress={() => handleOpenBookmark(b)}
                            right={
                                <TouchableOpacity onPress={() => handleRemoveBookmark(b)} hitSlop={10} accessibilityLabel="Remove bookmark">
                                    <Ionicons name="bookmark" size={20} color={colors.primary} />
                                </TouchableOpacity>
                            }
                        />
                    ))
                )}
            </ScrollView>
        </ScreenContainer>
    );
};

const createStyles = (
    typography: ReturnType<typeof useTheme>['typography'],
    spacing: ReturnType<typeof useTheme>['spacing'],
) => StyleSheet.create({
    container: {
        flex: 1,
    },
    screenTitle: {
        fontWeight: 'bold',
        fontSize: typography.sizes.xxl,
    },
    practiceCard: {
        alignItems: 'center',
    },
    practiceHeader: {
        alignItems: 'center',
    },
    practiceNumber: {
        fontSize: typography.sizes.hero,
        fontWeight: 'bold',
    },
    practiceLabel: {
        fontSize: 18,
    },
    encouragementText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    sectionTitle: {
        fontSize: 18,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontWeight: 'bold',
        fontSize: 28,
    },
    statLabel: {
        fontSize: 12,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.m,
        paddingHorizontal: spacing.m,
        gap: spacing.m,
    },
    progressIconBox: {
        width: spacing.xl,
        height: spacing.xl,
        borderRadius: spacing.m,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressName: {
        fontSize: typography.sizes.m,
        fontWeight: '600',
    },
    progressTrack: {
        height: spacing.xs,
        borderRadius: spacing.xs,
        overflow: 'hidden',
        marginTop: spacing.xs,
    },
    progressFill: {
        height: '100%',
    },
    progressStatus: {
        fontSize: typography.sizes.s,
    },
    emptyText: {
        fontSize: 15,
        lineHeight: 22,
    },
});
