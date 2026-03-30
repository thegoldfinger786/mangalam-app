import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import { theme } from '../theme';

export const AuthScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isDevLogin, setIsDevLogin] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleDevLogin = async () => {
        if (!email || !password) {
            Alert.alert('Dev Login', 'Please enter email and password for developer login.');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        } catch (error: any) {
            Alert.alert('Login Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = (provider: 'google' | 'apple') => {
        Alert.alert('Coming Soon', `${provider.charAt(0).toUpperCase() + provider.slice(1)} login will be enabled once OAuth is configured in Supabase console.`);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="sunny" size={60} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.title}>Daily Shlokya</Text>
                    <TouchableOpacity
                        onLongPress={() => setIsDevLogin(!isDevLogin)}
                        delayLongPress={2000}
                        activeOpacity={1}
                    >
                        <Text style={styles.subtitle}>Your 10-minute spiritual habit</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.authContainer}>
                    <Text style={styles.instructionText}>Sign in to continue your journey</Text>

                    <TouchableOpacity
                        style={[styles.socialButton, { backgroundColor: '#FFFFFF', borderColor: '#DDD', borderWidth: 1 }]}
                        onPress={() => handleSocialLogin('google')}
                    >
                        <Ionicons name="logo-google" size={20} color="#000" />
                        <Text style={[styles.socialButtonText, { color: '#000' }]}>Sign in with Google</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.socialButton, { backgroundColor: '#000000' }]}
                        onPress={() => handleSocialLogin('apple')}
                    >
                        <Ionicons name="logo-apple" size={20} color="#FFF" />
                        <Text style={[styles.socialButtonText, { color: '#FFF' }]}>Sign in with Apple</Text>
                    </TouchableOpacity>

                    {isDevLogin && (
                        <View style={{ alignItems: 'center', marginBottom: theme.spacing.m }}>
                            <Text style={styles.devToggleText}>Developer Login Active</Text>
                        </View>
                    )}

                    {isDevLogin && (
                        <View style={styles.devForm}>
                            <View style={styles.inputGroup}>
                                <Ionicons name="mail-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Developer Email"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>
                            <Button
                                title={loading ? "Logging in..." : "Dev Login"}
                                onPress={handleDevLogin}
                                disabled={loading}
                            />
                        </View>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        By signing in, you agree to our Terms and Privacy Policy.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: theme.spacing.xl,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: theme.spacing.xxl,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.l,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    title: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: 32,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
    },
    subtitle: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.textSecondary,
    },
    authContainer: {
        width: '100%',
    },
    instructionText: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: theme.spacing.xl,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.m,
        borderRadius: theme.borderRadius.l,
        marginBottom: theme.spacing.m,
        height: 56,
    },
    socialButtonText: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.m,
        marginLeft: theme.spacing.s,
    },
    devToggle: {
        paddingVertical: theme.spacing.m,
        alignItems: 'center',
    },
    devToggleText: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.xs,
        color: theme.colors.textSecondary,
        opacity: 0.5,
    },
    devForm: {
        marginTop: theme.spacing.m,
        padding: theme.spacing.l,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        borderRadius: theme.borderRadius.m,
        paddingHorizontal: theme.spacing.m,
        marginBottom: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    inputIcon: {
        marginRight: theme.spacing.s,
    },
    input: {
        flex: 1,
        height: 50,
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.text,
    },
    footer: {
        marginTop: 'auto',
        paddingTop: theme.spacing.xxl,
    },
    footerText: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.xs,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        opacity: 0.8,
    }
});
