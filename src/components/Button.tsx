import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    disabled?: boolean;
}

export const Button = ({ title, onPress, variant = 'primary', style, textStyle, disabled }: ButtonProps) => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const isPrimary = variant === 'primary';
    const isOutline = variant === 'outline';

    return (
        <TouchableOpacity
            style={[
                styles.button,
                {
                    paddingVertical: spacing.m,
                    paddingHorizontal: spacing.xl,
                    borderRadius: borderRadius.round,
                },
                isPrimary && { backgroundColor: colors.primary },
                isOutline && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
                !isPrimary && !isOutline && { backgroundColor: colors.surfaceSecondary },
                disabled && styles.disabledButton,
                style
            ]}
            onPress={onPress}
            activeOpacity={0.8}
            disabled={disabled}
        >
            <Text
                style={[
                    styles.text,
                    {
                        fontFamily: typography.fontFamilies.medium,
                        fontSize: typography.sizes.m,
                    },
                    isPrimary && { color: colors.textInverse },
                    isOutline && { color: colors.textSecondary },
                    !isPrimary && !isOutline && { color: colors.primary },
                    textStyle
                ]}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        // base text styles
    },
    disabledButton: {
        opacity: 0.5,
    },
});
