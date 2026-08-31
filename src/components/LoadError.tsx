import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface LoadErrorProps {
    /** Called when the listener taps "Try again". */
    onRetry: () => void;
    /** Optional override for the calm one-line message. */
    message?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * Shared "couldn't load, try again" state. Used wherever a screen fetches
 * data on open — replaces the old silent empty/zeroed render on failure.
 * Deliberately quiet: no red, no alarm, matching the Mangalam voice.
 */
export const LoadError = ({ onRetry, message, style }: LoadErrorProps) => {
    const { colors, spacing } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);

    return (
        <View style={[styles.container, style]}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.textTertiary} />
            <AppText variant="body" style={[styles.message, { color: colors.textSecondary }]}>
                {message ?? "We couldn't load this just now."}
            </AppText>
            <Button title="Try again" variant="secondary" onPress={onRetry} style={styles.button} />
        </View>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
) =>
    StyleSheet.create({
        container: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
        },
        message: {
            textAlign: 'center',
            marginTop: spacing.m,
            marginBottom: spacing.l,
        },
        button: {
            minWidth: 160,
        },
    });
