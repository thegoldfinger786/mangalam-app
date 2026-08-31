import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

export const SupportMangalamScreen = () => {
    const { colors, spacing } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);

    // The Stripe payment link provided by the user
    const STRIPE_PAYMENT_URL = "https://buy.stripe.com/3cI3cv7xj1IS6bobI00Ba00";

    const handleSupport = () => {
        Linking.openURL(STRIPE_PAYMENT_URL).catch(err => logger.error("Couldn't load Stripe payment page", { error: err }));
    };

    const SectionCard = ({ title, content, children }: { title?: string, content?: string, children?: React.ReactNode }) => (
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface, marginBottom: spacing.l }]}>
            {title && <AppText variant="subheading" style={{ color: colors.text, marginBottom: spacing.m }}>{title}</AppText>}
            {content && <AppText variant="body" style={{ color: colors.text }}>{content}</AppText>}
            {children}
        </Card>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Support Mangalam" />

            <ScrollView contentContainerStyle={{ padding: spacing.l }}>
                {/* Hero Header - Mirrored from AboutScreen */}
                <View style={styles.heroSection}>
                    <View style={[styles.logoContainer, { borderColor: colors.border }]}>
                        <Image 
                            source={require('../../assets/images/Mangalam-cover.jpeg')}
                            style={styles.logoImage}
                            resizeMode="cover"
                        />
                    </View>
                    <AppText variant="display" style={[styles.brandName, { color: colors.text }]}>Support Mangalam</AppText>
                    <AppText variant="bodySmall" style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Helping preserve and share ancient wisdom</AppText>
                </View>

                {/* Why support helps */}
                <SectionCard
                    title="Why your support helps"
                    content="Mangalam is a private initiative, kept free and ad-free for everyone. Contributions are entirely optional — they cover the running costs so the app can stay that way and keep growing."
                />

                <SectionCard title="Make a contribution">
                    <Button
                        title="Support Mangalam"
                        variant="primary"
                        onPress={handleSupport}
                        style={[styles.gridButton, styles.highlightedButton]}
                    />
                    <AppText variant="caption" style={[styles.paymentNote, { color: colors.textTertiary, marginTop: spacing.l }]}>
                        Choose any amount. Secure payments via Apple Pay, Google Pay, and cards.
                    </AppText>
                </SectionCard>

                {/* Transparency Section */}
                <SectionCard title="What your support enables">
                    <View>
                        <View style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <AppText variant="body" style={{ color: colors.textSecondary, flex: 1 }}>Audio narration generation</AppText>
                        </View>
                        <View style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <AppText variant="body" style={{ color: colors.textSecondary, flex: 1 }}>Hosting and infrastructure</AppText>
                        </View>
                        <View style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <AppText variant="body" style={{ color: colors.textSecondary, flex: 1 }}>New scripture translations</AppText>
                        </View>
                        <View style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <AppText variant="body" style={{ color: colors.textSecondary, flex: 1 }}>Preservation of ancient texts</AppText>
                        </View>
                    </View>
                </SectionCard>

                {/* Final Closing - Mirrored from AboutScreen */}
                <View style={styles.closingSection}>
                    <Ionicons name="heart-outline" size={40} color={colors.primary} />
                    <AppText variant="body" style={[styles.closingText, { color: colors.textSecondary, marginTop: spacing.m }]}>
                        Thank you for helping keep this knowledge accessible to everyone. Your support allows Mangalam to continue sharing wisdom that has guided generations.
                    </AppText>
                    <AppText variant="title" style={{ color: colors.text, marginTop: spacing.l }}>Mangalam</AppText>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const createStyles = (spacing: ReturnType<typeof useTheme>['spacing']) => StyleSheet.create({
    container: {
        flex: 1,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: spacing.m,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    brandName: {
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    heroSubtitle: {
        letterSpacing: 0.5,
        marginTop: spacing.xs,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
    },
    sectionCard: {
        padding: spacing.l,
        borderRadius: 24,
    },
    gridButton: {
        width: '100%',
    },
    highlightedButton: {
        shadowOpacity: 0.1,
        elevation: 4,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    bulletPoint: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.m,
    },
    paymentNote: {
        textAlign: 'center',
        fontStyle: 'italic',
    },
    closingSection: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        paddingBottom: spacing.xxxl,
    },
    closingText: {
        textAlign: 'center',
        fontStyle: 'italic',
        paddingHorizontal: spacing.xl,
    },
});
