import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface BookCardProps {
    icon: React.ReactNode;
    title: string;
    onPress: () => void;
    accentColor?: string;
    isActive?: boolean;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * BookCard — shared 2-column grid card.
 * Visually matches the HomeScreen "Explore Paths" exploreItem cards exactly.
 * All spacing, radius, color, and typography values come from theme tokens.
 */
export const BookCard = ({
    icon,
    title,
    onPress,
    accentColor,
    isActive = false,
    disabled = false,
    style,
}: BookCardProps) => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const styles = useMemo(
        () => createStyles(spacing, typography, borderRadius),
        [spacing, typography, borderRadius],
    );

    const resolvedAccent = accentColor ?? colors.primary;

    return (
        <TouchableOpacity
            style={[
                styles.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: isActive ? resolvedAccent : colors.border,
                    borderWidth: isActive ? 2 : 1,
                    shadowColor: colors.cardShadow,
                },
                style,
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.85}
        >
            <View style={[styles.iconBox, { backgroundColor: resolvedAccent + '15' }]}>
                {icon}
            </View>
            <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={2}
                textBreakStrategy="simple"
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography'],
    borderRadius: ReturnType<typeof useTheme>['borderRadius'],
) =>
    StyleSheet.create({
        card: {
            // flex:1 lets the FlatList column wrapper size each card equally
            flex: 1,
            marginBottom: spacing.m,
            padding: spacing.xl,
            borderRadius: borderRadius.l,
            alignItems: 'center',
            // iOS shadow
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 8,
            // Android shadow
            elevation: 3,
        },
        iconBox: {
            // Match HomeScreen exploreIconBox: 64×64 circle
            width: spacing.xxxl,
            height: spacing.xxxl,
            borderRadius: borderRadius.round,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.m,
        },
        title: {
            fontSize: typography.sizes.s,
            textAlign: 'center',
            fontWeight: '500',
        },
    });
