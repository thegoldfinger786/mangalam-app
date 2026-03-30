import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLLECTION_METADATA } from '../data/mockGita';
import { ContentPath } from '../data/types';
import { fetchActiveBooks, fetchEpisodes, fetchVerses } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

export const LibraryScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const [selectedBook, setSelectedBook] = useState<any | null>(null);
    const [books, setBooks] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);

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
            const data = book.content_type === 'verse'
                ? await fetchVerses(book.book_id)
                : await fetchEpisodes(book.book_id);
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

        return (
            <View style={styles.listContainer}>
                {chapterNumbers.map((chNo) => (
                    <View key={chNo} style={styles.chapterBlock}>
                        <Text style={styles.chapterTitle}>Chapter {chNo}</Text>
                        {chapters[chNo].map((verse) => (
                            <TouchableOpacity
                                key={verse.verse_id}
                                style={styles.verseItem}
                                onPress={() => handlePlayItem(verse.verse_id, 'verse')}
                            >
                                <View style={styles.verseHeader}>
                                    <Text style={styles.verseNumber}>{verse.chapter_no}.{verse.verse_no}</Text>
                                    <Text style={styles.previewText} numberOfLines={1}>
                                        {verse.sanskrit || verse.reference || 'Verse'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </View>
        );
    };

    const renderEpisodes = () => {
        return (
            <View style={styles.listContainer}>
                {items.map((item) => (
                    <TouchableOpacity
                        key={item.episode_id}
                        style={styles.episodeItem}
                        onPress={() => handlePlayItem(item.episode_id, 'narrative')}
                    >
                        <View style={styles.episodeNumberBadge}>
                            <Text style={styles.episodeNumberText}>{item.episode_no}</Text>
                        </View>
                        <View style={styles.episodeContent}>
                            <Text style={styles.episodeTitle}>{item.title}</Text>
                            {item.summary && (
                                <Text style={styles.episodeSummary} numberOfLines={2}>
                                    {item.summary}
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderCollectionList = () => (
        <View style={styles.collectionList}>
            {books.map((book) => {
                const meta = COLLECTION_METADATA[book.slug] || { icon: 'book', color: theme.colors.primary };
                return (
                    <TouchableOpacity
                        key={book.book_id}
                        style={styles.collectionCard}
                        onPress={() => setSelectedBook(book)}
                    >
                        <View style={[styles.collectionIconBox, { backgroundColor: meta.color + '15' }]}>
                            <Ionicons name={meta.icon as any} size={32} color={meta.color} />
                        </View>
                        <View style={styles.collectionInfo}>
                            <Text style={styles.collectionTitle}>{book.title}</Text>
                            <Text style={styles.collectionDesc}>{book.description}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={theme.colors.border} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderSelectedBook = () => {
        const meta = COLLECTION_METADATA[selectedBook.slug] || { icon: 'book', color: theme.colors.primary };

        return (
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.innerHeader}>
                    <TouchableOpacity onPress={() => setSelectedBook(null)} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                        <Text style={styles.backText}>Books</Text>
                    </TouchableOpacity>
                    <View style={styles.collectionHeaderTitleBox}>
                        <View style={[styles.smallIconBox, { backgroundColor: meta.color + '15' }]}>
                            <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                        </View>
                        <Text style={styles.collectionHeaderTitle}>{selectedBook.title}</Text>
                    </View>
                </View>

                {itemsLoading ? (
                    <View style={styles.centerPadding}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                    </View>
                ) : (
                    selectedBook.content_type === 'verse' ? renderVerseChapters() : renderEpisodes()
                )}

            </ScrollView>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {selectedBook === null ? (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.screenTitle}>Library</Text>
                    </View>
                    {renderCollectionList()}
                </ScrollView>
            ) : (
                renderSelectedBook()
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerPadding: {
        padding: theme.spacing.xl,
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: theme.spacing.xxl,
    },
    header: {
        padding: theme.spacing.l,
        paddingTop: theme.spacing.xl * 2,
        backgroundColor: theme.colors.background,
    },
    screenTitle: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.xxl,
        color: theme.colors.text,
    },
    collectionList: {
        paddingHorizontal: theme.spacing.l,
    },
    collectionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.l,
        marginBottom: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: theme.colors.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 2,
    },
    collectionIconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.m,
    },
    collectionInfo: {
        flex: 1,
    },
    collectionTitle: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.text,
        marginBottom: 4,
    },
    collectionDesc: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.s,
        color: theme.colors.textSecondary,
        lineHeight: theme.typography.lineHeights.s,
    },

    innerHeader: {
        padding: theme.spacing.l,
        paddingTop: theme.spacing.xl * 2,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.text,
        marginLeft: theme.spacing.xs,
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
        marginRight: theme.spacing.s,
    },
    collectionHeaderTitle: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.text,
    },

    listContainer: {
        padding: theme.spacing.m,
    },

    chapterBlock: {
        marginBottom: theme.spacing.xl,
    },
    chapterTitle: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.l,
        color: theme.colors.text,
        marginBottom: theme.spacing.m,
        marginLeft: theme.spacing.xs,
    },
    verseItem: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.s,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    verseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verseNumber: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.primary,
        marginRight: theme.spacing.m,
        width: 36,
    },
    previewText: {
        flex: 1,
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.textSecondary,
    },
    episodeItem: {
        flexDirection: 'row',
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        marginBottom: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    episodeNumberBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.m,
    },
    episodeNumberText: {
        fontFamily: theme.typography.fontFamilies.semiBold,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.primary,
    },
    episodeContent: {
        flex: 1,
        justifyContent: 'center',
    },
    episodeTitle: {
        fontFamily: theme.typography.fontFamilies.medium,
        fontSize: theme.typography.sizes.m,
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
    },
    episodeSummary: {
        fontFamily: theme.typography.fontFamilies.regular,
        fontSize: theme.typography.sizes.s,
        color: theme.colors.textSecondary,
        lineHeight: theme.typography.lineHeights.s,
    }
});
