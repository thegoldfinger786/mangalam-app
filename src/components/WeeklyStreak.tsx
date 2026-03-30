import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

interface WeeklyStreakProps {
    currentStreak: number;
    sessionsToday: number;
}

export const WeeklyStreak = ({ currentStreak, sessionsToday }: WeeklyStreakProps) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // 0 = Monday, 6 = Sunday for our UI logic
    let todayIndex = new Date().getDay() - 1;
    if (todayIndex < 0) todayIndex = 6;

    // Calculate how many days we have completed this week (0-7)
    // This is a naive calculation based on the streak for the UI mockup
    let weekCompleted = 0;

    const history = days.map((day, index) => {
        let status: 'completed' | 'today' | 'upcoming' | 'missed' = 'upcoming';

        if (index === todayIndex) {
            if (sessionsToday > 0) {
                status = 'completed';
                weekCompleted++;
            } else {
                status = 'today';
            }
        } else if (index < todayIndex) {
            // If the day is in the past, and it falls within the current streak length
            // For instance, if today is Wed (2) and streak is 3 (Mon, Tue, Wed)
            const relativeDaysAgo = todayIndex - index;
            const isWithinStreak = relativeDaysAgo <= (currentStreak - (sessionsToday > 0 ? 1 : 0));

            if (isWithinStreak) {
                status = 'completed';
                weekCompleted++;
            } else {
                status = 'missed';
            }
        }

        return { day, status };
    });

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>This Week</Text>
                <View style={styles.scoreBadge}>
                    <Ionicons name="book-outline" size={16} color={theme.colors.primary} />
                    <Text style={styles.scoreText}> {weekCompleted}/7</Text>
                </View>
            </View>

            <View style={styles.daysRow}>
                {history.map((item, i) => {
                    const isCompleted = item.status === 'completed';
                    const isToday = item.status === 'today';

                    return (
                        <View
                            key={i}
                            style={[
                                styles.dayColumn,
                                isToday && styles.dayColumnToday
                            ]}
                        >
                            <View style={styles.iconContainer}>
                                {isCompleted ? (
                                    <Ionicons name="checkmark-circle-outline" size={24} color={theme.colors.secondary} />
                                ) : isToday ? (
                                    <Ionicons name="ellipse-outline" size={24} color={theme.colors.primary} />
                                ) : (
                                    <Ionicons name="ellipse-outline" size={24} color={theme.colors.border} />
                                )}
                            </View>
                            <Text style={[
                                styles.dayText,
                                isCompleted && styles.dayTextCompleted,
                                isToday && styles.dayTextToday
                            ]}>
                                {item.day}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.surfaceSecondary,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.l,
        marginBottom: theme.spacing.xl,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.l,
    },
    title: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.text,
    },
    scoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scoreText: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayColumn: {
        alignItems: 'center',
        paddingVertical: theme.spacing.s,
        paddingHorizontal: 4,
        borderRadius: theme.borderRadius.m,
    },
    dayColumnToday: {
        backgroundColor: theme.colors.primaryLight + '50', // translucent orange
    },
    iconContainer: {
        marginBottom: theme.spacing.xs,
    },
    dayText: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    dayTextCompleted: {
        color: theme.colors.secondary,
    },
    dayTextToday: {
        color: theme.colors.primary,
    }
});
