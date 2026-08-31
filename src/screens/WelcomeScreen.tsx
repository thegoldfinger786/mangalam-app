import React, { useState, useMemo } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { supabase } from '../lib/supabaseClient';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';

export const WelcomeScreen = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const { setUserName, setHasCompletedOnboarding, session } = useAppStore();
    const styles = useMemo(() => createStyles(colors, spacing, typography, borderRadius), [colors, spacing, typography, borderRadius]);
    const [name, setName] = useState(session?.user?.user_metadata?.full_name || '');

    const handleStart = async () => {
        const displayName = name.trim();
        if (!displayName) return;

        const userId = useAppStore.getState().session?.user?.id;
        if (!userId) {
            Alert.alert('Couldn’t save', 'We couldn’t save your name just now. Please try again.');
            return;
        }

        const { error } = await supabase.from('profiles').upsert({
            id: userId,
            display_name: displayName,
            updated_at: new Date().toISOString(),
        });

        if (error) {
            Alert.alert('Couldn’t save', 'We couldn’t save your name just now. Please try again.');
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
                            <AppText style={[styles.appName, { color: colors.text, marginBottom: spacing.s }]} maxFontSizeMultiplier={1.2}>Mangalam</AppText>
                            <AppText variant="body" style={[styles.tagline, { color: colors.textSecondary, paddingHorizontal: spacing.l }]}>
                                A calm space to pause, listen and reflect — a few minutes at a time.
                            </AppText>
                        </View>

                        {/* Input Area */}
                        <View style={styles.inputContainer}>
                            <AppText variant="body" style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: spacing.m }]}>What should we call you?</AppText>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.m, padding: spacing.l, color: colors.text, marginBottom: spacing.xl }]}
                                placeholder="Your name"
                                placeholderTextColor={colors.textSecondary}
                                value={name}
                                onChangeText={setName}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleStart}
                            />
                            <Button
                                title="Begin"
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

const createStyles = (
    colors: ReturnType<typeof useTheme>['colors'],
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography'],
    borderRadius: ReturnType<typeof useTheme>['borderRadius']
) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: spacing.xl,
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
        backgroundColor: colors.primaryLight,
        marginBottom: spacing.l,
        opacity: 0.8,
    },
    // The one giant word on the first screen — a deliberate hero size, not a role.
    appName: {
        fontFamily: typography.fontFamilies.semiBold,
        fontSize: typography.sizes.xxxl,
        lineHeight: typography.sizes.xxxl,
        color: colors.text,
        marginBottom: spacing.s,
        textAlign: 'center',
    },
    tagline: {
        color: colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: spacing.l,
    },
    inputContainer: {
        flex: 2,
        justifyContent: 'center',
    },
    inputLabel: {
        fontFamily: typography.fontFamilies.medium,
        color: colors.textSecondary,
        marginBottom: spacing.m,
        textAlign: 'center',
    },
    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.m,
        padding: spacing.l,
        fontFamily: typography.fontFamilies.medium,
        fontSize: typography.sizes.l,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    startButton: {
        width: '100%',
    },
    disabledButton: {
        opacity: 0.5,
    }
});
