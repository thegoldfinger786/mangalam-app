import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { fetchDailyUsage, fetchStreakData } from '../lib/queries';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

export const StreaksScreen = () => {
    const { session } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [streakCount, setStreakCount] = useState(0);
    const [usageToday, setUsageToday] = useState(0);
    const [historyDates, setHistoryDates] = useState<string[]>([]);

    const loadStreakData = useCallback(async () => {
        if (!session?.user) return;
        try {
            setLoading(true);
            const [streakData, todayUsage] = await Promise.all([
                fetchStreakData(session.user.id),
                fetchDailyUsage(session.user.id)
            ]);

            // Simple streak count for MVP
            setStreakCount(streakData?.length || 0);
            setUsageToday(todayUsage?.sessions_used || 0);

            // Map dates for the visual tracker
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

    // Visual tracker logic (7 days)
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const today = new Date();

    // Get last 7 days starting from today backwards to Monday
    // This is a simplified 7-day view
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
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Your Journey</Text>

            <Card style={styles.streakCard}>
                <View style={styles.streakHeader}>
                    <Text style={styles.streakNumber}>{streakCount}</Text>
                    <Text style={styles.streakLabel}>Day Journey 🔥</Text>
                </View>

                <View style={styles.trackerContainer}>
                    {last7Days.map((day, i) => (
                        <View key={i} style={styles.dayContainer}>
                            <View style={[
                                styles.dayCircle,
                                day.active ? styles.dayCircleActive : null,
                                day.isToday && !day.active ? styles.dayCircleToday : null
                            ]}>
                                {day.active && <Text style={styles.checkText}>✓</Text>}
                            </View>
                            <Text style={[styles.dayLetter, day.isToday && styles.dayLetterToday]}>{day.label}</Text>
                        </View>
                    ))}
                </View>
                <Text style={styles.encouragementText}>
                    Consistency over intensity. Taking 10 minutes a day for reflection builds a resilient mind.
                </Text>
            </Card>

            <Text style={styles.sectionTitle}>Stats</Text>
            <View style={styles.statsRow}>
                <Card style={styles.statCard}>
                    <Text style={styles.statValue}>{usageToday}</Text>
                    <Text style={styles.statLabel}>Sessions Today</Text>
                </Card>
                <Card style={styles.statCard}>
                    <Text style={styles.statValue}>~{streakCount * 10}m</Text>
                    <Text style={styles.statLabel}>Total Time</Text>
                </Card>
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: theme.spacing.l,
        paddingTop: theme.spacing.xl * 2,
        paddingBottom: theme.spacing.xl,
    },
    screenTitle: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.xl,
        color: theme.colors.text,
        marginBottom: theme.spacing.l,
    },
    streakCard: {
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl,
        marginBottom: theme.spacing.xl,
    },
    streakHeader: {
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
    },
    streakNumber: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: 72,
        color: theme.colors.primary,
        marginBottom: -10,
    },
    streakLabel: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.textSecondary,
    },
    trackerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: theme.spacing.xl,
        paddingHorizontal: theme.spacing.m,
    },
    dayContainer: {
        alignItems: 'center',
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: theme.colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.s,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    dayCircleActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    dayCircleToday: {
        borderColor: theme.colors.primary,
        borderStyle: 'dashed',
    },
    checkText: {
        color: theme.colors.textInverse,
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.s,
    },
    dayLetter: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.s,
        color: theme.colors.textSecondary,
    },
    dayLetterToday: {
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamilies.semiBold,
    },
    encouragementText: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.m,
        lineHeight: theme.typography.lineHeights.m,
    },
    sectionTitle: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.m,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.m,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: theme.spacing.l,
    },
    statValue: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.xxl,
        color: theme.colors.primary,
        marginBottom: theme.spacing.xs,
    },
    statLabel: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.s,
        color: theme.colors.textSecondary,
    }
});
