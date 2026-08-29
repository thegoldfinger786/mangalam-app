import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { WeeklyStreak } from '../components/WeeklyStreak';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { fetchDailyUsage, fetchStreakData } from '../lib/queries';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

type StreakRow = { usage_date: string; sessions_used: number | null };

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

export const StreaksScreen = () => {
    const { colors, spacing, typography, layout } = useTheme();
    const styles = useMemo(() => createStyles(typography), [typography]);
    const { session } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [usageToday, setUsageToday] = useState(0);
    const [streakRows, setStreakRows] = useState<StreakRow[]>([]);

    const loadStreakData = useCallback(async () => {
        if (!session?.user) return;
        try {
            setLoading(true);
            const [streakData, todayUsage] = await Promise.all([
                fetchStreakData(session.user.id),
                fetchDailyUsage(session.user.id),
            ]);

            setStreakRows((streakData as StreakRow[]) || []);
            setUsageToday(todayUsage?.sessions_used || 0);
        } catch (error) {
            logger.error('Failed to load streak screen data', { error });
        } finally {
            setLoading(false);
        }
    }, [session]);

    useFocusEffect(
        useCallback(() => {
            loadStreakData();
        }, [loadStreakData])
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

    if (loading) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
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
            </ScrollView>
        </ScreenContainer>
    );
};

const createStyles = (typography: ReturnType<typeof useTheme>['typography']) => StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
});
