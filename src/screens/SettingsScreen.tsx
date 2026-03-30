import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { VoicePreference } from '../data/types';
import { signOut } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

export const SettingsScreen = () => {
    const { session, voicePreference, setVoicePreference, accountStatus, setAccountStatus } = useAppStore();
    const [isDarkMode, setIsDarkMode] = useState(false);

    const handleVoiceSelect = (voice: VoicePreference) => {
        setVoicePreference(voice);
    };

    const handleToggleAccount = () => {
        setAccountStatus(accountStatus === 'free' ? 'supporter' : 'free');
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
                voicePreference === value && styles.optionTextActive
            ]}>
                {label}
            </Text>
            {voicePreference === value && (
                <Ionicons name="checkmark" size={24} color={theme.colors.primary} />
            )}
        </TouchableOpacity>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Settings</Text>

            {/* Account Section */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="person-circle-outline" size={24} color={theme.colors.primary} />
                    <Text style={styles.sectionTitle}>Account</Text>
                </View>

                <View style={[styles.accountStatus, { marginBottom: theme.spacing.s }]}>
                    <Text style={styles.accountLabel}>Email:</Text>
                    <Text style={styles.accountValue}>{session?.user?.email || 'Not signed in'}</Text>
                </View>

                <View style={styles.accountStatus}>
                    <Text style={styles.accountLabel}>Current Plan:</Text>
                    <Text style={[
                        styles.accountValue,
                        accountStatus === 'supporter' && styles.supporterText
                    ]}>
                        {accountStatus === 'free' ? 'Free (3 sessions/day)' : 'Supporter (Unlimited)'}
                    </Text>
                </View>

                <Button
                    title={accountStatus === 'free' ? "Become a Supporter" : "Revert to Free"}
                    variant={accountStatus === 'free' ? 'primary' : 'outline'}
                    onPress={handleToggleAccount}
                    style={styles.accountButton}
                />

                <Button
                    title="Sign Out"
                    variant="outline"
                    onPress={handleSignOut}
                    style={{ borderColor: theme.colors.error }}
                    textStyle={{ color: theme.colors.error }}
                />
            </Card>

            {/* Voice Preferences */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="volume-high-outline" size={24} color={theme.colors.primary} />
                    <Text style={styles.sectionTitle}>Voice Preference</Text>
                </View>
                <View style={styles.optionsContainer}>
                    <VoiceOption label="English - Male" value="english-male" />
                    <View style={styles.divider} />
                    <VoiceOption label="English - Female" value="english-female" />
                    <View style={styles.divider} />
                    <VoiceOption label="Hindi - Male" value="hindi-male" />
                    <View style={styles.divider} />
                    <VoiceOption label="Hindi - Female" value="hindi-female" />
                </View>
            </Card>

            {/* Display Preferences */}
            <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="color-palette-outline" size={24} color={theme.colors.primary} />
                    <Text style={styles.sectionTitle}>Display</Text>
                </View>
                <View style={styles.toggleRow}>
                    <Text style={styles.optionText}>Dark Mode (Coming Soon)</Text>
                    <Switch
                        trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }}
                        thumbColor={isDarkMode ? theme.colors.primary : theme.colors.surfaceSecondary}
                        onValueChange={() => setIsDarkMode(!isDarkMode)}
                        value={isDarkMode}
                        disabled
                    />
                </View>
            </Card>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    content: {
        padding: theme.spacing.l,
        paddingTop: theme.spacing.xl * 2,
        paddingBottom: theme.spacing.xl,
    },
    screenTitle: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.xl,
        color: theme.colors.text,
        marginBottom: theme.spacing.l,
    },
    sectionCard: {
        marginBottom: theme.spacing.l,
        padding: theme.spacing.l,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.l,
    },
    sectionTitle: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.text,
        marginLeft: theme.spacing.s,
    },
    accountStatus: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.l,
    },
    accountLabel: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
    },
    accountValue: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.text,
    },
    supporterText: {
        color: theme.colors.primary,
    },
    accountButton: {
        marginBottom: theme.spacing.m,
    },
    optionsContainer: {
        backgroundColor: theme.colors.surfaceSecondary,
        borderRadius: theme.borderRadius.m,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.m,
    },
    optionText: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.text,
    },
    optionTextActive: {
        fontFamily: theme.typography.fontFamilies.medium,
        color: theme.colors.primary,
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginHorizontal: theme.spacing.m,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.s,
    },
});
