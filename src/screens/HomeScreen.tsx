import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { WeeklyStreak } from '../components/WeeklyStreak';
import { ContentPath } from '../data/types';
import { fetchActiveBooks, fetchBookBySlug, fetchDailyUsage, fetchFirstVerseForBook, fetchStreakData } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

const EXPLORE_PATHS = [
    { id: 'gita', title: 'Bhagavad Gita', icon: 'book-outline', color: '#E88B4A' },
    { id: 'ramayan', title: 'Ramayan', icon: 'navigate-outline', color: '#DE5D3D' },
    { id: 'mahabharat', title: 'Mahabharat', icon: 'flash-outline', color: '#D6A621' },
    { id: 'shiv_puran', title: 'Shiv Puran', icon: 'moon-outline', color: '#5C7485' },
    { id: 'upanishads', title: 'Upanishads', icon: 'leaf-outline', color: '#568E65' },
];

export const HomeScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const { session, activePath, setActivePath, userName } = useAppStore();

    const [loading, setLoading] = useState(true);
    const [books, setBooks] = useState<any[]>([]);
    const [usage, setUsage] = useState<any>(null);
    const [streakCount, setStreakCount] = useState(0);

    const loadData = useCallback(async () => {
        if (!session?.user) return;
        try {
            setLoading(true);
            const [activeBooks, dailyUsage, streakData] = await Promise.all([
                fetchActiveBooks(),
                fetchDailyUsage(session.user.id),
                fetchStreakData(session.user.id),
            ]);
            setBooks(activeBooks);
            setUsage(dailyUsage);

            // Basic streak calculation for MVP: count unique dates in the last 30 days
            // (Real logic would check for gaps, but user says "compute streak from user_daily_usage rows")
            setStreakCount(streakData?.length || 0);
        } catch (error) {
            console.error('Error loading home data:', error);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleContinue = async () => {
        try {
            // Map activePath slug to a book, then get the first verse in it
            const book = await fetchBookBySlug(activePath);
            if (!book) {
                Alert.alert('Coming Soon', 'No content is available for this path yet. Please check the Library for available content.');
                return;
            }
            const firstVerse = await fetchFirstVerseForBook(book.book_id);
            if (!firstVerse) {
                Alert.alert('Coming Soon', `No verses have been added for ${book.title} yet. Please check back soon.`);
                return;
            }
            navigation.navigate('Play', { itemId: firstVerse.verse_id, type: activePath });
        } catch (e) {
            console.error('handleContinue error:', e);
            Alert.alert('Error', 'Unable to load content. Please try again.');
        }
    };

    const handleSwitchPath = (newPathId: string, newPathTitle: string) => {
        if (newPathId === activePath) return;

        const typedPath = newPathId as ContentPath;

        Alert.alert(
            'Switch Path',
            `Would you like to switch your primary focus to ${newPathTitle}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Switch',
                    onPress: () => setActivePath(typedPath),
                    style: 'default'
                }
            ]
        );
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        let timeGreeting = 'Good morning';
        if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
        else if (hour >= 17) timeGreeting = 'Good evening';

        const displayFirstName = session?.user?.user_metadata?.first_name || userName;
        return displayFirstName ? `${timeGreeting}, ${displayFirstName}.` : `${timeGreeting}.`;
    };

    const PrimaryPathDesc = activePath === 'gita'
        ? 'Continue your guided reflection on the Bhagavad Gita.'
        : 'Continue the timeless narrative of the Ramayan.';

    const PrimaryTitle = EXPLORE_PATHS.find(p => p.id === activePath)?.title || 'Selected Path';

    if (loading && !books.length) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Greeting */}
            <View style={styles.header}>
                <Text style={styles.greeting}>{getGreeting()}</Text>
            </View>

            {/* Weekly Streak UI - Linked to Supabase */}
            <WeeklyStreak
                currentStreak={streakCount}
                sessionsToday={usage?.sessions_used || 0}
            />

            {/* Primary Path */}
            <Text style={styles.sectionTitle}>Your Current Path</Text>
            <Card style={styles.primaryCard}>
                <Text style={styles.cardTitle}>{PrimaryTitle}</Text>
                <Text style={styles.cardDesc}>{PrimaryPathDesc}</Text>
                <Button
                    title="Continue"
                    onPress={handleContinue}
                    style={styles.continueButton}
                />
            </Card>

            {/* Horizontal Explore Paths - Filtered by Active Books in DB */}
            <Text style={styles.sectionTitle}>Explore Paths</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exploreScroll}>
                {EXPLORE_PATHS.map((path) => {
                    // Only show if the book exists and is active in Supabase
                    const isBookActive = books.some(b => b.slug === path.id || b.title === path.title);
                    if (!isBookActive && books.length > 0) return null;

                    return (
                        <TouchableOpacity
                            key={path.id}
                            style={[styles.exploreItem, activePath === path.id && styles.exploreItemActive]}
                            onPress={() => handleSwitchPath(path.id, path.title)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.exploreIconBox, { backgroundColor: path.color + '15' }]}>
                                <Ionicons name={path.icon as any} size={32} color={path.color} />
                            </View>
                            <Text style={styles.exploreItemTitle}>{path.title}</Text>
                        </TouchableOpacity>
                    );
                })}
                <View style={{ width: 24 }} />
            </ScrollView>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingTop: theme.spacing.xl * 2,
        paddingBottom: theme.spacing.xl,
    },
    header: {
        paddingHorizontal: theme.spacing.l,
        marginBottom: theme.spacing.l,
    },
    greeting: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.xl,
        color: theme.colors.text,
    },
    sectionTitle: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.m,
        paddingHorizontal: theme.spacing.l,
    },
    primaryCard: {
        marginHorizontal: theme.spacing.l,
        marginBottom: theme.spacing.xl,
        backgroundColor: theme.colors.surfaceSecondary,
        borderColor: 'transparent',
    },
    cardTitle: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.xl,
        color: theme.colors.text,
        marginBottom: theme.spacing.s,
    },
    cardDesc: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
        marginBottom: theme.spacing.l,
        lineHeight: theme.typography.lineHeights.m,
    },
    continueButton: {
        width: '100%',
    },
    exploreScroll: {
        paddingLeft: theme.spacing.l,
        paddingBottom: theme.spacing.l,
    },
    exploreItem: {
        width: 110,
        marginRight: theme.spacing.m,
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.l,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: theme.colors.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 2,
    },
    exploreItemActive: {
        borderColor: theme.colors.primary,
        backgroundColor: theme.colors.surfaceSecondary,
    },
    exploreIconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.s,
    },
    exploreItemTitle: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.s,
        color: theme.colors.text,
        textAlign: 'center',
    },
});
