import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import Animated, {
    useDerivedValue,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withDelay,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

interface WeeklyStreakProps {
    /**
     * ISO `YYYY-MM-DD` dates (UTC, matching `user_daily_usage.usage_date`) on
     * which the listener spent any time in Mangalam. The widget shows the last
     * seven calendar days and marks each one that appears in this list — a real
     * per-day record, not an inferred run. Wherever weekly rhythm is shown it
     * uses this same component and the same data, so the result is identical.
     */
    activeDates: string[];
}

const toIsoDay = (d: Date) => d.toISOString().split('T')[0];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const DayDot = ({ isActive, isToday, color, delay }: { isActive: boolean; isToday: boolean; color: string; delay: number; }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    useDerivedValue(() => {
        scale.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 100 }));
        opacity.value = withDelay(delay, withSpring(1));
    }, [delay, isActive, isToday]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={animatedStyle}>
            {isActive ? (
                <Ionicons name="checkmark-circle" size={24} color={color} />
            ) : isToday ? (
                <Ionicons name="ellipse" size={24} color={color} />
            ) : (
                <Ionicons name="ellipse-outline" size={24} color={color} />
            )}
        </Animated.View>
    );
};

export const WeeklyStreak = ({ activeDates }: WeeklyStreakProps) => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);

    const active = useMemo(() => new Set(activeDates), [activeDates]);

    const week = useMemo(() => {
        const today = new Date();
        const todayIso = toIsoDay(today);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(today.getDate() - (6 - i));
            const iso = toIsoDay(d);
            return {
                iso,
                label: DAY_LETTERS[d.getDay()],
                isActive: active.has(iso),
                isToday: iso === todayIso,
            };
        });
    }, [active]);

    const dayCount = week.filter((d) => d.isActive).length;

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.xl, padding: spacing.m }]}>
            <View style={styles.headerRow}>
                <AppText variant="subheading" style={{ color: colors.text }}>
                    Last 7 days
                </AppText>
                <AppText variant="body" style={{ color: colors.textSecondary, fontFamily: typography.fontFamilies.medium }}>
                    {dayCount === 1 ? '1 day' : `${dayCount} days`}
                </AppText>
            </View>

            <View style={styles.daysRow}>
                {week.map((item, i) => {
                    const iconColor = item.isActive ? colors.secondary : item.isToday ? colors.primary : colors.border;
                    return (
                        <View
                            key={item.iso}
                            style={[
                                styles.dayColumn,
                                { paddingVertical: spacing.s, borderRadius: borderRadius.m },
                                item.isToday && { backgroundColor: colors.primary + '15' },
                            ]}
                        >
                            <View style={styles.iconContainer}>
                                <DayDot isActive={item.isActive} isToday={item.isToday} color={iconColor} delay={300 + i * 100} />
                            </View>
                            <AppText variant="label" style={[
                                { color: colors.textSecondary },
                                item.isActive && { color: colors.secondary },
                                item.isToday && { color: colors.primary },
                            ]}>
                                {item.label}
                            </AppText>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const createStyles = (spacing: ReturnType<typeof useTheme>['spacing']) => StyleSheet.create({
    container: {
        marginBottom: spacing.l,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayColumn: {
        alignItems: 'center',
        paddingHorizontal: spacing.xs,
    },
    iconContainer: {
        marginBottom: spacing.xs,
    },
});
