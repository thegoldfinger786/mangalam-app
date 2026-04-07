import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { fetchTopContent } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { ScreenContainer } from '../components/layout/ScreenContainer';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CommunityWisdomScreen = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const navigation = useNavigation<NavigationProp>();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
    const [loading, setLoading] = useState(true);
    const [topStats, setTopStats] = useState<{
        listened: any[],
        shared: any[],
        bookmarked: any[]
    }>({ listened: [], shared: [], bookmarked: [] });

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [listened, shared, bookmarked] = await Promise.all([
                fetchTopContent('listen', 5),
                fetchTopContent('share', 5),
                fetchTopContent('bookmark', 5)
            ]);
            setTopStats({ listened, shared, bookmarked });
        } catch (error) {
            console.error('Error loading wisdom data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </ScreenContainer>
        );
    }

    const sections = [
        { label: 'Trending Now', data: topStats.listened, icon: 'flame-outline', action: 'listens' },
        { label: 'Most Inspired', data: topStats.shared, icon: 'rocket-outline', action: 'shares' },
        { label: 'Top Saved', data: topStats.bookmarked, icon: 'heart-outline', action: 'saves' }
    ];

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingHorizontal: spacing.m, paddingTop: spacing.m }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <Ionicons name="chevron-back" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Community Wisdom</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.introSection}>
                    <Text style={[styles.title, { color: colors.text }]}>Ancient Wisdom in Modern Hearts</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Discover what fellow seekers are finding inspired by.
                    </Text>
                </View>

                {sections.map((section, idx) => section.data.length > 0 && (
                    <View key={idx} style={styles.statSection}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name={section.icon as any} size={22} color={colors.primary} />
                            <Text style={[styles.sectionLabel, { color: colors.text }]}>{section.label}</Text>
                        </View>

                        {section.data.map((item, i) => {
                            const rank = i + 1;
                            const medalColors: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
                            const medalColor = medalColors[rank];
                            const isTopThree = rank <= 3;

                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.wisdomCard,
                                        { backgroundColor: colors.surface, borderColor: colors.border },
                                        isTopThree && { borderColor: (medalColor || colors.border) + '40' }
                                    ]}
                                    onPress={() => navigation.navigate('Play', { itemId: item.content_id, type: item.book_slug as any })}
                                >
                                    <View style={styles.cardHeader}>
                                        {/* Rank Badge */}
                                        <View style={[
                                            styles.rankBadge,
                                            { backgroundColor: isTopThree ? medalColor + '20' : colors.surfaceSecondary }
                                        ]}>
                                            {isTopThree && (
                                                <Ionicons
                                                    name={rank === 1 ? 'trophy' : 'medal'}
                                                    size={12}
                                                    color={medalColor}
                                                    style={{ marginBottom: spacing.micro }}
                                                />
                                            )}
                                            <Text style={[
                                                styles.rankText,
                                                { color: isTopThree ? medalColor : colors.textSecondary }
                                            ]}>
                                                #{rank}
                                            </Text>
                                        </View>

                                        <View style={styles.cardInfo}>
                                            <View style={styles.bookTag}>
                                                <View style={[styles.miniIconBox, { backgroundColor: colors.surfaceSecondary }]}>
                                                    {getScriptureIcon(item.book_slug, 12, colors.primary)}
                                                </View>
                                                <Text style={[styles.bookName, { color: colors.primary }]}>{item.title}</Text>
                                            </View>
                                            <Text style={[styles.verseTitle, { color: colors.text }]} numberOfLines={1}>
                                                {item.subtitle}
                                            </Text>
                                        </View>

                                        <Ionicons name="chevron-forward" size={18} color={colors.border} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>
        </ScreenContainer>
    );
};

const createStyles = (spacing: ReturnType<typeof useTheme>['spacing']) => StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    iconButton: {
        padding: spacing.xs,
    },
    scrollContent: {
        paddingHorizontal: spacing.l,
        paddingBottom: spacing.xxxl,
    },
    introSection: {
        marginTop: spacing.m,
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: spacing.s,
    },
    subtitle: {
        fontSize: 16,
        lineHeight: 24,
    },
    statSection: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.m,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '700',
        marginLeft: spacing.s,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    wisdomCard: {
        padding: spacing.m,
        borderRadius: 20,
        marginBottom: spacing.m,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardInfo: {
        flex: 1,
        marginRight: spacing.m,
    },
    bookTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    miniIconBox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.s,
    },
    bookName: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    verseTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    badge: {
        paddingHorizontal: spacing.s,
        paddingVertical: spacing.xs,
        borderRadius: 10,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    rankBadge: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.m,
    },
    rankText: {
        fontSize: 12,
        fontWeight: '800',
    },
});
