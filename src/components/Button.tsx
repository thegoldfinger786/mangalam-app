import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { theme } from '../theme';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    disabled?: boolean;
}

export const Button = ({ title, onPress, variant = 'primary', style, textStyle, disabled }: ButtonProps) => {
    const isPrimary = variant === 'primary';
    const isOutline = variant === 'outline';

    return (
        <TouchableOpacity
            style={[
                styles.button,
                isPrimary && styles.primaryButton,
                isOutline && styles.outlineButton,
                !isPrimary && !isOutline && styles.secondaryButton,
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
                    isPrimary && styles.primaryText,
                    isOutline && styles.outlineText,
                    !isPrimary && !isOutline && styles.secondaryText,
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
        paddingVertical: theme.spacing.m,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: theme.borderRadius.round,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: theme.colors.primary,
    },
    secondaryButton: {
        backgroundColor: theme.colors.surfaceSecondary,
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    text: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.m,
    },
    primaryText: {
        color: theme.colors.textInverse,
    },
    secondaryText: {
        color: theme.colors.primary,
    },
    outlineText: {
        color: theme.colors.textSecondary,
    },
    disabledButton: {
        opacity: 0.5,
    },
});
