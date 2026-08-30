import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
            {title && <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.m }]}>{title}</Text>}
            {content && <Text style={[styles.contentBody, { color: colors.text }]}>{content}</Text>}
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
                    <Text style={[styles.brandName, { color: colors.text }]}>Support Mangalam</Text>
                    <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Helping preserve and share ancient wisdom</Text>
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
                    <Text style={[styles.paymentNote, { color: colors.textTertiary, marginTop: spacing.l }]}>
                        Choose any amount. Secure payments via Apple Pay, Google Pay, and cards.
                    </Text>
                </SectionCard>

                {/* Transparency Section */}
                <SectionCard title="What your support enables">
                    <View>
                        <View style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <Text style={[styles.contentBody, { color: colors.textSecondary, flex: 1 }]}>Audio narration generation</Text>
                        </View>
                        <View style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <Text style={[styles.contentBody, { color: colors.textSecondary, flex: 1 }]}>Hosting and infrastructure</Text>
                        </View>
                        <View style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <Text style={[styles.contentBody, { color: colors.textSecondary, flex: 1 }]}>New scripture translations</Text>
                        </View>
                        <View style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <Text style={[styles.contentBody, { color: colors.textSecondary, flex: 1 }]}>Preservation of ancient texts</Text>
                        </View>
                    </View>
                </SectionCard>

                {/* Final Closing - Mirrored from AboutScreen */}
                <View style={styles.closingSection}>
                    <Ionicons name="heart-outline" size={40} color={colors.primary} />
                    <Text style={[styles.closingText, { color: colors.textSecondary, marginTop: spacing.m }]}>
                        Thank you for helping keep this knowledge accessible to everyone. Your support allows Mangalam to continue sharing wisdom that has guided generations.
                    </Text>
                    <Text style={[styles.brandBottom, { color: colors.text, marginTop: spacing.l }]}>Mangalam</Text>
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
        fontSize: 32,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 14,
        letterSpacing: 0.5,
        marginTop: spacing.xs,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
    },
    sectionCard: {
        padding: spacing.l,
        borderRadius: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    contentBody: {
        fontSize: 16,
        lineHeight: 24,
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
        fontSize: 13,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    closingSection: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        paddingBottom: spacing.xxxl,
    },
    closingText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        fontStyle: 'italic',
        paddingHorizontal: spacing.xl,
    },
    brandBottom: {
        fontSize: 24,
        fontWeight: 'bold',
    }
});
