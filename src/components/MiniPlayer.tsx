import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAdjacentVerse } from '../lib/queries';
import { RootStackParamList } from '../navigation/types';
import { useAudioStore } from '../store/useAudioStore';
import { useTheme } from '../theme';
import { getScriptureIcon } from './ScriptureIcons';

const { width } = Dimensions.get('window');
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const MiniPlayer = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const navigation = useNavigation<NavigationProp>();
    const {
        currentContent,
        isPlaying,
        togglePlayPause,
        unloadAudio,
        position,
        duration,
        seekBackward,
        seekForward
    } = useAudioStore();
    const insets = useSafeAreaInsets();

    if (!currentContent) return null;

    const progress = duration > 0 ? position / duration : 0;

    const handlePress = () => {
        navigation.navigate('Play', {
            itemId: currentContent.id,
            type: currentContent.type,
            autoPlay: false, // Don't trigger a new load/play if already playing
        });
    };

    const navigateAdjacent = async (direction: 'prev' | 'next') => {
        if (!currentContent.bookId || currentContent.chapterNo == null || currentContent.verseNo == null) {
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

            navigation.navigate('Play', {
                itemId: adjacent.verse_id,
                type: currentContent.type,
                autoPlay: true,
            });
        } catch (error: any) {
            console.log('Alert triggered');
            Alert.alert('Playback Error', error?.message || 'Unable to change verse.');
        }
    };

    const tabBarHeight = Platform.OS === 'ios' ? (64 + insets.bottom) : 74;

    return (
        <View style={[styles.outerContainer, { 
            backgroundColor: colors.surface, 
            borderTopColor: colors.border,
            bottom: tabBarHeight,
        }]}>
            {/* Progress line */}
            <View style={[styles.progressBackground, { backgroundColor: colors.border }]}>
                <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
            </View>

            <Pressable onPress={handlePress} style={styles.innerContainer}>
                <View style={[styles.contentRow, { paddingHorizontal: spacing.m, paddingVertical: spacing.s }]}>
                    {/* Icon */}
                    <View style={[styles.iconWrapper, { backgroundColor: colors.primary + '15', borderRadius: borderRadius.s, marginRight: spacing.m }]}>
                        {getScriptureIcon(currentContent.type, 24, colors.primary)}
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

const styles = StyleSheet.create({
    outerContainer: {
        position: 'absolute',
        width: width,
        borderTopWidth: 1,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        zIndex: 100,
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
        marginTop: 1,
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
