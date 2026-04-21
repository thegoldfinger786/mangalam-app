import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { getScriptureIcon } from '../components/ScriptureIcons';
import { COLLECTION_METADATA } from '../data/mockGita';
import { assertValidBookId, assertBookIdentityConsistency, getBookCode } from '../lib/bookIdentity';
import { fetchActiveBooks, supabase } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { logger } from '../lib/logger';

const { width } = Dimensions.get('window');
const GITA_COVER = require('../../assets/images/gita-cover.jpg');
const MAHABHARAT_COVER = require('../../assets/images/mahabharat-cover.jpg');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type BookDashboardRouteProp = RouteProp<RootStackParamList, 'BookDashboard'>;

export const BookDashboardScreen = () => {
    const { colors, spacing, typography, borderRadius, layout } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<BookDashboardRouteProp>();
    const insets = useSafeAreaInsets();
    
    const bookId = route.params?.bookId;
    assertBookIdentityConsistency({ source: 'BookDashboardScreen', bookId });
    if (!bookId) {
        throw new Error("BOOK_ID_REQUIRED");
    }

    const clickedBookId = route?.params?.clickedBookId ?? null;
    const clickedTitle = route?.params?.clickedTitle ?? null;

    const { completedVerses } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [verses, setVerses] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalChapters: 0, totalVerses: 0 });
    const [nextVerse, setNextVerse] = useState<any>(null);
    const [book, setBook] = useState<any>(null);

    const loadData = useCallback(async () => {
        if (!assertValidBookId(bookId, 'BookDashboardScreen.loadData')) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const activeBooks = await fetchActiveBooks();
            const resolvedBook = activeBooks.find(b => b.book_id === bookId);

            if (!resolvedBook) {
                Alert.alert('Error', 'Book not found.');
                navigation.goBack();
                return;
            }

            setBook(resolvedBook);

            const { data: allVerses, error } = await supabase
                .from('verses')
                .select('*')
                .eq('book_id', resolvedBook.book_id)
                .order('chapter_no', { ascending: true })
                .order('verse_no', { ascending: true });

            if (error) throw error;
            setVerses(allVerses || []);

            const chapters = new Set(allVerses?.map(v => v.chapter_no));
            setStats({ totalChapters: chapters.size, totalVerses: allVerses?.length || 0 });

            // Find first uncompleted verse
            const uncompleted = allVerses?.find(v => !completedVerses.includes(v.verse_id));
            if (uncompleted) {
                setNextVerse(uncompleted);
            } else if (allVerses?.length > 0) {
                // If all completed, suggest starting over or going to last
                setNextVerse(allVerses[allVerses.length - 1]);
            }

        } catch (e) {
            logger.error('Failed to load book dashboard', { error: e });
            Alert.alert('Error', 'Unable to load dashboard data.');
        } finally {
            setLoading(false);
        }
    }, [clickedBookId, completedVerses, navigation, bookId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (!assertValidBookId(bookId, 'BookDashboardScreen.render')) {
        return null;
    }

    const handleContinueLabel = () => {
        if (!nextVerse) return 'Continue Journey';
        const isCompleted = completedVerses.includes(nextVerse.verse_id);
        if (isCompleted) return 'Replay Last Verse';
        return `Start Chapter ${nextVerse.chapter_no} Verse ${nextVerse.verse_no}`;
    };

    const handleContinue = () => {
        if (!nextVerse || !assertValidBookId(nextVerse.book_id, 'BookDashboardScreen.handleContinue')) return;
        navigation.navigate('Play', {
            itemId: nextVerse.verse_id,
            bookId: nextVerse.book_id,
        });
    };

    // Calculate how many distinct chapters they've completed verses in
    const completedVersesInBook = verses.filter(v => completedVerses.includes(v.verse_id));
    const chaptersStarted = new Set(completedVersesInBook.map(v => v.chapter_no)).size;
    const progressText = completedVersesInBook.length > 0
        ? `You have listened to ${completedVersesInBook.length} verses across ${chaptersStarted} chapters.`
        : 'Your journey begins here. Tap continue to start listening.';

    // Group verses by chapter to show progress bars
    const chaptersMap = new Map<number, any[]>();
    verses.forEach(v => {
        if (!chaptersMap.has(v.chapter_no)) {
            chaptersMap.set(v.chapter_no, []);
        }
        chaptersMap.get(v.chapter_no)!.push(v);
    });

    const chapterProgressData = Array.from(chaptersMap.entries()).map(([chapter_no, chapterVerses]) => {
        const completedInChapter = chapterVerses.filter(v => completedVerses.includes(v.verse_id)).length;
        return {
            chapter_no,
            total: chapterVerses.length,
            completed: completedInChapter,
            progress: chapterVerses.length > 0 ? completedInChapter / chapterVerses.length : 0
        };
    }).sort((a, b) => a.chapter_no - b.chapter_no);

    const handleChapterPress = (chapter_no: number) => {
        const chapterVerses = chaptersMap.get(chapter_no);
        if (!chapterVerses || chapterVerses.length === 0) return;
        
        // Find first uncompleted verse in this chapter, otherwise start from verse 1
        const uncompleted = chapterVerses.find(v => !completedVerses.includes(v.verse_id));
        const startVerse = uncompleted || chapterVerses[0];
        if (!assertValidBookId(startVerse.book_id, 'BookDashboardScreen.handleChapterPress')) return;
        
        navigation.navigate('Play', {
            itemId: startVerse.verse_id,
            bookId: startVerse.book_id,
        });
    };

    const bookCode = getBookCode(bookId);
    const gitaCheck = bookCode === 'gita' || bookCode === 'bhagavad_gita';
    const mahabharatCheck = bookCode === 'mahabharat';
    const resolvedType = (book?.slug ?? '') as string;
    const BOOK_SLUG = gitaCheck ? 'bhagavad-gita' : resolvedType as string;
    const meta = COLLECTION_METADATA[BOOK_SLUG] || { title: 'Wisdom', icon: 'book', color: colors.primary };

    return (
        <ScreenContainer edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
                    <Ionicons name="chevron-down" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text, fontFamily: typography.fontFamilies.medium }]}>
                    {gitaCheck ? 'Bhagavad Gita' : (mahabharatCheck ? 'Mahabharat' : meta.title)}
                </Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView 
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]} 
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.heroSection}>
                    <View style={[styles.heroGlow, { backgroundColor: mahabharatCheck ? '#D6A621' : colors.primary }]} />
                    {gitaCheck ? (
                        <Image source={GITA_COVER} style={[styles.heroImage, { borderRadius: borderRadius.xl, shadowColor: colors.primary }]} />
                    ) : mahabharatCheck ? (
                        <Image source={MAHABHARAT_COVER} style={[styles.heroImage, { borderRadius: borderRadius.xl, shadowColor: '#D6A621' }]} />
                    ) : (
                        <View style={[styles.heroIconBox, { backgroundColor: colors.surface, borderRadius: borderRadius.xl, shadowColor: colors.cardShadow }]}>
                            {getScriptureIcon(BOOK_SLUG, 80, mahabharatCheck ? '#D6A621' : colors.primary)}
                        </View>
                    )}

                    <View style={[styles.heroGlassPanel, { backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderColor: colors.border }]}>
                        <Text style={[styles.bookTitle, { color: colors.text, fontFamily: typography.fontFamilies.semiBold }]}>
                            {gitaCheck ? 'श्रीमद्भगवद्गीता' : (mahabharatCheck ? 'महाभारत' : meta.title)}
                        </Text>
                        <Text style={[styles.bookSubtitle, { color: mahabharatCheck ? '#D6A621' : colors.primary, fontFamily: typography.fontFamilies.medium }]}>
                            {gitaCheck ? 'The Song of God' : (mahabharatCheck ? 'The Great Epic' : 'Timeless Wisdom')}
                        </Text>

                        <View style={[styles.progressBox, { backgroundColor: colors.background, borderRadius: borderRadius.l, padding: spacing.l, marginBottom: spacing.xl, borderColor: colors.border }]}>
                            <Text style={[styles.progressLabel, { color: colors.textSecondary, marginBottom: spacing.xs, fontFamily: typography.fontFamilies.medium }]}>Your Progress</Text>
                            <Text style={[styles.progressStats, { color: colors.text, marginBottom: spacing.s, fontFamily: typography.fontFamilies.semiBold }]}>
                                {completedVersesInBook.length} <Text style={[styles.progressSubtext, { color: colors.textSecondary, fontFamily: typography.fontFamilies.regular }]}>verses listened</Text>
                            </Text>
                            <Text style={[styles.progressDesc, { color: colors.textSecondary, fontFamily: typography.fontFamilies.regular }]}>{progressText}</Text>
                        </View>

                        {/* ── Chapter Progress Section ── */}
                        {chapterProgressData.length > 0 && (
                            <View style={[styles.chaptersSection, { marginBottom: spacing.xl }]}>
                                <Text style={[styles.chaptersSectionTitle, { color: colors.text, marginBottom: spacing.m, fontFamily: typography.fontFamilies.semiBold }]}>Chapter Progress</Text>
                                {chapterProgressData.map((ch) => (
                                    <TouchableOpacity 
                                        key={ch.chapter_no} 
                                        onPress={() => handleChapterPress(ch.chapter_no)}
                                        style={[styles.chapterCard, { backgroundColor: colors.surface, borderRadius: borderRadius.m, padding: spacing.m, marginBottom: spacing.m, borderColor: colors.border }]}
                                    >
                                        <View style={[styles.chapterHeader, { marginBottom: spacing.s }]}>
                                            <Text style={[styles.chapterTitle, { color: colors.text, fontFamily: typography.fontFamilies.medium }]}>Chapter {ch.chapter_no}</Text>
                                            <Text style={[styles.chapterStats, { color: colors.textSecondary, fontFamily: typography.fontFamilies.regular }]}>{ch.completed} / {ch.total} Verses</Text>
                                        </View>
                                        <View style={[styles.progressBarContainer, { backgroundColor: colors.surfaceSecondary }]}>
                                            <View style={[styles.progressBarFill, { backgroundColor: mahabharatCheck ? '#D6A621' : colors.primary, width: `${ch.progress * 100}%` }]} />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <Button
                            title={handleContinueLabel()}
                            onPress={handleContinue}
                            style={styles.continueButton}
                            disabled={loading || !nextVerse}
                        />
                    </View>
                </View>

                {/* ── Aesthetic Decorative Element ── */}
                <View style={[styles.decorationContainer, { marginTop: spacing.xxxl }]}>
                    <Ionicons name="sparkles" size={20} color={mahabharatCheck ? '#D6A621' : colors.primary} style={{ opacity: 0.5 }} />
                    <View style={[styles.decorationLine, { backgroundColor: colors.border, marginHorizontal: spacing.m }]} />
                    <Ionicons name="book" size={20} color={mahabharatCheck ? '#D6A621' : colors.primary} style={{ opacity: 0.5 }} />
                </View>

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
        paddingHorizontal: spacing.m,
        paddingTop: spacing.s,
        marginBottom: spacing.m,
    },
    iconButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: 18, // typography.sizes.l
    },
    scrollContent: {
        // Dynamic paddingBottom added inline to respect safe area + MiniPlayer height
    },
    heroSection: {
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        marginTop: spacing.l,
        position: 'relative',
    },
    heroGlow: {
        position: 'absolute',
        top: 40,
        width: 200,
        height: 200,
        borderRadius: 100,
        opacity: 0.15,
        transform: [{ scaleX: 1.5 }],
    },
    heroImage: {
        width: 180,
        height: 180,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 2,
    },
    heroIconBox: {
        width: 180,
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 2,
    },
    heroGlassPanel: {
        width: '100%',
        marginTop: -90, // heroGlassPanelOverlap constant
        paddingTop: 90 + spacing.m, // Pad for the overlap

        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.l,
        borderWidth: 1,
        alignItems: 'center',
        zIndex: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    bookTitle: {
        fontSize: 28,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    bookSubtitle: {
        fontSize: 16, // typography.sizes.m
        marginBottom: spacing.xl,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    progressBox: {
        width: '100%',
        borderWidth: 1,
    },
    progressLabel: {
        fontSize: 14, // typography.sizes.s
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    progressStats: {
        fontSize: 36,
    },
    progressSubtext: {
        fontSize: 16, // typography.sizes.m
    },
    progressDesc: {
        fontSize: 16, // typography.sizes.m
        lineHeight: 24,
    },
    continueButton: {
        width: '100%',
    },
    decorationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    decorationLine: {
        width: 60,
        height: 1,
    },
    chaptersSection: {
        width: '100%',
    },
    chaptersSectionTitle: {
        fontSize: 18, // typography.sizes.l
        textAlign: 'left',
    },
    chapterCard: {
        borderWidth: 1,
    },
    chapterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chapterTitle: {
        fontSize: 16, // typography.sizes.m
    },
    chapterStats: {
        fontSize: 14, // typography.sizes.s
    },
    progressBarContainer: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    }
});
