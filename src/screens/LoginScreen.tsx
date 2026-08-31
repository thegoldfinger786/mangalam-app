import React, { useMemo, useState } from 'react';
import {
    Alert,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { AppText } from '../components/AppText';
import { AppleAuthButton, AuthButtonWrapper, GoogleAuthButton } from '../components/AuthButton';
import { Card } from '../components/Card';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { useAuth } from '../auth/AuthProvider';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

const TERMS_URL = 'https://www.mangalamapp.com/terms';
const PRIVACY_URL = 'https://www.mangalamapp.com/privacy';

export const LoginScreen = () => {
    const { colors, spacing } = useTheme();
    const { signInWithGoogle, signInWithApple, authLoading } = useAuth();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
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
                    <AppText variant="display" style={[styles.title, { color: colors.text, marginTop: spacing.m }]}>Mangalam</AppText>
                    <AppText variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>Ancient Wisdom for Modern Life</AppText>
                </View>

                <Card style={[styles.authCard, { backgroundColor: colors.surface, marginTop: spacing.xl }]}>
                    <AppText variant="heading" style={[styles.instructionText, { color: colors.text, marginBottom: spacing.l }]}>
                        Sign in to get started
                    </AppText>

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

                    <AppText variant="caption" style={[styles.privacyNote, { color: colors.textSecondary, marginTop: spacing.xl }]}>
                        Mangalam is a quiet space for reflection.{'\n'}No ads, and we never sell your data.
                    </AppText>
                </Card>

                <View style={[styles.footer, { paddingVertical: spacing.xl }]}>
                    <AppText variant="caption" style={[styles.footerText, { color: colors.textTertiary || colors.textSecondary }]}>
                        By continuing you agree to our{' '}
                        <AppText
                            variant="caption"
                            style={{ color: colors.primary }}
                            onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
                        >
                            Terms of Service
                        </AppText>
                        {' '}and{' '}
                        <AppText
                            variant="caption"
                            style={{ color: colors.primary }}
                            onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
                        >
                            Privacy Policy
                        </AppText>
                        .
                    </AppText>
                </View>
            </ScrollView>
        </ScreenContainer>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
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
        letterSpacing: 0.5,
    },
    subtitle: {
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
        textAlign: 'center',
    },
    privacyNote: {
        textAlign: 'center',
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        textAlign: 'center',
    },
});
