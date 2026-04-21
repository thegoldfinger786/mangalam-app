import React, { useMemo, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { AppleAuthButton, AuthButtonWrapper, GoogleAuthButton } from '../components/AuthButton';
import { Card } from '../components/Card';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { useAuth } from '../auth/AuthProvider';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

export const LoginScreen = () => {
    const { colors, spacing, typography } = useTheme();
    const { signInWithGoogle, signInWithApple, authLoading } = useAuth();
    const styles = useMemo(() => createStyles(spacing, typography), [spacing, typography]);
    const [activeProvider, setActiveProvider] = useState<'apple' | 'google' | null>(null);

    const handleGoogleLogin = async () => {
        setActiveProvider('google');
        try {
            await signInWithGoogle();
        } catch (error) {
            logger.error('Failed to start Google login', { error });
            Alert.alert('Sign-in failed', 'Something went wrong. Please try again.');
        } finally {
            setActiveProvider(null);
        }
    };

    const handleAppleLogin = async () => {
        setActiveProvider('apple');
        try {
            await signInWithApple();
        } catch (error) {
            logger.error('Failed to start Apple login', { error });
            Alert.alert('Sign-in failed', 'Something went wrong. Please try again.');
        } finally {
            setActiveProvider(null);
        }
    };

    return (
        <ScreenContainer edges={['top', 'bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.xl }]}>
                <View style={styles.brandingHeader}>
                    <View style={[styles.imageContainer, { borderColor: colors.border, shadowColor: colors.primary }]}>
                        <Image
                            source={require('../../assets/images/Mangalam-cover.jpeg')}
                            style={styles.brandImage}
                            resizeMode="cover"
                        />
                    </View>
                    <Text style={[styles.title, { color: colors.text, marginTop: spacing.m }]}>Mangalam</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Ancient Wisdom for Modern Life</Text>
                </View>

                <Card style={[styles.authCard, { backgroundColor: colors.surface, marginTop: spacing.xl }]}>
                    <Text style={[styles.instructionText, { color: colors.text, marginBottom: spacing.l }]}>
                        Sign in to get started
                    </Text>

                    <AuthButtonWrapper>
                        <AppleAuthButton
                            onPress={handleAppleLogin}
                            disabled={authLoading || activeProvider === 'google'}
                            loading={activeProvider === 'apple' || (authLoading && activeProvider !== 'google')}
                        />
                        <GoogleAuthButton
                            onPress={handleGoogleLogin}
                            disabled={authLoading || activeProvider === 'apple'}
                            loading={activeProvider === 'google'}
                        />
                    </AuthButtonWrapper>

                    <Text style={[styles.privacyNote, { color: colors.textSecondary, marginTop: spacing.xl }]}>
                        Mangalam is a quiet space for reflection.{'\n'}We do not collect any of your personal data.
                    </Text>
                </Card>

                <View style={[styles.footer, { paddingVertical: spacing.xl }]}>
                    <Text style={[styles.footerText, { color: colors.textTertiary || colors.textSecondary }]}>
                        By signing in, you agree to our Terms of Service.
                    </Text>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography'],
) => StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    brandingHeader: {
        alignItems: 'center',
    },
    imageContainer: {
        width: 120,
        height: 120,
        borderRadius: 20,
        borderWidth: 2,
        overflow: 'hidden',
        elevation: 8,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    brandImage: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontFamily: typography.fontFamilies.semiBold,
        fontSize: 32,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontFamily: typography.fontFamilies.regular,
        fontSize: 16,
        textAlign: 'center',
        opacity: 0.8,
    },
    authCard: {
        padding: spacing.l,
        elevation: 4,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    instructionText: {
        fontFamily: typography.fontFamilies.semiBold,
        fontSize: 20,
        textAlign: 'center',
    },
    privacyNote: {
        fontFamily: typography.fontFamilies.regular,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        fontFamily: typography.fontFamilies.regular,
        fontSize: 12,
        textAlign: 'center',
    },
});
