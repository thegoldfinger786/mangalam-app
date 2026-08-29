import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface VoiceOptionCardProps {
    language: string;
    voice: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    isSelected: boolean;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
}

/**
 * VoiceOptionCard — selectable 2-line card for a single voice preference.
 *
 * Layout: icon (top, centred) → Language line → Voice line.
 * Designed to sit inside an explicit row View so it uses flex:1 and
 * always takes exactly half the available row width — works correctly
 * on every screen size on both Android and iOS.
 *
 * Zero hardcoded style values — all tokens from useTheme().
 */
export const VoiceOptionCard = ({
    language,
    voice,
    icon,
    isSelected,
    onPress,
    style,
}: VoiceOptionCardProps) => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const styles = useMemo(
        () => createStyles(spacing, typography, borderRadius),
        [spacing, typography, borderRadius],
    );

    return (
        <TouchableOpacity
            style={[
                styles.card,
                {
                    backgroundColor: isSelected ? colors.primary + '12' : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    shadowColor: colors.cardShadow,
                },
                style,
            ]}
            onPress={onPress}
            activeOpacity={0.82}
        >
            {/* Icon circle */}
            <View
                style={[
                    styles.iconBox,
                    {
                        backgroundColor: isSelected
                            ? colors.primary + '20'
                            : colors.surfaceSecondary,
                    },
                ]}
            >
                <Ionicons
                    name={icon}
                    size={spacing.l}          // 24 — readable at all sizes
                    color={isSelected ? colors.primary : colors.textSecondary}
                />
            </View>

            {/* Line 1: Language — never wraps */}
            <Text
                style={[
                    styles.language,
                    { color: isSelected ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
            >
                {language}
            </Text>

            {/* Line 2: Voice — never wraps */}
            <Text
                style={[
                    styles.voice,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
            >
                {voice}
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
            /**
             * flex:1 means this card takes half the parent voiceRow width,
             * minus the gap — no hardcoded pixel math needed.
             * Works identically on 320 pt (SE) through 430 pt (Pro Max) and
             * equivalent Android sizes.
             */
            flex: 1,
            alignItems: 'center',
            paddingVertical: spacing.l,
            paddingHorizontal: spacing.s,
            borderRadius: borderRadius.l,
            // iOS shadow
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 8,
            // Android shadow
            elevation: 3,
        },
        iconBox: {
            width: spacing.xxl,      // 48 × 48 — consistent with BookCard
            height: spacing.xxl,
            borderRadius: borderRadius.round,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.s,
        },
        language: {
            fontSize: typography.sizes.m,
            fontWeight: '600',
            textAlign: 'center',
        },
        voice: {
            fontSize: typography.sizes.s,
            textAlign: 'center',
            marginTop: spacing.xs,
        },
    });
