import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

export const WelcomeScreen = () => {
    const { setUserName, setHasCompletedOnboarding } = useAppStore();
    const [name, setName] = useState('');

    const handleStart = () => {
        if (name.trim()) {
            setUserName(name.trim());
            setHasCompletedOnboarding(true);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.content}>
                        <View style={styles.headerSpacer} />

                        {/* Branding/Logo Area */}
                        <View style={styles.brandingContainer}>
                            <View style={styles.sunCircle} />
                            <Text style={styles.appName}>Daily Shlokya</Text>
                            <Text style={styles.tagline}>A warm, reflective space for your daily spiritual habit.</Text>
                        </View>

                        {/* Input Area */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>What should we call you?</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your name"
                                placeholderTextColor={theme.colors.textSecondary}
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
        </SafeAreaView>
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
