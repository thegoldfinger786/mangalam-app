import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { ReactNode, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';
import { AppText } from './AppText';

interface ScreenHeaderProps {
    title: string;
    /** Defaults to `navigation.goBack()`. Pass `null` to hide the dismiss control. */
    onBack?: (() => void) | null;
    /**
     * `'push'` (default) → back chevron, for pushed stack screens.
     * `'modal'` → downward chevron, for slide-up modals. See docs/NAVIGATION_MODEL.md.
     */
    variant?: 'push' | 'modal';
    /** Optional trailing control (icon button, etc.). */
    right?: ReactNode;
}

/**
 * The one header for pushed stack screens and simple modals: a dismiss chevron
 * on the left, centred title, optional trailing control. `chevron-back` for
 * pushes, `chevron-down` for modals. See docs/NAVIGATION_MODEL.md.
 */
export const ScreenHeader = ({ title, onBack, variant = 'push', right }: ScreenHeaderProps) => {
    const navigation = useNavigation();
    const { colors, spacing } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);

    const showBack = onBack !== null;
    const handleBack = onBack || (() => navigation.goBack());

    return (
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.side}>
                {showBack && (
                    <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={8} accessibilityLabel={variant === 'modal' ? 'Close' : 'Back'}>
                        <Ionicons name={variant === 'modal' ? 'chevron-down' : 'chevron-back'} size={26} color={colors.text} />
                    </TouchableOpacity>
                )}
            </View>
            <AppText variant="subheading" style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
            </AppText>
            <View style={[styles.side, styles.rightSide]}>{right}</View>
        </View>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
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
        },
    });
