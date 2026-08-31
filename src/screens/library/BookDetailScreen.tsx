import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { LoadError } from '../../components/LoadError';
import { ScreenHeader } from '../../components/ScreenHeader';
import { getScriptureIcon } from '../../components/ScriptureIcons';
import { Skeleton } from '../../components/Skeleton';
import { COLLECTION_METADATA } from '../../data/collectionMetadata';
import { assertValidBookId } from '../../lib/bookIdentity';
import { bookTerms, formatRef } from '../../lib/bookTerminology';
import { navigationRef } from '../../navigation/navigationRef';
import { LibraryStackParamList } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../theme';
import { LibraryVerseRow } from './LibraryVerseRow';
import { useBookVerses } from './useBookVerses';

type Nav = NativeStackNavigationProp<LibraryStackParamList, 'BookDetail'>;

export const BookDetailScreen = () => {
    const { colors, spacing, typography, borderRadius, layout } = useTheme();
    const styles = useMemo(() => createStyles(spacing, borderRadius), [spacing, borderRadius]);
    const navigation = useNavigation<Nav>();
    const { book } = useRoute<RouteProp<LibraryStackParamList, 'BookDetail'>>().params;

    const completedVerses = useAppStore((s) => s.completedVerses);
    const lang = useAppStore((s) => s.voicePreference).startsWith('hindi') ? 'hi' : 'en';
    const terms = bookTerms(book.bookId ?? book.slug);
    const accent = COLLECTION_METADATA[book.slug]?.color || colors.primary;

    const { verses, loading, error, reload } = useBookVerses(book.bookId, lang);
    const [search, setSearch] = useState('');
    const trimmedSearch = search.trim().toLowerCase();

    const chapters = useMemo(() => {
        const byChapter: Record<number, any[]> = {};
        verses.forEach((v) => {
            (byChapter[v.chapter_no] ??= []).push(v);
        });
        return byChapter;
    }, [verses]);
    const chapterNumbers = useMemo(
        () => Object.keys(chapters).map(Number).sort((a, b) => a - b),
        [chapters],
    );

    const overview = useMemo(() => {
        if (verses.length === 0) return null;
        const done = new Set(completedVerses);
        const completed = verses.filter((v) => done.has(v.verse_id)).length;
        const chaptersTouched = new Set(verses.filter((v) => done.has(v.verse_id)).map((v) => v.chapter_no)).size;
        const ordered = [...verses].sort((a, b) => a.chapter_no - b.chapter_no || a.verse_no - b.verse_no);
        const next = ordered.find((v) => !done.has(v.verse_id)) ?? ordered[ordered.length - 1];
        return { completed, total: verses.length, chaptersTouched, next, allDone: completed >= verses.length };
    }, [verses, completedVerses]);

    const searchResults = useMemo(() => {
        if (!trimmedSearch) return [];
        return verses.filter((v) => (v.title || '').toLowerCase().includes(trimmedSearch));
    }, [verses, trimmedSearch]);

    const openPlay = (verseId: string) => {
        if (!assertValidBookId(book.bookId, 'BookDetailScreen.openPlay')) return;
        navigationRef.navigate('Play', { itemId: verseId, bookId: book.bookId });
    };

    // Start a chapter at its first unfinished unit (falls back to its first).
    const startChapter = (chapterVerses: any[]) => {
        const done = new Set(completedVerses);
        const ordered = [...chapterVerses].sort((a, b) => a.verse_no - b.verse_no);
        const target = ordered.find((v) => !done.has(v.verse_id)) ?? ordered[0];
        if (target) openPlay(target.verse_id);
    };

    const unit = terms.unit.toLowerCase();
    const group = terms.group.toLowerCase();

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title={book.title}
                onBack={search ? () => setSearch('') : undefined}
            />
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: spacing.l,
                    paddingTop: spacing.m,
                    paddingBottom: layout.miniPlayerHeight + spacing.m,
                }}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.chapterGrid}>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} width="31%" height={110} borderRadius={borderRadius.l} style={{ marginBottom: spacing.m }} />
                        ))}
                    </View>
                ) : error ? (
                    <LoadError style={{ paddingVertical: spacing.xxxl }} onRetry={reload} />
                ) : (
                    <>
                        {!trimmedSearch && overview && (
                            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={[styles.heroIcon, { backgroundColor: accent + '15' }]}>
                                    {getScriptureIcon(book.slug, 34, accent)}
                                </View>
                                <AppText variant="bodySmall" style={[styles.heroProgress, { color: colors.textSecondary }]}>
                                    {overview.completed === 0
                                        ? `${overview.total} ${overview.total === 1 ? unit : unit + 's'} to explore`
                                        : overview.allDone
                                          ? `All ${overview.total} ${unit}s complete`
                                          : `${overview.completed} of ${overview.total} ${unit}s · across ${overview.chaptersTouched} ${overview.chaptersTouched === 1 ? group : group + 's'}`}
                                </AppText>
                                {overview.next && (
                                    <TouchableOpacity
                                        style={[styles.heroCta, { backgroundColor: colors.primary }]}
                                        onPress={() => openPlay(overview.next.verse_id)}
                                    >
                                        <Ionicons name="play" size={16} color={colors.textInverse} />
                                        <AppText variant="bodySmall" style={{ color: colors.textInverse, fontFamily: typography.fontFamilies.semiBold }}>
                                            {overview.completed === 0
                                                ? 'Begin'
                                                : overview.allDone
                                                  ? `Replay ${unit} ${overview.next.verse_no}`
                                                  : `Continue · ${formatRef(book.bookId, overview.next.chapter_no, overview.next.verse_no)}`}
                                        </AppText>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {verses.length > 0 && (
                            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Ionicons name="search" size={18} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.text, fontSize: typography.sizes.m }]}
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder={`Search ${unit} titles`}
                                    placeholderTextColor={colors.textSecondary}
                                    returnKeyType="search"
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                />
                                {search.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {trimmedSearch ? (
                            searchResults.length === 0 ? (
                                <AppText variant="body" style={[styles.searchEmpty, { color: colors.textSecondary }]}>
                                    No {unit} titles match &ldquo;{search.trim()}&rdquo;.
                                </AppText>
                            ) : (
                                <View style={styles.list}>
                                    {searchResults.map((v) => (
                                        <LibraryVerseRow
                                            key={v.verse_id}
                                            verse={v}
                                            bookId={book.bookId}
                                            contextLabel={formatRef(book.bookId, v.chapter_no, v.verse_no, ', ')}
                                        />
                                    ))}
                                </View>
                            )
                        ) : (
                            <View style={styles.chapterGrid}>
                                {chapterNumbers.map((chNo) => {
                                    const cv = chapters[chNo];
                                    const doneCount = cv.filter((v) => completedVerses.includes(v.verse_id)).length;
                                    const total = cv.length;
                                    const fullyDone = doneCount === total && total > 0;
                                    return (
                                        <TouchableOpacity
                                            key={chNo}
                                            style={[
                                                styles.chapterTile,
                                                { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.cardShadow },
                                                fullyDone && { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
                                            ]}
                                            onPress={() => navigation.navigate('ChapterVerses', { book, chapterNo: chNo })}
                                            onLongPress={() => startChapter(cv)}
                                        >
                                            <TouchableOpacity
                                                style={styles.chapterStartBtn}
                                                hitSlop={8}
                                                onPress={() => startChapter(cv)}
                                                accessibilityLabel={`Start ${terms.group} ${chNo}`}
                                            >
                                                <Ionicons name="play-circle" size={20} color={colors.primary} />
                                            </TouchableOpacity>
                                            <AppText variant="body" style={[styles.chapterTitle, { color: colors.text, fontFamily: typography.fontFamilies.semiBold }]}>
                                                {terms.group} {chNo}
                                            </AppText>
                                            <View style={[styles.tileProgress, { backgroundColor: colors.surfaceSecondary }]}>
                                                <View style={[styles.tileProgressBar, { backgroundColor: colors.primary, width: `${(doneCount / total) * 100}%` }]} />
                                            </View>
                                            <AppText variant="label" style={{ color: colors.textSecondary }}>{doneCount}/{total}</AppText>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </ScreenContainer>
    );
};

const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
    borderRadius: ReturnType<typeof useTheme>['borderRadius'],
) =>
    StyleSheet.create({
        container: { flex: 1 },
        hero: {
            alignItems: 'center',
            padding: spacing.l,
            borderRadius: borderRadius.l,
            borderWidth: 1,
            marginBottom: spacing.m,
        },
        heroIcon: {
            width: 64,
            height: 64,
            borderRadius: borderRadius.round,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.m,
        },
        heroProgress: {
            textAlign: 'center',
            marginBottom: spacing.m,
        },
        heroCta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s,
            paddingHorizontal: spacing.l,
            paddingVertical: spacing.s,
            borderRadius: borderRadius.round,
        },
        searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s,
            paddingHorizontal: spacing.m,
            paddingVertical: spacing.s,
            borderRadius: borderRadius.l,
            borderWidth: 1,
            marginBottom: spacing.m,
        },
        searchInput: { flex: 1, padding: 0 },
        searchEmpty: { paddingTop: spacing.l, textAlign: 'center' },
        list: { paddingTop: spacing.m },
        chapterGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingTop: spacing.m,
            justifyContent: 'space-between',
        },
        chapterTile: {
            width: '31%',
            aspectRatio: 1,
            borderRadius: borderRadius.l,
            borderWidth: 1,
            padding: spacing.m,
            marginBottom: spacing.m,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
        },
        chapterStartBtn: {
            position: 'absolute',
            top: spacing.xs,
            right: spacing.xs,
        },
        chapterTitle: {
            textAlign: 'center',
            marginBottom: spacing.s,
        },
        tileProgress: {
            width: '80%',
            height: spacing.xs,
            borderRadius: borderRadius.s,
            overflow: 'hidden',
            marginBottom: spacing.xs,
        },
        tileProgressBar: { height: '100%' },
    });
