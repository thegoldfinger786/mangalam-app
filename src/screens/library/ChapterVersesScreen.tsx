import { RouteProp, useRoute } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { LoadError } from '../../components/LoadError';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Skeleton } from '../../components/Skeleton';
import { bookTerms } from '../../lib/bookTerminology';
import { LibraryStackParamList } from '../../navigation/types';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../theme';
import { LibraryVerseRow } from './LibraryVerseRow';
import { useBookVerses } from './useBookVerses';

export const ChapterVersesScreen = () => {
    const { colors, spacing, layout } = useTheme();
    const { book, chapterNo } = useRoute<RouteProp<LibraryStackParamList, 'ChapterVerses'>>().params;

    const lang = useAppStore((s) => s.voicePreference).startsWith('hindi') ? 'hi' : 'en';
    const terms = bookTerms(book.bookId ?? book.slug);

    // Reads from the cache BookDetail populated; refetches only on a cache miss.
    const { verses, loading, error, reload } = useBookVerses(book.bookId, lang);

    const chapterVerses = useMemo(
        () =>
            verses
                .filter((v) => v.chapter_no === chapterNo)
                .sort((a, b) => a.verse_no - b.verse_no),
        [verses, chapterNo],
    );

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title={`${terms.group} ${chapterNo}`} />
            <ScrollView
                contentContainerStyle={{
                    paddingHorizontal: spacing.l,
                    paddingTop: spacing.m,
                    paddingBottom: layout.miniPlayerHeight + spacing.m,
                }}
                showsVerticalScrollIndicator={false}
            >
                {loading && chapterVerses.length === 0 ? (
                    <View style={{ paddingTop: spacing.m, gap: spacing.s }}>
                        {[0, 1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} width="100%" height={68} borderRadius={12} />
                        ))}
                    </View>
                ) : error ? (
                    <LoadError style={{ paddingVertical: spacing.xxxl }} onRetry={reload} />
                ) : (
                    <View style={{ paddingTop: spacing.m }}>
                        {chapterVerses.map((v) => (
                            <LibraryVerseRow
                                key={v.verse_id}
                                verse={v}
                                bookId={book.bookId}
                                contextLabel={`${terms.unit} ${v.verse_no}`}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
});
