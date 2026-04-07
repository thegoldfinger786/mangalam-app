import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { VoicePreference } from '../data/types';
import { signOut, supabase } from '../lib/supabase';
import { useAudioStore } from '../store/useAudioStore';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';

const ABOUT_LINKS = [
    { label: 'Privacy Policy', url: 'https://www.mangalamapp.com/privacy' },
    { label: 'Terms of Service', url: 'https://www.mangalamapp.com/terms' },
    { label: 'Support', url: 'https://www.mangalamapp.com/support' },
    { label: 'Contact', url: 'mailto:support@mangalamapp.com' },
    { label: 'Disclaimer', url: 'https://www.mangalamapp.com/disclaimer' },
];

export const SettingsScreen = () => {
    const navigation = useNavigation<any>();
    const { session, voicePreference, setVoicePreference, accountStatus, setAccountStatus, themeMode, setThemeMode, userName, setUserName } = useAppStore();
    const { colors, spacing, typography, borderRadius } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
    const { narrationVolume, targetBgVolume, bgEnabled, hydrateAudioSettings, setNarrationVolume, setBgVolume, setBgEnabled } = useAudioStore();
    const [displayName, setDisplayName] = useState(userName);
    const [isEditing, setIsEditing] = useState(false);

    const isDarkMode = themeMode === 'dark';
    const displayedBgVolume = bgEnabled ? targetBgVolume : 0;

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

        const trimmedName = displayName.trim();
        const { error } = await supabase.from('profiles').upsert({
            id: session.user.id,
            display_name: trimmedName,
            updated_at: new Date().toISOString(),
        });

        if (error) {
            Alert.alert('Error', error.message);
            return;
        }

        setDisplayName(trimmedName);
        setUserName(trimmedName);
        setIsEditing(false);
    };

    const handleOpenExternalLink = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Error', 'Unable to open link.');
        }
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
                        const { error } = await signOut();
                        if (error) Alert.alert('Error', error.message);
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const VoiceOption = ({ label, value }: { label: string, value: VoicePreference }) => (
        <TouchableOpacity
            style={styles.optionRow}
            onPress={() => handleVoiceSelect(value)}
        >
            <Text style={[
                styles.optionText,
                { color: colors.text },
                voicePreference === value && styles.optionTextActive,
                voicePreference === value && { color: colors.primary }
            ]}>
                {label}
            </Text>
            {voicePreference === value && (
                <Ionicons name="checkmark" size={24} color={colors.primary} />
            )}
        </TouchableOpacity>
    );

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView style={styles.container} contentContainerStyle={[styles.content, { padding: spacing.l, paddingTop: spacing.m, paddingBottom: spacing.xxxl }]}>
                <View style={styles.headerRow}>
                    <Text style={[styles.screenTitle, { color: colors.text }]}>Settings</Text>
                    <TouchableOpacity onPress={handleSignOut} style={styles.signOutIcon}>
                        <Ionicons name="log-out-outline" size={28} color={colors.error} />
                    </TouchableOpacity>
                </View>

            {/* Account Section */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
                </View>

                <View style={[styles.accountStatus, { marginBottom: spacing.s }]}>
                    <Text style={[styles.accountLabel, { color: colors.textSecondary }]}>Email:</Text>
                    <Text style={[styles.accountValue, { color: colors.text }]}>{session?.user?.email || 'Not signed in'}</Text>
                </View>

                <View style={styles.accountStatus}>
                    <Text style={[styles.accountLabel, { color: colors.textSecondary }]}>Display Name:</Text>
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
                            <Text style={[styles.accountValue, { color: colors.text, flex: 1, textAlign: 'right' }]}>
                                {displayName || 'Add name'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.accountStatus}>
                    <Text style={[styles.accountLabel, { color: colors.textSecondary }]}>Plan:</Text>
                    <Text style={[styles.accountValue, { color: colors.text }]}>Free & Ad-free</Text>
                </View>

                <Button
                    title="Support Mangalam"
                    variant="primary"
                    onPress={handleBecomeSupporter}
                    style={styles.accountButton}
                />
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.s, fontStyle: 'italic' }}>
                    Help keep Mangalam free and ad-free.
                </Text>
            </Card>

            {/* Voice Preferences */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="volume-high-outline" size={24} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Voice Preference</Text>
                </View>
                <View style={[styles.optionsContainer, { backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.m }]}>
                    <VoiceOption label="English - Male" value="english-male" />
                    <View style={[styles.divider, { backgroundColor: colors.border, marginHorizontal: spacing.m }]} />
                    <VoiceOption label="English - Female" value="english-female" />
                    <View style={[styles.divider, { backgroundColor: colors.border, marginHorizontal: spacing.m }]} />
                    <VoiceOption label="Hindi - Male" value="hindi-male" />
                    <View style={[styles.divider, { backgroundColor: colors.border, marginHorizontal: spacing.m }]} />
                    <VoiceOption label="Hindi - Female" value="hindi-female" />
                </View>
            </Card>

            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="musical-notes-outline" size={24} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Audio</Text>
                </View>

                <View style={styles.sliderRow}>
                    <View style={styles.toggleRow}>
                        <Text style={[styles.optionText, { color: colors.text }]}>Background Music</Text>
                        <Switch
                            trackColor={{ false: colors.border, true: colors.primaryLight }}
                            thumbColor={bgEnabled ? colors.primary : colors.surfaceSecondary}
                            onValueChange={setBgEnabled}
                            value={bgEnabled}
                        />
                    </View>
                </View>

                <View style={styles.sliderRow}>
                    <Text style={[styles.accountLabel, { color: colors.textSecondary, marginBottom: spacing.s }]}>Narration Volume</Text>
                    <Slider
                        minimumValue={0.7}
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

                <View style={styles.sliderRow}>
                    <Text style={[styles.accountLabel, { color: colors.textSecondary, marginBottom: spacing.s }]}>Background Volume</Text>
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

            {/* Display Preferences */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="color-palette-outline" size={24} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Display</Text>
                </View>
                <View style={[styles.toggleRow, { paddingVertical: spacing.s }]}>
                    <Text style={[styles.optionText, { color: colors.text }]}>Dark Mode</Text>
                    <Switch
                        trackColor={{ false: colors.border, true: colors.primaryLight }}
                        thumbColor={isDarkMode ? colors.primary : colors.surfaceSecondary}
                        onValueChange={handleToggleTheme}
                        value={isDarkMode}
                    />
                </View>
            </Card>

            {/* About Section */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
                </View>
                <View style={[styles.optionsContainer, { backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.m }]}>
                    {ABOUT_LINKS.map((item, index) => (
                        <View key={item.label}>
                            <TouchableOpacity
                                style={styles.optionRow}
                                onPress={() => handleOpenExternalLink(item.url)}
                            >
                                <Text style={[styles.optionText, { color: colors.text }]}>{item.label}</Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                            {index < ABOUT_LINKS.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: colors.border, marginHorizontal: spacing.m }]} />
                            )}
                        </View>
                    ))}
                </View>
            </Card>
        </ScrollView>
        </ScreenContainer>
    );
};

const createStyles = (spacing: ReturnType<typeof useTheme>['spacing']) => StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
    },
    screenTitle: {
        fontWeight: 'bold',
        fontSize: 32,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.l,
    },
    signOutIcon: {
        padding: spacing.xs,
    },
    sectionCard: {
        marginBottom: spacing.l,
        padding: spacing.l,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.l,
    },
    sectionTitle: {
        fontSize: 20, // typography.sizes.l
        marginLeft: spacing.s,
    },
    accountStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.l,
    },
    accountLabel: {
        fontSize: 16, // typography.sizes.m
    },
    accountValue: {
        fontSize: 16, // typography.sizes.m
        fontWeight: '600',
    },
    accountButton: {
        marginBottom: spacing.m,
    },
    displayNameInput: {
        borderWidth: 1,
        fontSize: 16,
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
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'right',
        paddingVertical: 0,
    },
    inlineCheckButton: {
        paddingHorizontal: spacing.m,
        paddingVertical: spacing.s,
    },
    sliderRow: {
        marginBottom: spacing.m,
    },
    optionsContainer: {
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.m,
    },
    optionText: {
        fontSize: 16, // typography.sizes.m
    },
    optionTextActive: {
        fontWeight: '500',
    },
    divider: {
        height: 1,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});
