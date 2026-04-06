import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    useDerivedValue,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withSequence,
    withDelay
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { RollingNumber } from './RollingNumber';

interface WeeklyStreakProps {
    currentStreak: number;
    sessionsToday: number;
}

const AnimatedIcon = ({ isCompleted, isToday, color, delay }: { isCompleted: boolean; isToday: boolean; color: string; delay: number; }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    useDerivedValue(() => {
        scale.value = withDelay(
            delay,
            withSpring(1, { damping: 10, stiffness: 100 })
        );
        opacity.value = withDelay(
            delay,
            withSpring(1)
        );
    }, [delay, isCompleted, isToday]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={animatedStyle}>
            {isCompleted ? (
                <Ionicons name="checkmark-circle" size={24} color={color} />
            ) : isToday ? (
                <Ionicons name="ellipse" size={24} color={color} />
            ) : (
                <Ionicons name="ellipse-outline" size={24} color={color} />
            )}
        </Animated.View>
    );
};

export const WeeklyStreak = ({ currentStreak, sessionsToday }: WeeklyStreakProps) => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    let todayIndex = new Date().getDay() - 1;
    if (todayIndex < 0) todayIndex = 6;

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

    const streakTitleScale = useSharedValue(1);

    useDerivedValue(() => {
        if (sessionsToday > 0) {
            streakTitleScale.value = withSequence(
                withSpring(1.2),
                withSpring(1)
            );
        }
    }, [sessionsToday]);

    const streakTitleAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: streakTitleScale.value }]
    }));

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.xl, padding: spacing.l }]}>
            <View style={styles.headerRow}>
                <Animated.Text style={[
                    styles.title, 
                    streakTitleAnimatedStyle,
                    { 
                        color: colors.text, 
                        fontFamily: typography.fontFamilies.semiBold, 
                        fontSize: typography.sizes.l
                    }
                ]}>
                    This Week
                </Animated.Text>
                <View style={styles.scoreBadge}>
                    <Ionicons name="flame" size={20} color={colors.primary} style={{ marginRight: 4 }} />
                    <RollingNumber value={weekCompleted} fontSize={typography.sizes.l} color={colors.primary} />
                    <Text style={[styles.scoreText, { color: colors.textSecondary, fontFamily: typography.fontFamilies.semiBold, fontSize: typography.sizes.m }]}>/7</Text>
                </View>
            </View>

            <View style={styles.daysRow}>
                {history.map((item, i) => {
                    const isCompleted = item.status === 'completed';
                    const isToday = item.status === 'today';
                    const iconColor = isCompleted ? colors.secondary : isToday ? colors.primary : colors.border;

                    return (
                        <View
                            key={i}
                            style={[
                                styles.dayColumn,
                                { paddingVertical: spacing.s, borderRadius: borderRadius.m },
                                isToday && { backgroundColor: colors.primary + '15' }
                            ]}
                        >
                            <View style={styles.iconContainer}>
                                <AnimatedIcon 
                                    isCompleted={isCompleted} 
                                    isToday={isToday} 
                                    color={iconColor} 
                                    delay={300 + (i * 100)} 
                                />
                            </View>
                            <Text style={[
                                styles.dayText,
                                { color: colors.textSecondary, fontFamily: typography.fontFamilies.medium },
                                isCompleted && { color: colors.secondary },
                                isToday && { color: colors.primary }
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
        marginBottom: 32, // theme.spacing.xl
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24, // theme.spacing.l
    },
    title: {
    },
    scoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scoreText: {
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayColumn: {
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    iconContainer: {
        marginBottom: 4, // theme.spacing.xs
    },
    dayText: {
        fontSize: 12,
    },
});
