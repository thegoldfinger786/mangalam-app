import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { fetchDailyUsage, fetchStreakData } from '../lib/queries';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';

export const StreaksScreen = () => {
    const { colors, spacing, typography, borderRadius, layout } = useTheme();
    const { session } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [streakCount, setStreakCount] = useState(0);
    const [usageToday, setUsageToday] = useState(0);
    const [historyDates, setHistoryDates] = useState<string[]>([]);

    // ... (loadStreakData remains same)
    const loadStreakData = useCallback(async () => {
        if (!session?.user) return;
        try {
            setLoading(true);
            const [streakData, todayUsage] = await Promise.all([
                fetchStreakData(session.user.id),
                fetchDailyUsage(session.user.id)
            ]);

            setStreakCount(streakData?.length || 0);
            setUsageToday(todayUsage?.sessions_used || 0);

            const dates = streakData?.map((row: any) => row.usage_date) || [];
            setHistoryDates(dates);
        } catch (error) {
            console.error('Error loading streak screen data:', error);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useFocusEffect(
        useCallback(() => {
            loadStreakData();
        }, [loadStreakData])
    );

    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const today = new Date();

    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(today.getDate() - (6 - i));
        const iso = d.toISOString().split('T')[0];
        return {
            label: days[d.getDay() === 0 ? 6 : d.getDay() - 1],
            active: historyDates.includes(iso),
            isToday: iso === today.toISOString().split('T')[0]
        };
    });

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
                    paddingBottom: layout.miniPlayerHeight + spacing.m 
                }}
            >
            <Text style={[styles.screenTitle, { color: colors.text, marginBottom: spacing.l }]}>Your Journey</Text>

            <Card style={[styles.streakCard, { paddingVertical: spacing.xxl, marginBottom: spacing.xl }]}>
                <View style={[styles.streakHeader, { marginBottom: spacing.xl }]}>
                    <Text style={[styles.streakNumber, { color: colors.primary }]}>{streakCount}</Text>
                    <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>Day Journey 🔥</Text>
                </View>

                <View style={[styles.trackerContainer, { marginBottom: spacing.xl, paddingHorizontal: spacing.m }]}>
                    {last7Days.map((day, i) => (
                        <View key={i} style={styles.dayContainer}>
                            <View style={[
                                styles.dayCircle,
                                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: spacing.s },
                                day.active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null,
                                day.isToday && !day.active ? { borderColor: colors.primary, borderStyle: 'dashed' } : null
                            ]}>
                                {day.active && <Text style={[styles.checkText, { color: colors.textInverse }]}>✓</Text>}
                            </View>
                            <Text style={[styles.dayLetter, { color: colors.textSecondary }, day.isToday && { color: colors.primary, fontWeight: 'bold' }]}>{day.label}</Text>
                        </View>
                    ))}
                </View>
                <Text style={[styles.encouragementText, { color: colors.textSecondary, paddingHorizontal: spacing.m }]}>
                    Consistency over intensity. Taking 10 minutes a day for reflection builds a resilient mind.
                </Text>
            </Card>

            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: spacing.m }]}>Stats</Text>
            <View style={[styles.statsRow, { gap: spacing.m }]}>
                <Card style={[styles.statCard, { paddingVertical: spacing.l }]}>
                    <Text style={[styles.statValue, { color: colors.primary, marginBottom: spacing.xs }]}>{usageToday}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sessions Today</Text>
                </Card>
                <Card style={[styles.statCard, { paddingVertical: spacing.l }]}>
                    <Text style={[styles.statValue, { color: colors.primary, marginBottom: spacing.xs }]}>~{streakCount * 10}m</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Time</Text>
                </Card>
            </View>

            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
    },
    screenTitle: {
        fontWeight: 'bold',
        fontSize: typography.sizes.xxl,
    },
    streakCard: {
        alignItems: 'center',
    },
    streakHeader: {
        alignItems: 'center',
    },
    streakNumber: {
        fontSize: typography.sizes.hero,
        fontWeight: 'bold',
    },
    streakLabel: {
        fontSize: 18,
    },
    trackerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    dayContainer: {
        alignItems: 'center',
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    checkText: {
        fontWeight: 'bold',
        fontSize: 12,
    },
    dayLetter: {
        fontSize: 12,
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
    }
});
