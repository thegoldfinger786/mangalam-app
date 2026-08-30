import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { BookCard } from '../components/BookCard';
import { LoadError } from '../components/LoadError';
import { ScreenHeader } from '../components/ScreenHeader';
import { Skeleton } from '../components/Skeleton';
import { VerseListRow } from '../components/VerseListRow';
import { bookTerms, formatRef } from '../lib/bookTerminology';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { COLLECTION_METADATA } from '../data/mockGita';
import { assertValidBookId } from '../lib/bookIdentity';
import { fetchActiveBooks, fetchVersesWithContent } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { logger } from '../lib/logger';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

export const LibraryScreen = () => {
    const { colors, spacing, typography, borderRadius, layout } = useTheme();
    const styles = useMemo(
        () => createStyles(spacing, typography, borderRadius),
        [spacing, typography, borderRadius],
    );
    const navigation = useNavigation<NavigationProp>();
    const [selectedBook, setSelectedBook] = useState<any | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [books, setBooks] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [booksError, setBooksError] = useState(false);
    const [itemsError, setItemsError] = useState(false);

    const { completedVerses, voicePreference } = useAppStore();
    const lang = voicePreference.startsWith('hindi') ? 'hi' : 'en';
    const terms = bookTerms(selectedBook?.book_id ?? selectedBook?.slug);

    useEffect(() => {
        loadBooks();
    }, []);

    const loadBooks = async () => {
        try {
            setLoading(true);
            setBooksError(false);
            const data = await fetchActiveBooks();
            setBooks(data);
        } catch (error) {
            logger.error('Failed to load books', { error });
            setBooksError(true);
        } finally {
            setLoading(false);
        }
    };

    const loadItems = async (book: any) => {
        try {
            setItemsLoading(true);
            setItemsError(false);
            const data = await fetchVersesWithContent(book.book_id, lang);
            setItems(data);
        } catch (error) {
            logger.error('Failed to load items', { error });
            setItemsError(true);
        } finally {
            setItemsLoading(false);
        }
    };

    useEffect(() => {
        setSearch('');
        if (selectedBook) {
            // Reload when the book changes or the content language changes
            // (voice preference switch) so titles match the chosen language.
            loadItems(selectedBook);
        } else {
            setItems([]);
        }
    }, [selectedBook, lang]);

    // Book-wide title search over the already-loaded verses (client-side only).
    const trimmedSearch = search.trim().toLowerCase();
    const searchResults = useMemo(() => {
        if (!trimmedSearch) return [];
        return items.filter((v) =>
            (v.title || '').toLowerCase().includes(trimmedSearch),
        );
    }, [items, trimmedSearch]);

    // Book-level overview: how far through, and the next unfinished unit.
    const bookOverview = useMemo(() => {
        if (items.length === 0) return null;
        const done = new Set(completedVerses);
        const completed = items.filter((v) => done.has(v.verse_id)).length;
        const chaptersTouched = new Set(
            items.filter((v) => done.has(v.verse_id)).map((v) => v.chapter_no),
        ).size;
        const ordered = [...items].sort(
            (a, b) => a.chapter_no - b.chapter_no || a.verse_no - b.verse_no,
        );
        const next = ordered.find((v) => !done.has(v.verse_id)) ?? ordered[ordered.length - 1];
        const allDone = completed >= items.length;
        return { completed, total: items.length, chaptersTouched, next, allDone };
    }, [items, completedVerses]);

    const handlePlayItem = (id: string) => {
        if (!assertValidBookId(selectedBook?.book_id, 'LibraryScreen.handlePlayItem')) {
            return;
        }
        navigation.navigate('Play', {
            itemId: id,
            bookId: selectedBook.book_id,
        });
    };

    // Start a chapter at its first unfinished unit (falls back to its first).
    const startChapter = (chapterVerses: any[]) => {
        const done = new Set(completedVerses);
        const ordered = [...chapterVerses].sort((a, b) => a.verse_no - b.verse_no);
        const target = ordered.find((v) => !done.has(v.verse_id)) ?? ordered[0];
        if (target) handlePlayItem(target.verse_id);
    };

    // ── Single verse row (shared by the chapter list and search results) ────
    const renderVerseRow = (verse: any, contextLabel: string) => {
        const isCompleted = completedVerses.includes(verse.verse_id);
        return (
            <VerseListRow
                key={verse.verse_id}
                badge={verse.verse_no}
                title={verse.title || verse.sanskrit || verse.reference || 'Verse'}
                subtitle={contextLabel}
                highlighted={isCompleted}
                onPress={() => handlePlayItem(verse.verse_id)}
                right={
                    isCompleted ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : undefined
                }
            />
        );
    };

    // ── Book-wide title search results ─────────────────────────────────────
    const renderSearchResults = () => {
        if (searchResults.length === 0) {
            return (
                <Text style={[styles.searchEmpty, { color: colors.textSecondary }]}>
                    No {terms.unit.toLowerCase()} titles match &ldquo;{search.trim()}&rdquo;.
                </Text>
            );
        }
        return (
            <View style={styles.listContainer}>
                {searchResults.map((verse) =>
                    renderVerseRow(verse, formatRef(selectedBook?.book_id, verse.chapter_no, verse.verse_no, ', ')),
                )}
            </View>
        );
    };

    // ── Chapter Grid (shown when a book is selected) ────────────────────────
    const renderVerseChapters = () => {
        const chapters: Record<number, any[]> = {};
        items.forEach(item => {
            if (!chapters[item.chapter_no]) chapters[item.chapter_no] = [];
            chapters[item.chapter_no].push(item);
        });

        const chapterNumbers = Object.keys(chapters).map(Number).sort((a, b) => a - b);

        if (selectedChapter === null) {
            return (
                <View style={styles.chapterGrid}>
                    {chapterNumbers.map((chNo) => {
                        const chapterVerses = chapters[chNo];
                        const completedInChapter = chapterVerses.filter(v =>
                            completedVerses.includes(v.verse_id),
                        ).length;
                        const totalInChapter = chapterVerses.length;
                        const isFullyDone =
                            completedInChapter === totalInChapter && totalInChapter > 0;

                        return (
                            <TouchableOpacity
                                key={chNo}
                                style={[
                                    styles.chapterTile,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.border,
                                        shadowColor: colors.cardShadow,
                                    },
                                    isFullyDone && {
                                        borderColor: colors.primary,
                                        backgroundColor: colors.primary + '08',
                                    },
                                ]}
                                onPress={() => setSelectedChapter(chNo)}
                                onLongPress={() => startChapter(chapterVerses)}
                            >
                                <TouchableOpacity
                                    style={styles.chapterStartBtn}
                                    hitSlop={8}
                                    onPress={() => startChapter(chapterVerses)}
                                    accessibilityLabel={`Start ${terms.group} ${chNo}`}
                                >
                                    <Ionicons name="play-circle" size={20} color={colors.primary} />
                                </TouchableOpacity>
                                <Text style={[styles.chapterTileTitle, { color: colors.text }]}>
                                    {terms.group} {chNo}
                                </Text>
                                <View
                                    style={[
                                        styles.tileProgressContainer,
                                        { backgroundColor: colors.surfaceSecondary },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.tileProgressBar,
                                            {
                                                backgroundColor: colors.primary,
                                                width: `${(completedInChapter / totalInChapter) * 100}%`,
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={[styles.tileProgressText, { color: colors.textSecondary }]}>
                                    {completedInChapter}/{totalInChapter}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            );
        }

        // ── Verse list for a specific chapter ───────────────────────────────
        const selectedVerses = chapters[selectedChapter] || [];

        return (
            <View style={styles.listContainer}>
                {/* The chapter name lives in the ScreenHeader while a chapter is open. */}
                {selectedVerses.map((verse) =>
                    renderVerseRow(verse, `${terms.unit} ${verse.verse_no}`),
                )}
            </View>
        );
    };

    // ── Selected-book detail view ────────────────────────────────────────────
    const renderSelectedBook = () => {
        const bookName =
            selectedBook.title_en ||
            selectedBook.title_hi ||
            selectedBook.title ||
            COLLECTION_METADATA[selectedBook.slug]?.title ||
            'Wisdom';

        const inChapter = selectedChapter !== null && !trimmedSearch;

        return (
            <>
                <ScreenHeader
                    title={inChapter ? `${terms.group} ${selectedChapter}` : bookName}
                    onBack={() => {
                        if (search) setSearch('');
                        else if (selectedChapter !== null) setSelectedChapter(null);
                        else setSelectedBook(null);
                    }}
                />
                <ScrollView
                    contentContainerStyle={{
                        backgroundColor: colors.background,
                        paddingHorizontal: spacing.l,
                        paddingTop: spacing.m,
                        paddingBottom: layout.miniPlayerHeight + spacing.m,
                    }}
                    showsVerticalScrollIndicator={false}
                >

                {itemsLoading ? (
                    <View style={styles.chapterGrid}>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <Skeleton
                                key={i}
                                width="31%"
                                height={110}
                                borderRadius={borderRadius.l}
                                style={{ marginBottom: spacing.m }}
                            />
                        ))}
                    </View>
                ) : itemsError ? (
                    <LoadError
                        style={{ paddingVertical: spacing.xxxl }}
                        onRetry={() => selectedBook && loadItems(selectedBook)}
                    />
                ) : (
                    <>
                        {!inChapter && !trimmedSearch && bookOverview && (
                            <View style={[styles.bookHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={[styles.bookHeroIcon, { backgroundColor: (COLLECTION_METADATA[selectedBook.slug]?.color || colors.primary) + '15' }]}>
                                    {getScriptureIcon(selectedBook.slug, 34, COLLECTION_METADATA[selectedBook.slug]?.color || colors.primary)}
                                </View>
                                <Text style={[styles.bookHeroProgress, { color: colors.textSecondary }]}>
                                    {bookOverview.completed === 0
                                        ? `${bookOverview.total} ${bookOverview.total === 1 ? terms.unit.toLowerCase() : terms.unit.toLowerCase() + 's'} to explore`
                                        : bookOverview.allDone
                                          ? `All ${bookOverview.total} ${terms.unit.toLowerCase()}s complete`
                                          : `${bookOverview.completed} of ${bookOverview.total} ${terms.unit.toLowerCase()}s · across ${bookOverview.chaptersTouched} ${bookOverview.chaptersTouched === 1 ? terms.group.toLowerCase() : terms.group.toLowerCase() + 's'}`}
                                </Text>
                                {bookOverview.next && (
                                    <TouchableOpacity
                                        style={[styles.bookHeroCta, { backgroundColor: colors.primary }]}
                                        onPress={() => handlePlayItem(bookOverview.next.verse_id)}
                                    >
                                        <Ionicons name="play" size={16} color={colors.textInverse} />
                                        <Text style={[styles.bookHeroCtaText, { color: colors.textInverse }]}>
                                            {bookOverview.completed === 0
                                                ? 'Begin'
                                                : bookOverview.allDone
                                                  ? `Replay ${terms.unit.toLowerCase()} ${bookOverview.next.verse_no}`
                                                  : `Continue · ${formatRef(selectedBook.book_id, bookOverview.next.chapter_no, bookOverview.next.verse_no)}`}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        {items.length > 0 && (
                            <View
                                style={[
                                    styles.searchBar,
                                    { backgroundColor: colors.surface, borderColor: colors.border },
                                ]}
                            >
                                <Ionicons name="search" size={18} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.text }]}
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder={`Search ${terms.unit.toLowerCase()} titles`}
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
                        {trimmedSearch ? renderSearchResults() : renderVerseChapters()}
                    </>
                )}
                </ScrollView>
            </>
        );
    };

    // ── Loading state — skeleton of the book grid ───────────────────────────
    if (loading) {
        return (
            <ScreenContainer
                edges={['top']}
                style={[styles.container, { backgroundColor: colors.background }]}
            >
                <View style={[styles.header, { backgroundColor: colors.background }]}>
                    <Skeleton width={120} height={typography.sizes.xxl} borderRadius={borderRadius.s} />
                </View>
                <View style={styles.skeletonGrid}>
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton
                            key={i}
                            width="47%"
                            height={150}
                            borderRadius={borderRadius.l}
                            style={{ marginBottom: spacing.m }}
                        />
                    ))}
                </View>
            </ScreenContainer>
        );
    }

    if (booksError) {
        return (
            <ScreenContainer
                edges={['top']}
                style={[styles.container, { backgroundColor: colors.background }]}
            >
                <LoadError onRetry={loadBooks} />
            </ScreenContainer>
        );
    }

    // ── Main render ──────────────────────────────────────────────────────────
    return (
        <ScreenContainer
            edges={['top']}
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            {selectedBook === null ? (
                /*
                 * Book selection grid — FlatList with numColumns=2
                 * Matches HomeScreen "Explore Paths" grid exactly.
                 */
                <FlatList
                    data={books}
                    keyExtractor={(item) => item.book_id}
                    numColumns={2}
                    columnWrapperStyle={styles.columnWrapper}
                    contentContainerStyle={[
                        styles.gridContent,
                        { paddingBottom: layout.miniPlayerHeight + spacing.m },
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <View style={[styles.header, { backgroundColor: colors.background }]}>
                            <Text style={[styles.screenTitle, { color: colors.text }]}>
                                Library
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const meta = COLLECTION_METADATA[item.slug] || {
                            icon: 'book',
                            color: colors.primary,
                        };
                        return (
                            <BookCard
                                icon={getScriptureIcon(item.slug, spacing.xl, meta.color)}
                                title={
                                    item.title_en || item.title_hi || item.title || meta.title
                                }
                                onPress={() => setSelectedBook(item)}
                                accentColor={meta.color}
                            />
                        );
                    }}
                />
            ) : (
                renderSelectedBook()
            )}
        </ScreenContainer>
    );
};

// ── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (
    spacing: ReturnType<typeof useTheme>['spacing'],
    typography: ReturnType<typeof useTheme>['typography'],
    borderRadius: ReturnType<typeof useTheme>['borderRadius'],
) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },

        // ── Library header (used as FlatList ListHeaderComponent) ──
        header: {
            padding: spacing.l,
            paddingTop: spacing.m,
        },
        skeletonGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.l,
        },
        screenTitle: {
            fontSize: typography.sizes.xxl,
            fontWeight: 'bold',
        },

        // ── 2-column FlatList grid ─────────────────────────────────
        columnWrapper: {
            paddingHorizontal: spacing.l,
            gap: spacing.m,
        },
        gridContent: {
            paddingTop: spacing.m,
        },

        // ── Book overview hero ─────────────────────────────────────
        bookHero: {
            alignItems: 'center',
            padding: spacing.l,
            borderRadius: borderRadius.l,
            borderWidth: 1,
            marginBottom: spacing.m,
        },
        bookHeroIcon: {
            width: 64,
            height: 64,
            borderRadius: borderRadius.round,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.m,
        },
        bookHeroProgress: {
            fontSize: typography.sizes.s,
            textAlign: 'center',
            marginBottom: spacing.m,
        },
        bookHeroCta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.s,
            paddingHorizontal: spacing.l,
            paddingVertical: spacing.s,
            borderRadius: borderRadius.round,
        },
        bookHeroCtaText: {
            fontSize: typography.sizes.s,
            fontWeight: '600',
        },
        chapterStartBtn: {
            position: 'absolute',
            top: spacing.xs,
            right: spacing.xs,
        },

        // ── Verse-title search ─────────────────────────────────────
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
        searchInput: {
            flex: 1,
            fontSize: typography.sizes.m,
            padding: 0,
        },
        searchEmpty: {
            fontSize: typography.sizes.m,
            lineHeight: typography.sizes.m * 1.4,
            paddingTop: spacing.l,
            textAlign: 'center',
        },

        // ── Verse list ─────────────────────────────────────────────
        listContainer: {
            paddingTop: spacing.m,
        },

        // ── Chapter tile grid ──────────────────────────────────────
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
            // iOS shadow
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
        },
        chapterTileTitle: {
            fontSize: typography.sizes.m,
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: spacing.s,
        },
        tileProgressContainer: {
            width: '80%',
            height: spacing.xs,
            borderRadius: borderRadius.s,
            overflow: 'hidden',
            marginBottom: spacing.xs,
        },
        tileProgressBar: {
            height: '100%',
        },
        tileProgressText: {
            fontSize: typography.sizes.xs,
        },
    });
