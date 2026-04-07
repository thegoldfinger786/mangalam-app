import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { WeeklyStreak } from '../components/WeeklyStreak';
import { ContentPath } from '../data/types';
import { fetchActiveBooks, fetchDailyUsage, fetchStreakData, fetchUserProgress } from '../lib/queries';
import { supabase } from '../lib/supabase';
import { ROUTES } from '../navigation/routes';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { DynamicBackground } from '../components/DynamicBackground';
import { Skeleton } from '../components/Skeleton';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { useTheme } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

const EXPLORE_PATHS = [
    { id: 'gita', title: 'Bhagavad Gita', icon: 'book-outline', color: '#E88B4A' },
    { id: 'ramayan', title: 'Ramayan', icon: 'navigate-outline', color: '#DE5D3D' },
    { id: 'mahabharat', title: 'Mahabharat', icon: 'flash-outline', color: '#D6A621' },
    { id: 'shiv_puran', title: 'Shiv Puran', icon: 'moon-outline', color: '#5C7485', isComingSoon: true },
    { id: 'upanishads', title: 'Upanishads', icon: 'leaf-outline', color: '#568E65', isComingSoon: true },
];

export const HomeScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const { session, activePath, setActivePath, userName, setUserName } = useAppStore();
    const { colors, spacing, typography } = useTheme();
    console.log('HomeScreen loaded');

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
                fetchStreakData(session.user.id)
            ]);

            if (!userName) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('display_name')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profile?.display_name) {
                    setUserName(profile.display_name);
                }
            }

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
    }, [session, setUserName, userName]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleOpenPath = async () => {
        console.log('handleOpenPath START');

        try {
            const progress = session?.user?.id
                ? await fetchUserProgress(session.user.id)
                : null;

            console.log('User progress:', progress);

            if (progress?.bookId && progress?.verseId) {
                console.log('Navigating to PLAY:', progress);
                navigation.navigate(ROUTES.PLAY, {
                    bookId: progress.bookId,
                    verseId: progress.verseId,
                    position: progress.position,
                });
                return;
            }

            const { activePath } = useAppStore.getState();

            navigation.navigate(ROUTES.BOOK_DASHBOARD, {
                type: activePath ?? 'ramayan',
            });
        } catch (e) {
            console.log('Continue error:', e);
            navigation.navigate(ROUTES.BOOK_DASHBOARD, {
                type: 'ramayan',
            });
        }
    };

    const handlePathPress = (pathId: string, pathTitle: string) => {
        if (pathId === activePath) {
            handleOpenPath();
        } else {
            console.log('Alert triggered');
            Alert.alert(
                'Change Path?',
                `You are currently focused on the ${PrimaryTitle} path. Subtle persistence leads to deeper wisdom. Are you sure you want to change paths?`,
                [
                    { text: 'Stay Focused', style: 'cancel' },
                    {
                        text: 'Change Path',
                        onPress: () => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setActivePath(pathId as any);
                            navigation.navigate(ROUTES.BOOK_DASHBOARD, { type: pathId });
                        }
                    }
                ]
            );
        }
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
        : activePath === 'ramayan'
        ? 'Continue the timeless narrative of the Ramayan.'
        : 'Explore the grand epic of the Mahabharat.';

    const PrimaryTitle = EXPLORE_PATHS.find(p => p.id === activePath)?.title || 'Selected Path';
    console.log('handleOpenPath exists:', typeof handleOpenPath);

    if (loading && !books.length) {
        return (
            <DynamicBackground style={styles.container}>
                <ScreenContainer edges={['top']} style={styles.container}>
                    {/* Header Skeleton */}
                    <View style={[styles.header, { marginTop: 16 }]}>
                    <Skeleton width={120} height={28} borderRadius={4} />
                    <Skeleton width={100} height={28} borderRadius={4} style={{ marginLeft: 8 }} />
                </View>

                {/* Discovery Bar Skeleton */}
                <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
                    <Skeleton width="100%" height={56} borderRadius={16} />
                </View>

                {/* Primary Card Skeleton */}
                <View style={[styles.section, { paddingHorizontal: 24 }]}>
                    <Skeleton width={150} height={22} borderRadius={4} style={{ marginBottom: 16 }} />
                    <Skeleton width="100%" height={160} borderRadius={20} />
                </View>

                {/* Weekly Streak Skeleton */}
                <View style={[styles.section, { paddingHorizontal: 24, marginTop: 16 }]}>
                    <Skeleton width="100%" height={120} borderRadius={20} />
                </View>
                </ScreenContainer>
            </DynamicBackground>
        );
    }

    return (
        <DynamicBackground style={styles.container}>
            <ScreenContainer edges={['top']} style={styles.container}>
                <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.greeting, { color: colors.textSecondary }]}>Namaste, </Text>
                    <Text style={[styles.userName, { color: colors.text }]}>{userName || 'Seeker'}</Text>
                </View>

                {/* Community Discovery Bar */}
                <TouchableOpacity
                    style={[styles.discoveryBar, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => navigation.navigate('CommunityWisdom')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.discoveryIconBox, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="sparkles" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.discoveryText, { color: colors.textSecondary }]}>
                        See what others are studying today
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>

                {/* Current Path Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>My Current Path</Text>
                    <TouchableOpacity activeOpacity={0.85} onPress={() => handleOpenPath?.()}>
                        <Card style={[
                            styles.primaryCard,
                            {
                                backgroundColor: 'transparent',
                                borderColor: (EXPLORE_PATHS.find(p => p.id === activePath)?.color || colors.primary),
                                borderWidth: 1.5,
                                elevation: 0,
                                shadowOpacity: 0
                            }
                        ]}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardInfo}>
                                    <Text style={[styles.cardTitle, { color: colors.text }]}>{PrimaryTitle}</Text>
                                    <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{PrimaryPathDesc}</Text>
                                </View>
                                <View style={[styles.cardIconBox, { backgroundColor: (EXPLORE_PATHS.find(p => p.id === activePath)?.color || colors.primary) + '15' }]}>
                                    {getScriptureIcon(activePath, 32, EXPLORE_PATHS.find(p => p.id === activePath)?.color || colors.primary)}
                                </View>
                            </View>
                            <Button
                                title="Continue"
                                onPress={() => handleOpenPath?.()}
                                style={styles.continueButton}
                            />
                        </Card>
                    </TouchableOpacity>
                </View>

                {/* Weekly Streak UI - Linked to Supabase */}
                <WeeklyStreak
                    currentStreak={streakCount}
                    sessionsToday={usage?.sessions_used || 0}
                />

                {/* Explore Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Explore Paths</Text>
                    <View style={styles.exploreGrid}>
                        {EXPLORE_PATHS.map((path) => (
                            <TouchableOpacity
                                key={path.id}
                                style={[
                                    styles.exploreItem,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: activePath === path.id ? path.color : colors.border,
                                        borderWidth: activePath === path.id ? 2 : 1,
                                        opacity: (path as any).isComingSoon ? 0.6 : 1
                                    }
                                ]}
                                onPress={() => handlePathPress(path.id, path.title)}
                            >
                                <View style={[styles.exploreIconBox, { backgroundColor: path.color + '15' }]}>
                                    {getScriptureIcon(path.id, 28, path.color)}
                                </View>
                                <Text style={[styles.exploreItemTitle, { color: colors.text }]}>{path.title}</Text>
                                {(path as any).isComingSoon && (
                                    <View style={[styles.miniBadge, { backgroundColor: colors.surfaceSecondary }]}>
                                        <Text style={[styles.miniBadgeText, { color: colors.textTertiary }]}>Soon</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>
            </ScreenContainer>
        </DynamicBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingTop: 16,
        paddingBottom: 32,
    },
    header: {
        paddingHorizontal: 24,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    greeting: {
        fontSize: 24,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        marginBottom: 16,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    discoveryBar: {
        marginHorizontal: 24,
        marginBottom: 24,
        padding: 12,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    discoveryIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    discoveryText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    primaryCard: {
        marginHorizontal: 24,
        marginBottom: 32,
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    cardInfo: {
        flex: 1,
        marginRight: 16,
    },
    cardIconBox: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 15,
        lineHeight: 22,
    },
    continueButton: {
        width: '100%',
    },
    exploreGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 24,
        justifyContent: 'space-between',
    },
    exploreItem: {
        width: '48%',
        marginBottom: 16,
        padding: 20, // Increased from 16 for better breathing room
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    exploreIconBox: {
        width: 64, // Slightly increased
        height: 64, // Slightly increased
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12, // Increased from 8
    },
    sectionSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    exploreItemTitle: {
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    },
    statGroup: {
        marginBottom: 28,
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '700',
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statCard: {
        width: 220,
        padding: 16,
        borderRadius: 20,
        marginRight: 16,
        borderWidth: 1,
        // Premium shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    statCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    miniIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    actionBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    statCardTitle: {
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 20,
        marginBottom: 4,
        height: 40, // Ensure fixed height for 2 lines
    },
    statCardSubtitle: {
        fontSize: 12,
        fontWeight: '500',
    },
    miniBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    miniBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    }
});
