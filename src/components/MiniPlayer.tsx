import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { navigationRef } from '../navigation';
import { useAppStore } from '../store/useAppStore';
import {
    Alert,
    Dimensions,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { assertValidBookId } from '../lib/bookIdentity';
import { fetchAdjacentVerse } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useAudioStore } from '../store/useAudioStore';
import { useTheme } from '../theme';
import { getScriptureIcon } from './ScriptureIcons';

const { width } = Dimensions.get('window');

export const MiniPlayer = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const styles = useMemo(() => createStyles(spacing), [spacing]);
    
    // Performance optimization: Derived boolean selector
    const hasSound = useAudioStore(state => !!state.currentContent);
    const isPlaying = useAudioStore(state => state.isPlaying);
    const position = useAudioStore(state => state.position);
    const duration = useAudioStore(state => state.duration);
    
    // Stable actions
    const togglePlayPause = useAudioStore(state => state.togglePlayPause);
    const unloadAudio = useAudioStore(state => state.unloadAudio);
    const seekBackward = useAudioStore(state => state.seekBackward);
    const seekForward = useAudioStore(state => state.seekForward);

    const { layout } = useTheme();
    const tabBarHeight = useAppStore(state => state.tabBarHeight);
    const currentRouteName = useAppStore(state => state.currentRouteName);
    const currentContent = useAudioStore(state => state.currentContent);

    // Visibility logic: Hide if route is not yet measured, if we're on the Play screen, 
    // or if there's no active content. This prevents flickering during initial boot.
    const isVisible = currentRouteName !== null && currentRouteName !== 'Play' && hasSound && !!currentContent;
    
    if (!isVisible) {
        return null;
    }

    const bottomOffset = tabBarHeight || layout.tabBarFallbackHeight;

    const progress = duration > 0 ? position / duration : 0;

    const handlePress = () => {
        if (!assertValidBookId(currentContent.bookId, 'MiniPlayer.handlePress')) {
            console.error('MiniPlayer missing bookId for playback navigation', { currentContent });
            return;
        }

        if (navigationRef.isReady()) {
            navigationRef.navigate('Play', {
                itemId: currentContent.id,
                bookId: currentContent.bookId,
                autoPlay: false, // Don't trigger a new load/play if already playing
            });
        }
    };

    const navigateAdjacent = async (direction: 'prev' | 'next') => {
        if (
            !assertValidBookId(currentContent.bookId, 'MiniPlayer.navigateAdjacent') ||
            currentContent.chapterNo == null ||
            currentContent.verseNo == null
        ) {
            return;
        }

        try {
            const adjacent = await fetchAdjacentVerse(
                currentContent.bookId,
                currentContent.chapterNo,
                currentContent.verseNo,
                direction
            );

            if (!adjacent?.verse_id) return;

            if (navigationRef.isReady()) {
                navigationRef.navigate('Play', {
                    itemId: adjacent.verse_id,
                    bookId: currentContent.bookId,
                    autoPlay: true,
                });
            }
        } catch (error: any) {
            console.log('Alert triggered');
            Alert.alert('Playback Error', error?.message || 'Unable to change verse.');
        }
    };

    return (
        <View 
            pointerEvents="box-none"
            style={[styles.outerContainer, { 
                backgroundColor: colors.surface, 
                borderTopColor: colors.border,
                bottom: bottomOffset,
                height: layout.miniPlayerHeight,
            }]}
        >
            {/* Progress line */}
            <View style={[styles.progressBackground, { backgroundColor: colors.border }]}>
                <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
            </View>

            <Pressable onPress={handlePress} style={styles.innerContainer}>
                <View style={[styles.contentRow, { paddingHorizontal: spacing.m, paddingVertical: spacing.s }]}>
                    {/* Icon */}
                    <View style={[styles.iconWrapper, { backgroundColor: colors.primary + '15', borderRadius: borderRadius.s, marginRight: spacing.m }]}>
                        {getScriptureIcon(currentContent.bookSlug || 'book', 24, colors.primary)}
                    </View>

                    {/* Text info */}
                    <View style={styles.textContainer}>
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                            {currentContent.title}
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {isPlaying ? 'Now Playing' : 'Paused'}
                        </Text>
                    </View>

                    {/* Controls */}
                    <View style={styles.controlsRow}>
                        <TouchableOpacity onPress={() => navigateAdjacent('prev')} style={styles.transportButton}>
                            <Ionicons name="play-skip-back" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => seekBackward?.()} style={styles.transportButton}>
                            <Ionicons name="play-back" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => togglePlayPause?.()} style={styles.playButton}>
                            <Ionicons 
                                name={isPlaying ? 'pause' : 'play'} 
                                size={28} 
                                color={colors.primary} 
                                style={{ marginLeft: isPlaying ? 0 : 2 }}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => seekForward?.()} style={styles.transportButton}>
                            <Ionicons name="play-forward" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigateAdjacent('next')} style={styles.transportButton}>
                            <Ionicons name="play-skip-forward" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => unloadAudio?.()} style={[styles.closeButton, { marginLeft: spacing.xs }]}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Pressable>
        </View>
    );
};

const createStyles = (spacing: ReturnType<typeof useTheme>['spacing']) => StyleSheet.create({
    outerContainer: {
        position: 'absolute',
        width: width,
        borderTopWidth: 1,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        zIndex: 999,
        elevation: 999,
    },
    progressBackground: {
        height: 2,
        width: '100%',
    },
    progressBar: {
        height: '100%',
    },
    innerContainer: {
        width: '100%',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrapper: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: 14,
        fontFamily: 'Inter-SemiBold',
    },
    subtitle: {
        fontSize: 12,
        fontFamily: 'Inter-Regular',
        marginTop: spacing.micro,
    },
    playButton: {
        width: 40,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    transportButton: {
        width: 34,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        width: 36,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
