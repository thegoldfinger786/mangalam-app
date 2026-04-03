import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../theme';

export const SupportMangalamScreen = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const navigation = useNavigation();

    // The Stripe payment link provided by the user
    const STRIPE_PAYMENT_URL = "https://buy.stripe.com/3cI3cv7xj1IS6bobI00Ba00";

    const handleSupport = () => {
        Linking.openURL(STRIPE_PAYMENT_URL).catch(err => console.error("Couldn't load page", err));
    };

    const SectionCard = ({ title, content, children }: { title?: string, content?: string, children?: React.ReactNode }) => (
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface, marginBottom: spacing.l }]}>
            {title && <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: spacing.m }]}>{title}</Text>}
            {content && <Text style={[styles.contentBody, { color: colors.text }]}>{content}</Text>}
            {children}
        </Card>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Support</Text>
                <View style={{ width: 40 }} />
            </View>

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

                {/* Mission Section */}
                <SectionCard 
                    title="OUR MISSION"
                    content="Mangalam is built to make the wisdom of ancient Indian scriptures accessible to everyone. The app will always remain free and ad-free so that anyone can listen, learn, and reflect."
                >
                    <Text style={[styles.contentBody, { color: colors.text, marginTop: spacing.m }]}>
                        If this content has brought value to your life, you may support this initiative with a small contribution.
                    </Text>
                </SectionCard>

                {/* Private Initiative Note */}
                <SectionCard 
                    title="PRIVATE INITIATIVE"
                    content="Mangalam is a private initiative created to share ancient wisdom. Contributions are optional and help support the development and hosting of the platform. The app will remain free for everyone."
                />

                <SectionCard title="MAKE A CONTRIBUTION">
                    <Button 
                        title="Support with €5 / Custom Amount" 
                        variant="primary" 
                        onPress={handleSupport} 
                        style={[styles.gridButton, styles.highlightedButton]}
                    />
                    <Text style={[styles.paymentNote, { color: colors.textTertiary, marginTop: spacing.l }]}>
                        Secure payments via Apple Pay, Google Pay, and cards.
                    </Text>
                </SectionCard>

                {/* Transparency Section */}
                <SectionCard title="WHAT YOUR SUPPORT ENABLES">
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 16,
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
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginTop: 4,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    sectionCard: {
        padding: 24,
        borderRadius: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    contentBody: {
        fontSize: 16,
        lineHeight: 24,
    },
    buttonGrid: {
        gap: 12,
    },
    gridButton: {
        width: '100%',
    },
    highlightedButton: {
        transform: [{ scale: 1.02 }],
        shadowOpacity: 0.1,
        elevation: 4,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    bulletPoint: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    paymentNote: {
        fontSize: 13,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    closingSection: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingBottom: 80,
    },
    closingText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        fontStyle: 'italic',
        paddingHorizontal: 32,
    },
    brandBottom: {
        fontSize: 24,
        fontWeight: 'bold',
    }
});
