import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LEGAL_LINKS = [
    { label: 'Terms', url: 'https://www.mangalamapp.com/terms' },
    { label: 'Privacy Policy', url: 'https://www.mangalamapp.com/privacy' },
    { label: 'Disclaimer', url: 'https://www.mangalamapp.com/disclaimer' },
    { label: 'Support', url: 'https://www.mangalamapp.com/support' },
    { label: 'Contact', url: 'mailto:support@mangalamapp.com' },
];

export const AboutScreen = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const navigation = useNavigation<NavigationProp>();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
    console.log('AboutScreen rendered');

    const openLink = async (url: string) => {
        try {
            if (url.startsWith('mailto:')) {
                await Linking.openURL(url);
                return;
            }
            navigation.navigate('WebView', { url });
        } catch {
            Alert.alert('Error', 'Unable to open link.');
        }
    };

    const SectionCard = ({ title, content, bulletPoints, quote }: { title?: string, content?: string, bulletPoints?: string[], quote?: string }) => (
        <Card style={[styles.sectionCard, { backgroundColor: colors.surface, marginBottom: spacing.l }]}>
            {title && <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: spacing.m }]}>{title}</Text>}
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
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Our Philosophy</Text>
                <View style={{ width: 40 }} />
            </View>

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

                {/* Introduction Section */}
                <SectionCard 
                    title="ABOUT MANGALAM"
                    content="Mangalam is a quiet space to reconnect with the timeless wisdom of India’s sacred traditions. For thousands of years, texts such as the Bhagavad Gita, Ramayan, and Mahabharat have guided people through questions of purpose, duty, resilience, and inner peace. Mangalam brings this wisdom into a simple daily practice; one reflection at a time."
                />

                <SectionCard
                    title="What is Mangalam?"
                    content="Mangalam is a spiritual storytelling and learning platform designed to bring ancient wisdom into modern life. It blends scripture, reflection, and narration into a format that feels calm, accessible, and meaningful in the middle of everyday routines."
                />

                <SectionCard
                    title="Our Mission"
                    content="To make timeless knowledge accessible, engaging, and relevant for everyday life. Mangalam exists to help people build a steady relationship with sacred stories and wisdom without requiring formal study, prior background, or long uninterrupted time."
                />

                <SectionCard
                    title="Why Mangalam?"
                    bulletPoints={[
                        "Daily spiritual growth through small, steady practice",
                        "Story-based learning rooted in dharmic tradition",
                        "Practical life application through reflection and listening",
                    ]}
                />

                {/* Detailed Sections */}
                <SectionCard 
                    title="Why Mangalam was Created"
                    content="Many people feel drawn to the wisdom of ancient scriptures but find traditional study difficult to begin. Long commentaries, complex language, and the demands of daily life can make it hard to engage with these teachings."
                    quote="Mangalam was created to make this wisdom accessible in a calm, simple format; something that fit naturally into everyday life."
                />

                <SectionCard 
                    title="What You Will Find"
                    content="Inside Mangalam you will discover a curated path to explore dharmic philosophy:"
                    bulletPoints={[
                        "Daily reflections inspired by the Bhagavad Gita",
                        "Stories and insights from the Ramayan and Mahabharat",
                        "Short wisdom passages designed for reflection",
                        "Calm audio narration for any moment",
                        "A gentle introduction to timeless spiritual logic"
                    ]}
                />

                <SectionCard 
                    title="Our Approach"
                    content="The content in Mangalam is inspired by classical Sanskrit texts and traditional interpretations. Our aim is not to replace traditional study or scholarly commentary. Instead, Mangalam serves as a simple entry point into these timeless teachings."
                    quote="We approach these traditions with respect for their depth, nuance, and spiritual heritage."
                />

                <SectionCard 
                    title="Sources and Tradition"
                    content="The reflections shared in Mangalam draw inspiration from classical texts that have guided generations:"
                    bulletPoints={[
                        "Bhagavad Gita",
                        "Valmiki Ramayan",
                        "Mahabharat",
                        "Traditional dharmic philosophy"
                    ]}
                />

                <SectionCard 
                    title="Daily Practice"
                    content="Mangalam is designed to be part of a small daily ritual. You may wish to listen in the morning, read during a quiet moment, or reflect before sleep."
                    bulletPoints={[
                        "Listen. Reflect. Contemplate."
                    ]}
                    quote="Even a few minutes of thoughtful listening can bring clarity and perspective to daily life."
                />

                <SectionCard 
                    title="Your Trust is important for us"
                    content="We do not collect or sell personal data. This app is built simply to make timeless wisdom accessible to everyone."
                />

                <SectionCard 
                    title="Disclaimer"
                    content="The content in this app is intended for spiritual learning and personal reflection. Texts are drawn from traditional sources and publicly available translations, and in some cases supported by modern tools to improve accessibility and narration. Interpretations may vary across traditions and scholars. This app does not claim to represent any single authoritative interpretation of these sacred texts."
                />

                <SectionCard 
                    title="PRIVATE INITIATIVE"
                    content="Mangalam is a private initiative created to share ancient wisdom. Contributions are optional and help support the development and hosting of the platform. The app will remain free for everyone."
                />

                {/* Support Section */}
                <Card style={[styles.sectionCard, { backgroundColor: colors.surfaceSecondary, marginBottom: spacing.l, borderColor: colors.primaryLight }]}>
                    <View style={{ alignItems: 'center' }}>
                        <Ionicons name="heart-outline" size={32} color={colors.primary} style={{ marginBottom: spacing.s }} />
                        <Text style={[styles.sectionTitle, { color: colors.text, textAlign: 'center', marginBottom: spacing.s }]}>Support Mangalam</Text>
                        <Text style={[styles.contentBody, { color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.l }]}>
                            If Mangalam has brought value to your life, consider supporting our mission to keep these teachings accessible and ad-free for everyone.
                        </Text>
                        <Button 
                            title="Support Mangalam" 
                            onPress={() => navigation.navigate('SupportMangalam')}
                            variant="primary"
                            style={{ width: '100%', marginBottom: spacing.s }}
                        />
                        <Text style={[styles.contentBody, { fontSize: 13, color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic' }]}>
                            Help keep Mangalam free and ad-free.
                        </Text>
                    </View>
                </Card>

                {/* Final Closing */}
                <View style={styles.closingSection}>
                    <Ionicons name="flower-outline" size={40} color={colors.primary} />
                    <Text style={[styles.closingText, { color: colors.textSecondary, marginTop: spacing.m }]}>
                        May each reflection bring a little more clarity, calm, and understanding into your day.
                    </Text>
                    <Text style={[styles.brandBottom, { color: colors.text, marginTop: spacing.l }]}>Mangalam</Text>
                </View>

                <Card style={[styles.sectionCard, { backgroundColor: colors.surface, marginBottom: spacing.l }]}>
                    <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: spacing.m }]}>Legal &amp; Support</Text>
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
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
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
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginTop: spacing.xs,
    },
    sectionCard: {
        padding: spacing.l,
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
    }
});
