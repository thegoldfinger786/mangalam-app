import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { BookCard } from '../../components/BookCard';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { LoadError } from '../../components/LoadError';
import { getScriptureIcon } from '../../components/ScriptureIcons';
import { Skeleton } from '../../components/Skeleton';
import { COLLECTION_METADATA } from '../../data/collectionMetadata';
import { logger } from '../../lib/logger';
import { fetchActiveBooks } from '../../lib/queries';
import { LibraryStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type Nav = NativeStackNavigationProp<LibraryStackParamList, 'LibraryBooks'>;

const bookTitle = (b: any) =>
    b.title_en || b.title_hi || b.title || COLLECTION_METADATA[b.slug]?.title || 'Wisdom';

export const LibraryBooksScreen = () => {
    const { colors, spacing, borderRadius, layout } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
    const navigation = useNavigation<Nav>();

    const [books, setBooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const loadBooks = async () => {
        try {
            setLoading(true);
            setError(false);
            setBooks(await fetchActiveBooks());
        } catch (e) {
            logger.error('Failed to load books', { error: e });
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBooks();
    }, []);

    if (loading) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <Skeleton width={120} height={32} borderRadius={borderRadius.s} />
                </View>
                <View style={styles.skeletonGrid}>
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} width="47%" height={150} borderRadius={borderRadius.l} style={{ marginBottom: spacing.m }} />
                    ))}
                </View>
            </ScreenContainer>
        );
    }

    if (error) {
        return (
            <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
                <LoadError onRetry={loadBooks} />
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={books}
                keyExtractor={(item) => item.book_id}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={[styles.gridContent, { paddingBottom: layout.miniPlayerHeight + spacing.m }]}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <AppText variant="display" style={{ color: colors.text }}>Library</AppText>
                    </View>
                }
                renderItem={({ item }) => {
                    const meta = COLLECTION_METADATA[item.slug] || { color: colors.primary };
                    return (
                        <BookCard
                            icon={getScriptureIcon(item.slug, spacing.xl, meta.color)}
                            title={bookTitle(item)}
                            accentColor={meta.color}
                            onPress={() =>
                                navigation.navigate('BookDetail', {
                                    book: { bookId: item.book_id, slug: item.slug, title: bookTitle(item) },
                                })
                            }
                        />
                    );
                }}
            />
        </ScreenContainer>
    );
};

const createStyles = (spacing: ReturnType<typeof useTheme>['spacing']) =>
    StyleSheet.create({
        container: { flex: 1 },
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
        columnWrapper: {
            paddingHorizontal: spacing.l,
            gap: spacing.m,
        },
        gridContent: {
            paddingTop: spacing.m,
        },
    });
