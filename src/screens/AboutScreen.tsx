import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { Card } from '../components/Card';
import { ScreenHeader } from '../components/ScreenHeader';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LEGAL_LINKS = [
    { label: 'Terms', url: 'https://www.mangalamapp.com/terms' },
    { label: 'Privacy Policy', url: 'https://www.mangalamapp.com/privacy' },
    { label: 'Disclaimer', url: 'https://www.mangalamapp.com/disclaimer' },
    { label: 'Support', url: 'https://www.mangalamapp.com/support' },
    { label: 'Contact', url: 'mailto:support@mangalamapp.com' },
];

export const AboutScreen = () => {
    const { colors, spacing, borderRadius } = useTheme();
    const navigation = useNavigation<NavigationProp>();
    const styles = useMemo(() => createStyles(spacing), [spacing]);

    const openLink = async (url: string) => {
        // Legal / policy pages and Contact open in the system browser / mail app —
        // same as the Login screen. They render in their own serif type and carry
        // their own site nav, which clashes inside a bare in-app WebView (WEB-01/02).
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Couldn’t open link', 'Please try again in a moment.');
        }
    };

    const SectionCard = ({ title, content, bulletPoints, quote }: { title?: string, content?: string, bulletPoints?: string[], quote?: string }) => (
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface, marginBottom: spacing.l }]}>
            {title && <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.m }]}>{title}</Text>}
            {content && <Text style={[styles.contentBody, { color: colors.text }]}>{content}</Text>}
            {bulletPoints && (
                <View style={{ marginTop: spacing.m }}>
                    {bulletPoints.map((point, index) => (
                        <View key={index} style={styles.bulletRow}>
                            <View style={[styles.bulletPoint, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                            </View>
                            <Text style={[styles.contentBody, { color: colors.textSecondary, flex: 1 }]}>{point}</Text>
                        </View>
                    ))}
                </View>
            )}
            {quote && (
                <View style={[styles.quoteContainer, { borderLeftColor: colors.primary, marginTop: spacing.m }]}>
                    <Text style={[styles.quoteText, { color: colors.textSecondary }]}>{quote}</Text>
                </View>
            )}
        </Card>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="About Mangalam" />

            <ScrollView contentContainerStyle={{ padding: spacing.l }}>
                {/* Hero Header */}
                <View style={styles.heroSection}>
                    <View style={[styles.logoContainer, { borderColor: colors.border }]}>
                        <Image 
                            source={require('../../assets/images/Mangalam-cover.jpeg')}
                            style={styles.logoImage}
                            resizeMode="cover"
                        />
                    </View>
                    <Text style={[styles.brandName, { color: colors.text }]}>Mangalam</Text>
                    <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>Ancient Wisdom • Modern Life</Text>
                </View>

                {/* What Mangalam is */}
                <SectionCard
                    title="About Mangalam"
                    content="Mangalam is a quiet space to reconnect with the timeless wisdom of India’s sacred traditions. For thousands of years, texts such as the Bhagavad Gita, Ramayan, and Mahabharat have guided people through questions of purpose, duty, resilience, and inner peace. Mangalam blends scripture, reflection, and calm narration into a simple daily practice — one reflection at a time."
                />

                {/* Philosophy / mission */}
                <SectionCard
                    title="Our mission"
                    content="To make timeless knowledge accessible, engaging, and relevant for everyday life — helping people build a steady relationship with sacred stories and wisdom without requiring formal study, prior background, or long uninterrupted time."
                    bulletPoints={[
                        "Daily spiritual growth through small, steady practice",
                        "Story-based learning rooted in dharmic tradition",
                        "Practical life application through reflection and listening",
                    ]}
                />

                {/* The broader story */}
                <SectionCard
                    title="Why Mangalam was created"
                    content="Many people feel drawn to the wisdom of ancient scriptures but find traditional study difficult to begin — long commentaries, complex language, and the demands of daily life get in the way. Mangalam was created to make this wisdom accessible in a calm, simple format that fits naturally into everyday life. It is a private initiative, and the app will always remain free and ad-free."
                    quote="We approach these traditions with respect for their depth, nuance, and spiritual heritage."
                />

                <SectionCard
                    title="What you’ll find"
                    content="A curated path to explore dharmic philosophy:"
                    bulletPoints={[
                        "Daily reflections inspired by the Bhagavad Gita",
                        "Stories and insights from the Ramayan and Mahabharat",
                        "Short wisdom passages designed for reflection",
                        "Calm audio narration for any moment",
                    ]}
                />

                <SectionCard
                    title="Sources and approach"
                    content="The content is inspired by classical Sanskrit texts and traditional interpretations, supported in places by modern tools to improve accessibility and narration. It is a simple entry point into these teachings, not a replacement for traditional study or scholarly commentary."
                    bulletPoints={[
                        "Bhagavad Gita",
                        "Valmiki Ramayan",
                        "Mahabharat",
                        "Traditional dharmic philosophy",
                    ]}
                />

                <SectionCard
                    title="Your trust matters to us"
                    content="We show no ads and never sell your data. We keep only what Mangalam needs to work — your name, your progress and your preferences. See the Privacy Policy below for the details."
                />

                <SectionCard
                    title="Disclaimer"
                    content="The content in this app is intended for spiritual learning and personal reflection. Interpretations may vary across traditions and scholars. This app does not claim to represent any single authoritative interpretation of these sacred texts."
                />

                {/* One contextual Support mention — the full page is in Settings → Support */}
                <TouchableOpacity onPress={() => navigation.navigate('SupportMangalam')} style={styles.supportLine}>
                    <Ionicons name="heart-outline" size={16} color={colors.primary} />
                    <Text style={[styles.contentBody, { color: colors.primary, marginLeft: spacing.s }]}>
                        Mangalam is kept free by optional contributions — learn more
                    </Text>
                </TouchableOpacity>

                {/* Final Closing */}
                <View style={styles.closingSection}>
                    <Ionicons name="flower-outline" size={40} color={colors.primary} />
                    <Text style={[styles.closingText, { color: colors.textSecondary, marginTop: spacing.m }]}>
                        May each reflection bring a little more clarity, calm, and understanding into your day.
                    </Text>
                    <Text style={[styles.brandBottom, { color: colors.text, marginTop: spacing.l }]}>Mangalam</Text>
                </View>

                <Card style={[styles.sectionCard, { backgroundColor: colors.surface, marginBottom: spacing.l }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.m }]}>Legal &amp; Support</Text>
                    <View style={[styles.linkGroup, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.l }]}>
                        {LEGAL_LINKS.map((item, index) => (
                            <View key={item.label}>
                                <TouchableOpacity
                                    style={[styles.linkRow, { paddingVertical: spacing.m, paddingHorizontal: spacing.m }]}
                                    onPress={() => openLink(item.url)}
                                >
                                    <Text style={[styles.linkText, { color: colors.text }]}>{item.label}</Text>
                                    <Ionicons name={item.url.startsWith('mailto:') ? 'mail-outline' : 'chevron-forward'} size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                                {index < LEGAL_LINKS.length - 1 && (
                                    <View style={[styles.linkDivider, { backgroundColor: colors.border, marginHorizontal: spacing.m }]} />
                                )}
                            </View>
                        ))}
                    </View>
                </Card>
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
    },
    heroSubtitle: {
        fontSize: 14,
        letterSpacing: 0.5,
        marginTop: spacing.xs,
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
    quoteContainer: {
        paddingLeft: spacing.m,
        borderLeftWidth: 3,
    },
    quoteText: {
        fontSize: 15,
        fontStyle: 'italic',
        lineHeight: 22,
    },
    linkGroup: {
        borderWidth: 1,
        overflow: 'hidden',
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    linkText: {
        fontSize: 16,
        fontWeight: '600',
    },
    linkDivider: {
        height: 1,
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
    },
    supportLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.m,
        marginBottom: spacing.l,
    },
});
