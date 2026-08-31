import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { VoiceOptionCard } from '../components/VoiceOptionCard';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { RootStackParamList } from '../navigation/types';
import { VoicePreference } from '../data/types';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { useAudioStore } from '../store/useAudioStore';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const isPrivateEmail = (email?: string | null) => {
    if (!email) return false;

    const normalizedEmail = email.trim().toLowerCase();

    const maskedDomains = [
        'privaterelay.appleid.com',
    ];

    return maskedDomains.some(domain =>
        normalizedEmail.endsWith(`@${domain}`)
    );
};

const getDisplayEmail = (email?: string | null) => {
    if (!email) return '—';
    if (isPrivateEmail(email)) return '🔒 Private Email';
    return email;
};

// ── Voice option data ────────────────────────────────────────────────────────
const VOICE_OPTIONS = [
    { value: 'english-male'   as const, language: 'English', voice: 'Male',   icon: 'male-outline'   as const },
    { value: 'english-female' as const, language: 'English', voice: 'Female', icon: 'female-outline' as const },
    { value: 'hindi-male'     as const, language: 'Hindi',   voice: 'Male',   icon: 'male-outline'   as const },
    { value: 'hindi-female'   as const, language: 'Hindi',   voice: 'Female', icon: 'female-outline' as const },
];

