import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BookCard } from '../components/BookCard';
import { Skeleton } from '../components/Skeleton';
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
    const [books, setBooks] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);

    const { completedVerses, voicePreference } = useAppStore();
    const lang = voicePreference.startsWith('hindi') ? 'hi' : 'en';

    useEffect(() => {
        loadBooks();
    }, []);

    const loadBooks = async () => {
        try {
            setLoading(true);
            const data = await fetchActiveBooks();
            setBooks(data);
        } catch (error) {
            logger.error('Failed to load books', { error });
        } finally {
            setLoading(false);
        }
    };

    const loadItems = async (book: any) => {
        try {
            setItemsLoading(true);
            const data = await fetchVersesWithContent(book.book_id, lang);
            setItems(data);
        } catch (error) {
            logger.error('Failed to load items', { error });
        } finally {
            setItemsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedBook) {
            loadItems(selectedBook);
        } else {
            setItems([]);
        }
    }, [selectedBook]);

    const handlePlayItem = (id: string) => {
        if (!assertValidBookId(selectedBook?.book_id, 'LibraryScreen.handlePlayItem')) {
            return;
        }
        navigation.navigate('Play', {
            itemId: id,
            bookId: selectedBook.book_id,
        });
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
                                onLongPress={() => {
                                    const firstVerse = chapterVerses.sort(
                                        (a, b) => a.verse_no - b.verse_no,
                                    )[0];
                                    if (firstVerse) handlePlayItem(firstVerse.verse_id);
                                }}
                            >
                                <Text style={[styles.chapterTileTitle, { color: colors.text }]}>
                                    Chapter {chNo}
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
                {/* Chapter header — rounded container using theme tokens only */}
                <View
                    style={[
                        styles.verseHeaderChapter,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <Text style={[styles.chapterHeaderTitle, { color: colors.text }]}>
                        Chapter {selectedChapter}
                    </Text>
                </View>

                {selectedVerses.map((verse) => {
                    const isCompleted = completedVerses.includes(verse.verse_id);
                    return (
                        <TouchableOpacity
                            key={verse.verse_id}
                            style={[
                                styles.verseItem,
                                {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                    shadowColor: colors.cardShadow,
                                },
                                isCompleted && {
                                    borderColor: colors.primary + '40',
                                    backgroundColor: colors.primary + '05',
                                },
                            ]}
                            onPress={() => handlePlayItem(verse.verse_id)}
                        >
                            <View style={styles.verseHeader}>
                                <View
                                    style={[
                                        styles.verseNumberBadge,
                                        { backgroundColor: colors.surfaceSecondary },
                                        isCompleted && { backgroundColor: colors.primary },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.verseNumberText,
                                            { color: colors.primary },
                                            isCompleted && { color: colors.textInverse },
                                        ]}
                                    >
                                        {verse.verse_no}
                                    </Text>
                                </View>
                                <View style={styles.verseInfo}>
                                    <Text
                                        style={[
                                            styles.previewText,
                                            { color: colors.textSecondary },
                                            isCompleted && { color: colors.text },
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {verse.title || verse.sanskrit || verse.reference || 'Verse'}
                                    </Text>
                                    <Text style={[styles.verseChapterRef, { color: colors.textSecondary }]}>
                                        Verse {verse.verse_no}
                                    </Text>
                                </View>
                                {isCompleted && (
                                    <View style={styles.completedBadge}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={20}
                                            color={colors.primary}
                                        />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    // ── Selected-book detail view ────────────────────────────────────────────
    const renderSelectedBook = () => {
        const meta = COLLECTION_METADATA[selectedBook.slug] || {
            icon: 'book',
            color: colors.primary,
        };

        return (
            <ScrollView
                contentContainerStyle={{
                    backgroundColor: colors.background,
                    paddingHorizontal: spacing.l,
                    paddingTop: spacing.m,
                    paddingBottom: layout.miniPlayerHeight + spacing.m,
                }}
                showsVerticalScrollIndicator={false}
            >
                {/* Back / book title header — rounded container */}
                <View
                    style={[
                        styles.innerHeader,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => {
                            if (selectedChapter !== null) setSelectedChapter(null);
                            else setSelectedBook(null);
                        }}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                        <Text style={[styles.backText, { color: colors.text }]}>
                            {selectedChapter !== null ? 'Back' : 'Books'}
                        </Text>
                    </TouchableOpacity>
                    <View style={styles.collectionHeaderTitleBox}>
                        <View style={[styles.smallIconBox, { backgroundColor: meta.color + '15' }]}>
                            {getScriptureIcon(selectedBook.slug, 24, meta.color)}
                        </View>
                        <Text style={[styles.collectionHeaderTitle, { color: colors.text }]}>
                            {selectedBook.title_en ||
                                selectedBook.title_hi ||
                                selectedBook.title ||
                                meta.title}
                        </Text>
                    </View>
                </View>

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
                ) : (
                    renderVerseChapters()
                )}
            </ScrollView>
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

        // ── Selected-book: back / title header (rounded) ───────────
        innerHeader: {
            padding: spacing.m,
            borderRadius: borderRadius.l,
            borderWidth: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.m,
            // iOS shadow
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
        },
        backButton: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        backText: {
            fontSize: typography.sizes.m,
            fontWeight: '500',
            marginLeft: spacing.xs,
        },
        collectionHeaderTitleBox: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        smallIconBox: {
            width: spacing.xl,
            height: spacing.xl,
            borderRadius: borderRadius.round,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.s,
        },
        collectionHeaderTitle: {
            fontSize: typography.sizes.m,
            fontWeight: '600',
        },

        // ── Verse list ─────────────────────────────────────────────
        listContainer: {
            paddingTop: spacing.m,
        },
        verseItem: {
            padding: spacing.m,
            borderRadius: borderRadius.m,
            marginBottom: spacing.s,
            borderWidth: 1,
            // iOS shadow
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 1,
        },
        verseHeader: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        verseNumberBadge: {
            width: spacing.xl + spacing.s,   // 40px
            height: spacing.xl + spacing.s,  // 40px
            borderRadius: borderRadius.round,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.m,
        },
        verseNumberText: {
            fontSize: typography.sizes.m,
            fontWeight: '600',
        },
        verseInfo: {
            flex: 1,
        },
        previewText: {
            flex: 1,
            fontSize: typography.sizes.m,
        },
        verseChapterRef: {
            fontSize: typography.sizes.s,
            marginTop: spacing.xs,
        },
        completedBadge: {
            marginLeft: spacing.s,
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

        // ── Chapter header (rounded) ───────────────────────────────
        verseHeaderChapter: {
            padding: spacing.m,
            borderRadius: borderRadius.l,
            borderWidth: 1,
            marginBottom: spacing.m,
        },
        chapterHeaderTitle: {
            fontSize: typography.sizes.xl,
            fontWeight: '600',
        },
    });
