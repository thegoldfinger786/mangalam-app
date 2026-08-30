import React, { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';

interface VerseListRowProps {
    /** Shown in the leading round badge — usually the verse number. */
    badge: string | number;
    title: string;
    /** Secondary line, e.g. "Verse 12" or "Bhagavad Gita · Chapter 2, Verse 47". */
    subtitle: string;
    /** Applies the subtle "already engaged" tint (completed verse, etc.). */
    highlighted?: boolean;
    onPress: () => void;
    /** Trailing accessory — a checkmark, a remove button, a chevron. */
    right?: ReactNode;
}

/**
 * The single verse row used wherever the app lists verses (Library chapter
 * list, Library search results, Journey bookmarks). One place to keep the
 * badge + two-line layout consistent.
 */
export const VerseListRow = ({ badge, title, subtitle, highlighted, onPress, right }: VerseListRowProps) => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const styles = useMemo(() => createStyles(spacing, typography, borderRadius), [spacing, typography, borderRadius]);

    return (
        <TouchableOpacity
            style={[
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.cardShadow },
                highlighted && { borderColor: colors.primary + '40', backgroundColor: colors.primary + '05' },
            ]}
            onPress={onPress}
        >
            <View
                style={[
                    styles.badge,
                    { backgroundColor: colors.surfaceSecondary },
                    highlighted && { backgroundColor: colors.primary },
                ]}
            >
                <Text style={[styles.badgeText, { color: colors.primary }, highlighted && { color: colors.textInverse }]}>
                    {badge}
                </Text>
            </View>

            <View style={styles.info}>
                <Text
                    style={[styles.title, { color: colors.textSecondary }, highlighted && { color: colors.text }]}
                    numberOfLines={2}
                >
                    {title}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            </View>

            {right ? <View style={styles.right}>{right}</View> : null}
        </TouchableOpacity>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography'],
    borderRadius: ReturnType<typeof useTheme>['borderRadius'],
) =>
    StyleSheet.create({
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.m,
            borderRadius: borderRadius.m,
            marginBottom: spacing.s,
            borderWidth: 1,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 1,
        },
        badge: {
            width: spacing.xl + spacing.s,
            height: spacing.xl + spacing.s,
            borderRadius: borderRadius.round,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.m,
        },
        badgeText: {
            fontSize: typography.sizes.m,
            fontWeight: '600',
        },
        info: {
            flex: 1,
        },
        title: {
            fontSize: typography.sizes.m,
        },
        subtitle: {
            fontSize: typography.sizes.s,
            marginTop: spacing.xs,
        },
        right: {
            marginLeft: spacing.s,
        },
    });
