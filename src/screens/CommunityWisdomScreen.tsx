import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { AppText } from '../components/AppText';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { LoadError } from '../components/LoadError';
import { ScreenHeader } from '../components/ScreenHeader';
import { Skeleton } from '../components/Skeleton';
import { assertValidBookId } from '../lib/bookIdentity';
import { fetchTopContent } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { logger } from '../lib/logger';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CommunityWisdomScreen = () => {
    const { colors, spacing, typography } = useTheme();
    const navigation = useNavigation<NavigationProp>();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
    const lang = useAppStore(s => s.voicePreference).startsWith('hindi') ? 'hi' : 'en';
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [topStats, setTopStats] = useState<{
        listened: any[],
        shared: any[],
        bookmarked: any[]
    }>({ listened: [], shared: [], bookmarked: [] });

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setLoadError(false);
            const [listened, shared, bookmarked] = await Promise.all([
                fetchTopContent('listen', 5, lang),
                fetchTopContent('share', 5, lang),
                fetchTopContent('bookmark', 5, lang)
            ]);
            setTopStats({ listened, shared, bookmarked });
        } catch (error) {
            logger.error('Failed to load wisdom data', { error });
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [lang]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Community Wisdom" variant="modal" />
                <View style={{ paddingHorizontal: spacing.l, paddingTop: spacing.xl }}>
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
                </View>
            </ScreenContainer>
        );
    }

    if (loadError) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Community Wisdom" variant="modal" />
                <LoadError onRetry={loadData} />
            </ScreenContainer>
        );
    }

    const sections = [
        { label: 'Others are listening to', data: topStats.listened, icon: 'headset-outline' },
        { label: 'Others are sharing', data: topStats.shared, icon: 'share-social-outline' },
        { label: 'Others are keeping', data: topStats.bookmarked, icon: 'bookmark-outline' },
    ];

    const isEmpty = sections.every(s => s.data.length === 0);

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Community Wisdom" variant="modal" />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.introSection}>
                    <AppText variant="title" style={[styles.title, { color: colors.text }]}>Ancient Wisdom in Modern Hearts</AppText>
                    <AppText variant="body" style={{ color: colors.textSecondary }}>
                        A quiet look at the verses others are finding meaningful.
                    </AppText>
                </View>

                {isEmpty ? (
                    <AppText variant="body" style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Nothing here yet. As people spend time with verses, the ones they return to will show up here.
                    </AppText>
                ) : null}

                {sections.map((section, idx) => section.data.length > 0 && (
                    <View key={idx} style={styles.statSection}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name={section.icon as any} size={22} color={colors.primary} />
                            <AppText variant="subheading" style={[styles.sectionLabel, { color: colors.text }]}>{section.label}</AppText>
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
                                            Alert.alert('Unavailable', "We couldn't open this verse.");
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
                                                <AppText
                                                    variant="label"
                                                    style={[styles.bookName, { color: colors.primary, fontFamily: typography.fontFamilies.semiBold }]}
                                                >
                                                    {item.title}  ·  {item.subtitle}
                                                </AppText>
                                            </View>
                                            {item.verse_title ? (
                                                <AppText
                                                    variant="body"
                                                    style={{ color: colors.text, fontFamily: typography.fontFamilies.semiBold }}
                                                    numberOfLines={2}
                                                >
                                                    {item.verse_title}
                                                </AppText>
                                            ) : null}
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
    scrollContent: {
        paddingHorizontal: spacing.l,
        paddingBottom: spacing.xxxl,
    },
    introSection: {
        marginTop: spacing.m,
        marginBottom: spacing.xl,
    },
    title: {
        marginBottom: spacing.s,
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
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emptyText: {
        marginTop: spacing.s,
    },
});
