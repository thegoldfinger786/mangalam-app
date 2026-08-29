import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { Skeleton } from '../components/Skeleton';
import { assertValidBookId } from '../lib/bookIdentity';
import { fetchTopContent } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { logger } from '../lib/logger';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CommunityWisdomScreen = () => {
    const { colors, spacing } = useTheme();
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
            logger.error('Failed to load wisdom data', { error });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <ScreenContainer
                edges={['top']}
                style={[styles.container, { backgroundColor: colors.background, paddingHorizontal: spacing.l, paddingTop: spacing.xl }]}
            >
                <Skeleton width="70%" height={26} borderRadius={6} style={{ marginBottom: spacing.s }} />
                <Skeleton width="90%" height={16} borderRadius={4} style={{ marginBottom: spacing.xl }} />
                {[0, 1].map((s) => (
                    <View key={s} style={{ marginBottom: spacing.xl }}>
                        <Skeleton width={160} height={20} borderRadius={4} style={{ marginBottom: spacing.m }} />
                        {[0, 1, 2].map((r) => (
                            <Skeleton key={r} width="100%" height={64} borderRadius={12} style={{ marginBottom: spacing.s }} />
                        ))}
                    </View>
                ))}
            </ScreenContainer>
        );
    }

    const sections = [
        { label: 'Others are listening to', data: topStats.listened, icon: 'headset-outline' },
        { label: 'Others are sharing', data: topStats.shared, icon: 'share-social-outline' },
        { label: 'Others are keeping', data: topStats.bookmarked, icon: 'bookmark-outline' },
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
                        A quiet look at the verses others are finding meaningful.
                    </Text>
                </View>

                {sections.map((section, idx) => section.data.length > 0 && (
                    <View key={idx} style={styles.statSection}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name={section.icon as any} size={22} color={colors.primary} />
                            <Text style={[styles.sectionLabel, { color: colors.text }]}>{section.label}</Text>
                        </View>

                        {section.data.map((item, i) => {
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.wisdomCard,
                                        { backgroundColor: colors.surface, borderColor: colors.border },
                                    ]}
                                    onPress={() => {
                                        if (!assertValidBookId(item.book_id, 'CommunityWisdomScreen.onPress')) {
                                            logger.error('CommunityWisdom missing playback identity', { context: { item } });
                                            Alert.alert('Playback unavailable', 'This item is missing book context.');
                                            return;
                                        }

                                        navigation.navigate('Play', {
                                            itemId: item.content_id,
                                            bookId: item.book_id,
                                        });
                                    }}
                                >
                                    <View style={styles.cardHeader}>
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
        fontSize: 22,
        fontWeight: '700',
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
        fontSize: 15,
        fontWeight: '600',
        marginLeft: spacing.s,
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
});
