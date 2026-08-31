import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { signInWithPassword, signOut, signUp } from '../lib/supabaseClient';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

export const AuthScreen = () => {
    const { colors, spacing, borderRadius } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const handleEmailAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }
        if (isSignUp && !agreedToTerms) {
            Alert.alert('Terms & Conditions', 'Please agree to the Terms and Conditions to create an account.');
            return;
        }

        setLoading(true);
        try {
            if (isSignUp) {
                const { error } = await signUp({
                    email,
                    password,
                });
                if (error) throw error;
                Alert.alert('Verification Required', 'Please check your email to verify your account.');
            } else {
                const { error } = await signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error: any) {
            if (error?.code === 'refresh_token_not_found') {
                await signOut();
            }
            Alert.alert('Auth Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        if (!email) {
            Alert.alert('Forgot Password', 'Please enter your email address first.');
            return;
        }
        logger.log('Alert triggered');
        Alert.alert('Coming Soon', 'Password reset functionality is being configured.');
    };

    return (
        <ScreenContainer edges={['top', 'bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={[styles.scrollContent, { padding: spacing.xl }]}>
                    {/* Top-Center Branding */}
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

                    {/* Auth Box */}
                    <Card style={[styles.authCard, { backgroundColor: colors.surface, marginTop: spacing.xl }]}>
                        <AppText variant="heading" style={[styles.instructionText, { color: colors.text, marginBottom: spacing.l }]}>
                            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
                        </AppText>

                        <View style={[styles.inputGroup, { backgroundColor: colors.background, borderRadius: borderRadius.m, borderColor: colors.border }]}>
                            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="Email Address"
                                placeholderTextColor={colors.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                        
                        <View style={[styles.inputGroup, { backgroundColor: colors.background, borderRadius: borderRadius.m, borderColor: colors.border, marginTop: spacing.m }]}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="Password"
                                placeholderTextColor={colors.textSecondary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        {!isSignUp && (
                            <TouchableOpacity 
                                style={[styles.forgotPassword, { marginTop: spacing.s }]} 
                                onPress={handleForgotPassword}
                            >
                                <AppText variant="bodySmall" style={{ color: colors.primary }}>Forgot Password?</AppText>
                            </TouchableOpacity>
                        )}

                        {isSignUp && (
                            <TouchableOpacity 
                                style={[styles.termsRow, { marginTop: spacing.m }]}
                                onPress={() => setAgreedToTerms(!agreedToTerms)}
                            >
                                <Ionicons 
                                    name={agreedToTerms ? "checkbox" : "square-outline"} 
                                    size={20} 
                                    color={agreedToTerms ? colors.primary : colors.textSecondary} 
                                />
                                <AppText variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: spacing.s }}>
                                    I agree to the <AppText variant="bodySmall" style={{ color: colors.primary }}>Terms & Conditions</AppText>
                                </AppText>
                            </TouchableOpacity>
                        )}

                        <Button
                            title={loading ? "Please wait..." : (isSignUp ? "Create Account" : "Sign In")}
                            onPress={handleEmailAuth}
                            disabled={loading}
                            style={{ marginTop: spacing.xl }}
                        />
                        <TouchableOpacity 
                            style={[styles.switchMode, { marginTop: spacing.l }]} 
                            onPress={() => setIsSignUp(!isSignUp)}
                        >
                            <AppText variant="bodySmall" style={{ color: colors.textSecondary }}>
                                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                                <AppText variant="bodySmall" style={{ color: colors.primary }}>{isSignUp ? 'Sign In' : 'Sign Up'}</AppText>
                            </AppText>
                        </TouchableOpacity>
                        
                        <AppText variant="caption" style={[styles.privacyNote, { color: colors.textSecondary, marginTop: spacing.xl }]}>
                            Mangalam is a quiet space for reflection. No ads, and we never sell your data.
                        </AppText>
                    </Card>

                    <View style={[styles.footer, { paddingVertical: spacing.xl }]}>
                        <AppText variant="caption" style={[styles.footerText, { color: colors.textTertiary || colors.textSecondary }]}>
                            Guided reflection for your spiritual journey.
                        </AppText>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenContainer>
    );
};

const createStyles = (spacing: ReturnType<typeof useTheme>['spacing']) => StyleSheet.create({
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
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        paddingHorizontal: spacing.m,
    },
    inputIcon: {
        marginRight: spacing.s,
    },
    input: {
        flex: 1,
        height: 52,
        fontSize: 16,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    switchMode: {
        alignItems: 'center',
    },
    privacyNote: {
        textAlign: 'center',
        fontStyle: 'italic',
        opacity: 0.8,
    },
    footer: {
        marginTop: 'auto',
    },
    footerText: {
        textAlign: 'center',
        opacity: 0.7,
    }
});
