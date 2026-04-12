import React, { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { Button } from '../components/Button';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { theme, useTheme } from '../theme';

export const WelcomeScreen = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const { setUserName, setHasCompletedOnboarding, session } = useAppStore();
    const [name, setName] = useState(session?.user?.user_metadata?.full_name || '');

    const handleStart = async () => {
        const displayName = name.trim();
        if (!displayName) return;

        const userId = useAppStore.getState().session?.user?.id;
        if (!userId) {
            console.log('Alert triggered');
            Alert.alert('Error', 'Unable to save your name right now.');
            return;
        }

        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            display_name: displayName,
            updated_at: new Date().toISOString(),
        });

        if (error) {
            console.log('Alert triggered');
            Alert.alert('Error', error.message);
            return;
        }

        setUserName(displayName);
        setHasCompletedOnboarding(true);
    };

    return (
        <ScreenContainer edges={['top', 'bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={[styles.content, { padding: spacing.xl }]}>
                        <View style={styles.headerSpacer} />

                        {/* Branding/Logo Area */}
                        <View style={styles.brandingContainer}>
                            <View style={[styles.sunCircle, { backgroundColor: colors.primaryLight, marginBottom: spacing.l }]} />
                            <Text style={[styles.appName, { color: colors.text, marginBottom: spacing.s }]}>Mangalam</Text>
                            <Text style={[styles.tagline, { color: colors.textSecondary, paddingHorizontal: spacing.l }]}>  </Text>
                        </View>

                        {/* Input Area */}
                        <View style={styles.inputContainer}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: spacing.m }]}>    </Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.m, padding: spacing.l, color: colors.text, marginBottom: spacing.xl }]}
                                placeholder="Enter your name"
                                placeholderTextColor={colors.textSecondary}
                                value={name}
                                onChangeText={setName}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleStart}
                            />
                            <Button
                                title="Begin Your Journey"
                                onPress={handleStart}
                                style={[styles.startButton, !name.trim() && styles.disabledButton]}
                            />
                        </View>

                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: theme.spacing.xl,
        justifyContent: 'space-between',
    },
    headerSpacer: {
        flex: 1,
    },
    brandingContainer: {
        flex: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sunCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.colors.primaryLight,
        marginBottom: theme.spacing.l,
        opacity: 0.8,
    },
    appName: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.xxxl,
        color: theme.colors.text,
        marginBottom: theme.spacing.s,
        textAlign: 'center',
    },
    tagline: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: theme.typography.lineHeights.l,
        paddingHorizontal: theme.spacing.l,
    },
    inputContainer: {
        flex: 2,
        justifyContent: 'center',
    },
    inputLabel: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.m,
        textAlign: 'center',
    },
    input: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.m,
        padding: theme.spacing.l,
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: theme.spacing.xl,
    },
    startButton: {
        width: '100%',
    },
    disabledButton: {
        opacity: 0.5,
    }
});
