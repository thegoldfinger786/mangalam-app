import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { COLLECTION_METADATA } from '../data/mockGita';
import { ContentPath } from '../data/types';
import { fetchActiveBooks, fetchVersesWithContent } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

export const LibraryScreen = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
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
            console.error('Error loading books:', error);
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
            console.error('Error loading items:', error);
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

    const handlePlayItem = (id: string, contentType: string) => {
        // Map internal content_type to ContentPath union type for routing
        // In our DB, 'verse' maps to 'gita' or 'upanishads', 'narrative' maps to others
        // For now, we use the book slug if available.
        navigation.navigate('Play', { itemId: id, type: selectedBook.slug as ContentPath });
    };

    const renderVerseChapters = () => {
        // Group by chapter_no
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
                        const completedInChapter = chapterVerses.filter(v => completedVerses.includes(v.verse_id)).length;
                        const totalInChapter = chapterVerses.length;
                        const isFullyDone = completedInChapter === totalInChapter && totalInChapter > 0;

                        return (
                            <TouchableOpacity
                                key={chNo}
                                style={[
                                    styles.chapterTile,
                                    { backgroundColor: colors.surface, borderColor: colors.border },
                                    isFullyDone && { borderColor: colors.primary, backgroundColor: colors.primary + '08' }
                                ]}
                                onPress={() => setSelectedChapter(chNo)}
                                onLongPress={() => {
                                    // Play first verse of chapter directly
                                    const firstVerse = chapterVerses.sort((a, b) => a.verse_no - b.verse_no)[0];
                                    if (firstVerse) handlePlayItem(firstVerse.verse_id, 'verse');
                                }}
                            >
                                <Text style={[styles.chapterTileNumber, { color: colors.primary }]}>{chNo}</Text>
                                <Text style={[styles.chapterTileLabel, { color: colors.textSecondary }]}>Chapter</Text>
                                <View style={[styles.tileProgressContainer, { backgroundColor: colors.surfaceSecondary }]}>
                                    <View style={[styles.tileProgressBar, { backgroundColor: colors.primary, width: `${(completedInChapter / totalInChapter) * 100}%` }]} />
                                </View>
                                <Text style={[styles.tileProgressText, { color: colors.textSecondary }]}>{completedInChapter}/{totalInChapter}</Text>
                                <TouchableOpacity 
                                    style={{ marginTop: 8 }} 
                                    onPress={() => {
                                        const firstVerse = chapterVerses.sort((a, b) => a.verse_no - b.verse_no)[0];
                                        if (firstVerse) handlePlayItem(firstVerse.verse_id, 'verse');
                                    }}
                                >
                                    <Ionicons name="play-circle" size={24} color={colors.primary} />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            );
        }

        // Show verses for specific chapter
        const selectedVerses = chapters[selectedChapter] || [];

        return (
            <View style={styles.listContainer}>
                <View style={styles.verseHeaderChapter}>
                    <Text style={styles.chapterHeaderTitle}>Chapter {selectedChapter}</Text>
                </View>
                {selectedVerses.map((verse) => {
                    const isCompleted = completedVerses.includes(verse.verse_id);
                    return (
                        <TouchableOpacity
                            key={verse.verse_id}
                            style={[
                                styles.verseItem,
                                { backgroundColor: colors.surface, borderColor: colors.border },
                                isCompleted && { borderColor: colors.primary + '40', backgroundColor: colors.primary + '05' }
                            ]}
                            onPress={() => handlePlayItem(verse.verse_id, 'verse')}
                        >
                            <View style={styles.verseHeader}>
                                <View style={[
                                    styles.verseNumberBadge,
                                    { backgroundColor: colors.surfaceSecondary },
                                    isCompleted && { backgroundColor: colors.primary }
                                ]}>
                                    <Text style={[styles.verseNumberText, { color: colors.primary }, isCompleted && { color: '#FFF' }]}>
                                        {verse.verse_no}
                                    </Text>
                                </View>
                                <View style={styles.verseInfo}>
                                    <Text style={[styles.previewText, { color: colors.textSecondary }, isCompleted && { color: colors.text }]} numberOfLines={2}>
                                        {verse.title || verse.sanskrit || verse.reference || 'Verse'}
                                    </Text>
                                    <Text style={[styles.verseChapterRef, { color: colors.textSecondary }]}>Chapter {verse.chapter_no}, Verse {verse.verse_no}</Text>
                                </View>
                                {isCompleted && (
                                    <View style={styles.completedBadge}>
                                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderEpisodes = () => {
        return null;
    };

    const renderCollectionList = () => (
        <View style={styles.collectionList}>
            {books.map((book) => {
                const meta = COLLECTION_METADATA[book.slug] || { icon: 'book', color: colors.primary };
                return (
                    <TouchableOpacity
                        key={book.book_id}
                        style={[
                            styles.collectionCard,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                shadowColor: colors.cardShadow
                            }
                        ]}
                        onPress={() => setSelectedBook(book)}
                    >
                        <View style={[styles.collectionIconBox, { backgroundColor: meta.color + '15' }]}>
                            {getScriptureIcon(book.slug, 32, meta.color)}
                        </View>
                        <View style={styles.collectionInfo}>
                            <Text style={[styles.collectionTitle, { color: colors.text }]}>
                                {book.title_en || book.title_hi || book.title || meta.title}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={colors.border} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderSelectedBook = () => {
        const meta = COLLECTION_METADATA[selectedBook.slug] || { icon: 'book', color: colors.primary };

        return (
            <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}>
                <View style={[styles.innerHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={() => {
                            if (selectedChapter !== null) setSelectedChapter(null);
                            else setSelectedBook(null);
                        }}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                        <Text style={[styles.backText, { color: colors.text }]}>{selectedChapter !== null ? 'Back' : 'Books'}</Text>
                    </TouchableOpacity>
                    <View style={styles.collectionHeaderTitleBox}>
                        <View style={[styles.smallIconBox, { backgroundColor: meta.color + '15' }]}>
                            {getScriptureIcon(selectedBook.slug, 24, meta.color)}
                        </View>
                        <Text style={[styles.collectionHeaderTitle, { color: colors.text }]}>
                            {selectedBook.title_en || selectedBook.title_hi || selectedBook.title || meta.title}
                        </Text>
                    </View>
                </View>

                {itemsLoading ? (
                    <View style={styles.centerPadding}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    renderVerseChapters()
                )}

            </ScrollView>
        );
    };

    if (loading) {
        return (
            <ScreenContainer style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer style={[styles.container, { backgroundColor: colors.background }]}>
            {selectedBook === null ? (
                <View style={{ flex: 1 }}>
                    <View style={[styles.header, { backgroundColor: colors.background }]}>
                        <Text style={[styles.screenTitle, { color: colors.text }]}>Library</Text>
                    </View>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        {renderCollectionList()}
                    </ScrollView>
                </View>
            ) : (
                renderSelectedBook()
            )}
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerPadding: {
        padding: 24, // spacing.xl
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 48, // spacing.xxl
    },
    header: {
        padding: 24, // spacing.l
        paddingTop: 16, // ScreenContainer handles top inset; this is inner breathing room only
    },
    screenTitle: {
        fontSize: 32, // typography.sizes.xxl
        fontWeight: 'bold',
    },
    collectionList: {
        paddingHorizontal: 24, // spacing.l
    },
    collectionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16, // spacing.m
        borderRadius: 16, // borderRadius.l
        marginBottom: 16, // spacing.m
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    collectionIconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16, // spacing.m
        overflow: 'hidden',
    },
    collectionInfo: {
        flex: 1,
    },
    collectionTitle: {
        fontSize: 20, // typography.sizes.l
        fontWeight: '600',
        marginBottom: 4,
    },
    collectionDesc: {
        fontSize: 14, // typography.sizes.s
        lineHeight: 20, // typography.lineHeights.s
    },

    innerHeader: {
        padding: 24, // spacing.l
        paddingTop: 16, // ScreenContainer handles top inset; this is inner breathing room only
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        fontSize: 16, // typography.sizes.m
        fontWeight: '500',
        marginLeft: 4, // spacing.xs
    },
    collectionHeaderTitleBox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    smallIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8, // spacing.s
    },
    collectionHeaderTitle: {
        fontSize: 16, // typography.sizes.m
        fontWeight: '600',
    },

    listContainer: {
        padding: 16, // spacing.m
    },

    chapterBlock: {
        marginBottom: 32, // spacing.xl
    },
    chapterTitle: {
        fontSize: 20, // typography.sizes.l
        fontWeight: '500',
        marginBottom: 16, // spacing.m
        marginLeft: 4, // spacing.xs
    },
    verseItem: {
        padding: 16, // spacing.m
        borderRadius: 12, // borderRadius.m
        marginBottom: 8, // spacing.s
        borderWidth: 1,
    },
    verseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verseNumber: {
        fontSize: 16, // typography.sizes.m
        fontWeight: '600',
        marginRight: 16, // spacing.m
        width: 36,
    },
    previewText: {
        flex: 1,
        fontSize: 16, // typography.sizes.m
    },
    episodeItem: {
        flexDirection: 'row',
        padding: 16, // spacing.m
        borderRadius: 12, // borderRadius.m
        marginBottom: 16, // spacing.m
        borderWidth: 1,
    },
    episodeNumberBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16, // spacing.m
    },
    episodeNumberText: {
        fontSize: 16, // typography.sizes.m
        fontWeight: '600',
    },
    episodeContent: {
        flex: 1,
        justifyContent: 'center',
    },
    episodeTitle: {
        fontSize: 16, // typography.sizes.m
        fontWeight: '500',
        marginBottom: 4, // spacing.xs
    },
    episodeSummary: {
        fontSize: 14, // typography.sizes.s
        lineHeight: 20, // typography.lineHeights.s
    },
    chapterGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16, // spacing.m
        justifyContent: 'space-between',
    },
    chapterTile: {
        width: '31%',
        aspectRatio: 1,
        borderRadius: 16, // borderRadius.l
        borderWidth: 1,
        padding: 16, // spacing.m
        marginBottom: 16, // spacing.m
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    chapterTileNumber: {
        fontSize: 24, // typography.sizes.xl
        fontWeight: '600',
    },
    chapterTileLabel: {
        fontSize: 14, // typography.sizes.s
        fontWeight: '500',
        marginBottom: 8, // spacing.s
    },
    tileProgressContainer: {
        width: '80%',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
    },
    tileProgressBar: {
        height: '100%',
    },
    tileProgressText: {
        fontSize: 10,
    },
    verseHeaderChapter: {
        paddingVertical: 24, // spacing.l
        paddingHorizontal: 16, // spacing.m
    },
    chapterHeaderTitle: {
        fontSize: 24, // typography.sizes.xl
        fontWeight: '600',
    },
    verseNumberBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16, // spacing.m
    },
    verseNumberText: {
        fontSize: 16, // typography.sizes.m
        fontWeight: '600',
    },
    verseInfo: {
        flex: 1,
    },
    verseChapterRef: {
        fontSize: 14, // typography.sizes.s
    },
    completedBadge: {
        marginLeft: 8, // spacing.s
    }
});
