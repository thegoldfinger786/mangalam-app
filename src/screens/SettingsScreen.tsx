import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { VoicePreference } from '../data/types';
import { signOut, supabase } from '../lib/supabase';
import { useAudioStore } from '../store/useAudioStore';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';


export const SettingsScreen = () => {
    const navigation = useNavigation<any>();
    const { session, voicePreference, setVoicePreference, accountStatus, setAccountStatus, themeMode, setThemeMode, userName, setUserName } = useAppStore();
    const { colors, spacing, typography, borderRadius } = useTheme();
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
        Alert.alert('Success', 'Display name updated.');
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
            <ScrollView style={styles.container} contentContainerStyle={[styles.content, { padding: spacing.l, paddingTop: spacing.m, paddingBottom: 80 }]}>
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

                <TouchableOpacity
                    style={styles.accountStatus}
                    activeOpacity={isEditing ? 1 : 0.7}
                    onPress={() => {
                        if (!isEditing) setIsEditing(true);
                    }}
                >
                    <Text style={[styles.accountLabel, { color: colors.textSecondary }]}>Display Name:</Text>
                    {isEditing ? (
                        <View style={[styles.accountStatus, { flex: 1, marginBottom: 0, marginLeft: spacing.m }]}>
                            <TextInput
                                style={[
                                    styles.accountValue,
                                    {
                                        flex: 1,
                                        color: colors.text,
                                        textAlign: 'right',
                                        paddingVertical: 0,
                                    }
                                ]}
                                placeholder="Enter your name"
                                placeholderTextColor={colors.textSecondary}
                                value={displayName}
                                onChangeText={setDisplayName}
                                autoCapitalize="words"
                                returnKeyType="done"
                                autoFocus
                                onSubmitEditing={handleSaveDisplayName}
                                onBlur={() => setIsEditing(false)}
                            />
                            <TouchableOpacity onPress={handleSaveDisplayName}>
                                <Ionicons name="checkmark" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={[styles.accountStatus, { flex: 1, marginBottom: 0, marginLeft: spacing.m }]}>
                            <Text style={[styles.accountValue, { color: colors.text, flex: 1, textAlign: 'right' }]}>
                                {displayName || 'Add name'}
                            </Text>
                            <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                        </View>
                    )}
                </TouchableOpacity>

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
                        <Text style={[styles.accountValue, { color: colors.text }]}>{bgEnabled ? 'ON' : 'OFF'}</Text>
                    </View>
                    <Switch
                        trackColor={{ false: colors.border, true: colors.primaryLight }}
                        thumbColor={bgEnabled ? colors.primary : colors.surfaceSecondary}
                        onValueChange={setBgEnabled}
                        value={bgEnabled}
                    />
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
                <TouchableOpacity 
                    style={[styles.optionRow, { backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.m }]}
                    onPress={() => navigation.navigate('About')}
                >
                    <Text style={[styles.optionText, { color: colors.text }]}>About Mangalam</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </Card>
        </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
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
        marginBottom: 24, // spacing.l
    },
    signOutIcon: {
        padding: 4,
    },
    sectionCard: {
        marginBottom: 24, // spacing.l
        padding: 24, // spacing.l
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24, // spacing.l
    },
    sectionTitle: {
        fontSize: 20, // typography.sizes.l
        marginLeft: 8, // spacing.s
    },
    accountStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24, // spacing.l
    },
    accountLabel: {
        fontSize: 16, // typography.sizes.m
    },
    accountValue: {
        fontSize: 16, // typography.sizes.m
        fontWeight: '600',
    },
    accountButton: {
        marginBottom: 16, // spacing.m
    },
    displayNameInput: {
        borderWidth: 1,
        fontSize: 16,
    },
    sliderRow: {
        marginBottom: 16,
    },
    optionsContainer: {
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16, // spacing.m
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