export const SettingsScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const { signOut, deleteAccount } = useAuth();
    const [isDeleting, setIsDeleting] = useState(false);
    const { session, voicePreference, setVoicePreference, themeMode, setThemeMode, userName, setUserName } = useAppStore();
    const { colors, spacing, typography, borderRadius, layout } = useTheme();
    
    const styles = useMemo(() => createStyles(spacing, typography), [spacing, typography]);
    const appVersion = Constants.expoConfig?.version ?? '1.0.0';
    const { narrationVolume, targetBgVolume, bgEnabled, hydrateAudioSettings, setNarrationVolume, setBgVolume, setBgEnabled } = useAudioStore();
    const [displayName, setDisplayName] = useState(userName);
    const [isEditing, setIsEditing] = useState(false);

    const isDarkMode = themeMode === 'dark';
    const displayedBgVolume = bgEnabled ? targetBgVolume : 0;
    const currentDisplayEmail = getDisplayEmail(session?.user?.email);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            hydrateAudioSettings();

            const loadProfile = async () => {
                if (!session?.user?.id || displayName) return;

                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (!isActive || error) return;

                const nextName = profile?.display_name || '';
                setDisplayName(nextName);
                if (nextName) {
                    setUserName(nextName);
                }
            };

            loadProfile();

            return () => {
                isActive = false;
            };
        }, [displayName, hydrateAudioSettings, session?.user?.id, setUserName])
    );

    const handleToggleTheme = () => {
        setThemeMode(isDarkMode ? 'light' : 'dark');
    };

    const handleVoiceSelect = (voice: VoicePreference) => {
        setVoicePreference(voice);
    };

    const handleBecomeSupporter = () => {
        navigation.navigate('SupportMangalam');
    };

    const handleSaveDisplayName = async () => {
        if (!session?.user?.id) return;

        const trimmedName = (displayName || '').trim();
        const { error } = await supabase.from('profiles').upsert({
            id: session.user.id,
            display_name: trimmedName,
            updated_at: new Date().toISOString(),
        });

        if (error) {
            Alert.alert('Couldn’t save', 'Your name couldn’t be saved just now. Please try again.');
            return;
        }

        setDisplayName(trimmedName);
        setUserName(trimmedName);
        setIsEditing(false);
    };

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    onPress: async () => {
                        try {
                            await signOut();
                        } catch (error: any) {
                            Alert.alert('Error', error?.message || 'Failed to sign out.');
                        }
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const handleDeleteAccount = () => {
        if (isDeleting) return;
        Alert.alert(
            'Delete Account',
            'This permanently deletes your account and all your saved progress, bookmarks and preferences. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        const { error } = await deleteAccount();
                        setIsDeleting(false);
                        if (error) {
                            Alert.alert(
                                'Could not delete account',
                                'Something went wrong. Please check your connection and try again.',
                            );
                        }
                        // On success the session clears and the app returns to sign-in.
                    },
                },
            ],
        );
    };


    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView 
                style={styles.container} 
                contentContainerStyle={{ 
                    paddingHorizontal: spacing.l, 
                    paddingTop: spacing.m, 
                    paddingBottom: layout.miniPlayerHeight + spacing.m 
                }}
            >
                <View style={styles.headerRow}>
                    <AppText variant="display" style={{ color: colors.text }}>Settings</AppText>
                </View>

            {/* Account Section */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
                    <AppText variant="heading" style={styles.sectionTitle}>Account</AppText>
                </View>

                <View style={[styles.accountStatus, { marginBottom: spacing.s, alignItems: 'flex-start' }]}>
                    <AppText variant="body" style={{ color: colors.textSecondary }}>Email:</AppText>
                    <View style={{ alignItems: 'flex-end', flex: 1, paddingLeft: spacing.m }}>
                        <AppText variant="body" style={[styles.accountValue, { color: colors.text, textAlign: 'right' }]}>
                            {currentDisplayEmail}
                        </AppText>
                        {isPrivateEmail(session?.user?.email) && (
                            <AppText variant="label" style={{ color: colors.textSecondary, marginTop: 4, opacity: 0.8, textAlign: 'right' }}>
                                Your email is protected by your sign-in provider
                            </AppText>
                        )}
                    </View>
                </View>

                <View style={styles.accountStatus}>
                    <AppText variant="body" style={{ color: colors.textSecondary }}>Display Name:</AppText>
                    {isEditing ? (
                        <View style={[styles.inlineEditRow, { marginLeft: spacing.m, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.m }]}>
                            <TextInput
                                style={[styles.inlineInput, { color: colors.text }]}
                                placeholder="Enter your name"
                                placeholderTextColor={colors.textSecondary}
                                value={displayName}
                                onChangeText={setDisplayName}
                                autoCapitalize="words"
                                returnKeyType="done"
                                autoFocus
                                onSubmitEditing={handleSaveDisplayName}
                                onBlur={handleSaveDisplayName}
                            />
                            <TouchableOpacity onPress={handleSaveDisplayName} style={styles.inlineCheckButton}>
                                <Ionicons name="checkmark" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.inlineDisplayName, { marginLeft: spacing.m }]}
                            activeOpacity={0.7}
                            onPress={() => setIsEditing(true)}
                        >
                            <AppText variant="body" style={[styles.accountValue, { color: colors.text, flex: 1, textAlign: 'right' }]}>
                                {displayName || 'Add name'}
                            </AppText>
                        </TouchableOpacity>
                    )}
                </View>

                <Button
                    title="Support Mangalam"
                    variant="primary"
                    onPress={handleBecomeSupporter}
                    style={styles.accountButton}
                />
                <AppText variant="caption" style={{ color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.s, fontStyle: 'italic' }}>
                    Help keep Mangalam free and ad-free.
                </AppText>

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.s }} />
                <View style={styles.accountActions}>
                    <TouchableOpacity onPress={handleSignOut} style={styles.accountAction} hitSlop={8}>
                        <Ionicons name="log-out-outline" size={18} color={colors.error} />
                        <AppText variant="body" style={{ color: colors.error }}>Sign Out</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleDeleteAccount}
                        disabled={isDeleting}
                        style={[styles.accountAction, { opacity: isDeleting ? 0.5 : 1 }]}
                        hitSlop={8}
                    >
                        <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                        <AppText variant="bodySmall" style={{ color: colors.textSecondary }}>
                            {isDeleting ? 'Deleting…' : 'Delete account'}
                        </AppText>
                    </TouchableOpacity>
                </View>
            </Card>

            {/* Language & Voice */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="volume-high-outline" size={24} color={colors.primary} />
                    <AppText variant="heading" style={styles.sectionTitle}>Language &amp; Voice</AppText>
                </View>
                <View style={styles.voiceGrid}>
                    {/* Row 1: English */}
                    <View style={styles.voiceRow}>
                        {VOICE_OPTIONS.slice(0, 2).map((opt) => (
                            <VoiceOptionCard
                                key={opt.value}
                                language={opt.language}
                                voice={opt.voice}
                                icon={opt.icon}
                                isSelected={voicePreference === opt.value}
                                onPress={() => handleVoiceSelect(opt.value)}
                            />
                        ))}
                    </View>
                    {/* Row 2: Hindi */}
                    <View style={styles.voiceRow}>
                        {VOICE_OPTIONS.slice(2).map((opt) => (
                            <VoiceOptionCard
                                key={opt.value}
                                language={opt.language}
                                voice={opt.voice}
                                icon={opt.icon}
                                isSelected={voicePreference === opt.value}
                                onPress={() => handleVoiceSelect(opt.value)}
                            />
                        ))}
                    </View>
                </View>
            </Card>

            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="musical-notes-outline" size={24} color={colors.primary} />
                    <AppText variant="heading" style={styles.sectionTitle}>Audio</AppText>
                </View>

                <View style={styles.sliderRow}>
                    <View style={styles.toggleRow}>
                        <AppText variant="body" style={{ color: colors.text }}>Background Music</AppText>
                        <Switch
                            trackColor={{ false: '#E5E7EB', true: colors.primary }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="#E5E7EB"
                            onValueChange={setBgEnabled}
                            value={bgEnabled}
                        />
                    </View>
                </View>

                <View style={styles.sliderRow}>
                    <AppText variant="body" style={{ color: colors.textSecondary, marginBottom: spacing.s }}>Narration Volume</AppText>
                    <Slider
                        minimumValue={0.5}
                        maximumValue={1.0}
                        step={0.05}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.primary}
                        value={narrationVolume}
                        onValueChange={(value) => setNarrationVolume(value, false)}
                        onSlidingComplete={(value) => setNarrationVolume(value, true)}
                    />
                </View>

                <View style={[styles.sliderRow, { marginBottom: 0 }]}>
                    <AppText variant="body" style={{ color: colors.textSecondary, marginBottom: spacing.s }}>Background Volume</AppText>
                    <Slider
                        minimumValue={0}
                        maximumValue={0.8}
                        step={0.05}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.primary}
                        value={displayedBgVolume}
                        onValueChange={(value) => setBgVolume(value, false)}
                        onSlidingComplete={(value) => setBgVolume(value, true)}
                    />
                </View>
            </Card>

            {/* App-level: appearance + about */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="color-palette-outline" size={24} color={colors.primary} />
                    <AppText variant="heading" style={styles.sectionTitle}>App</AppText>
                </View>
                <View style={[styles.toggleRow, { paddingVertical: spacing.s }]}>
                    <AppText variant="body" style={{ color: colors.text }}>Dark Mode</AppText>
                    <Switch
                        trackColor={{ false: '#E5E7EB', true: colors.primary }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#E5E7EB"
                        onValueChange={handleToggleTheme}
                        value={isDarkMode}
                    />
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />
                <TouchableOpacity onPress={() => navigation.navigate('About')} style={styles.optionRow}>
                    <AppText variant="body" style={{ color: colors.text }}>About Mangalam</AppText>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
            </Card>

            <AppText variant="caption" style={[styles.versionLabel, { color: colors.textTertiary }]}>
                Version {appVersion}
            </AppText>
        </ScrollView>
        </ScreenContainer>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography']
) => StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
    },
    headerRow: {
        marginBottom: spacing.m,
    },
    sectionCard: {
        marginBottom: spacing.m,
        padding: spacing.m,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    sectionTitle: {
        marginLeft: spacing.s,
    },
    accountStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.s,
    },
    versionLabel: {
        textAlign: 'center',
        marginTop: spacing.s,
    },
    accountValue: {
        fontFamily: typography.fontFamilies.semiBold,
    },
    accountButton: {
        marginBottom: spacing.m,
    },
    displayNameInput: {
        borderWidth: 1,
        fontSize: typography.sizes.m,
    },
    inlineDisplayName: {
        flex: 1,
        alignItems: 'flex-end',
        justifyContent: 'center',
        minHeight: 28,
    },
    inlineEditRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: spacing.m,
        minHeight: 40,
        borderWidth: 1,
    },
    inlineInput: {
        flex: 1,
        fontSize: typography.sizes.m,
        fontFamily: typography.fontFamilies.semiBold,
        textAlign: 'right',
    },
    inlineCheckButton: {
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
    },
    sliderRow: {
        marginBottom: spacing.m,
    },
    // 2-column grid for voice preference cards
    // Two explicit rows — guarantees 2 columns on every screen size (Android + iOS)
    voiceGrid: {
        gap: spacing.m,
    },
    voiceRow: {
        flexDirection: 'row',
        gap: spacing.m,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.m,
    },
    accountActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.s,
    },
    accountAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.s,
        paddingVertical: spacing.s,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});
