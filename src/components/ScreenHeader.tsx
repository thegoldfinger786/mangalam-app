import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';

interface ScreenHeaderProps {
    title: string;
    /** Defaults to `navigation.goBack()`. Pass `null` to hide the back control. */
    onBack?: (() => void) | null;
    /** Optional trailing control (icon button, etc.). */
    right?: ReactNode;
}

/**
 * The one header for pushed stack screens: back chevron on the left, centred
 * title, optional trailing control. `chevron-back` here is deliberate — a
 * downward chevron is reserved for modals (Play). See docs/NAVIGATION_MODEL.md.
 */
export const ScreenHeader = ({ title, onBack, right }: ScreenHeaderProps) => {
    const navigation = useNavigation();
    const { colors, spacing, typography } = useTheme();
    const styles = useMemo(() => createStyles(spacing, typography), [spacing, typography]);

    const showBack = onBack !== null;
    const handleBack = onBack || (() => navigation.goBack());

    return (
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.side}>
                {showBack && (
                    <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={8} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={26} color={colors.text} />
                    </TouchableOpacity>
                )}
            </View>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
            </Text>
            <View style={[styles.side, styles.rightSide]}>{right}</View>
        </View>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography'],
) =>
    StyleSheet.create({
        header: {
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.m,
            borderBottomWidth: 1,
        },
        side: {
            width: 40,
            justifyContent: 'center',
        },
        rightSide: {
            alignItems: 'flex-end',
        },
        backButton: {
            width: 40,
            height: 40,
            justifyContent: 'center',
            alignItems: 'center',
            marginLeft: -spacing.xs,
        },
        title: {
            flex: 1,
            textAlign: 'center',
            fontSize: typography.sizes.l,
            fontWeight: '700',
        },
    });
