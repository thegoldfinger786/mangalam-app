import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { useTheme } from '../theme';

interface DynamicBackgroundProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const DynamicBackground = ({ children, style }: DynamicBackgroundProps) => {
    const { colors, themeMode } = useTheme();
    const hour = new Date().getHours();

    // Determine colors based on time of day with more vibrancy
    const config = useMemo(() => {
        if (hour >= 5 && hour < 11) {
            // Morning: Sunrise vibes
            return {
                top: colors.background,
                bottom: colors.surface,
                orb1: '#FF9E6720', // Vibrant Sunrise Orange
                orb2: '#FFD70015', // Golden Morning
            };
        } else if (hour >= 11 && hour < 17) {
            // Afternoon: High Sol/Insight
            return {
                top: colors.background,
                bottom: colors.surface,
                orb1: colors.primary + '15',
                orb2: '#4A90E210', // Insightful Blue
            };
        } else if (hour >= 17 && hour < 21) {
            // Evening: Sunset/Golden Hour
            return {
                top: themeMode === 'dark' ? '#1A1A1A' : '#FFF8F0',
                bottom: themeMode === 'dark' ? '#0D0D0D' : colors.surface,
                orb1: '#E88B4A25',
                orb2: '#8E44AD15', // Twilight Purple
            };
        } else {
            // Night: Deep Meditation
            return {
                top: themeMode === 'dark' ? '#0A0A12' : '#F0F4F8',
                bottom: themeMode === 'dark' ? '#020205' : colors.background,
                orb1: '#5C748520',
                orb2: '#2C3E5015',
            };
        }
    }, [hour, colors, themeMode]);

    // Floating animation values for the "mesh" orbs
    const translateY1 = useSharedValue(0);
    const translateX1 = useSharedValue(0);
    const scale1 = useSharedValue(1);
    
    const translateY2 = useSharedValue(0);
    const translateX2 = useSharedValue(0);
    const scale2 = useSharedValue(1);

    useEffect(() => {
        // Orb 1: Breathing and floating
        translateY1.value = withRepeat(
            withSequence(
                withTiming(50, { duration: 12000, easing: Easing.inOut(Easing.sin) }),
                withTiming(-50, { duration: 12000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
        translateX1.value = withRepeat(
            withSequence(
                withTiming(40, { duration: 15000, easing: Easing.inOut(Easing.sin) }),
                withTiming(-40, { duration: 15000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
        scale1.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 10000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.8, { duration: 10000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Orb 2: Counter-motion
        translateY2.value = withRepeat(
            withSequence(
                withTiming(-60, { duration: 14000, easing: Easing.inOut(Easing.sin) }),
                withTiming(60, { duration: 14000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
        translateX2.value = withRepeat(
            withSequence(
                withTiming(-50, { duration: 18000, easing: Easing.inOut(Easing.sin) }),
                withTiming(50, { duration: 18000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle1 = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY1.value },
            { translateX: translateX1.value },
            { scale: scale1.value },
        ],
    }));

    const animatedStyle2 = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY2.value },
            { translateX: translateX2.value },
            { scale: scale2.value },
        ],
    }));

    return (
        <View style={[styles.container, style, { backgroundColor: config.top }]}>
            <LinearGradient
                colors={[config.top, config.bottom]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.1, y: 0.1 }}
                end={{ x: 0.9, y: 0.9 }}
            />
            
            <View style={styles.meshContainer}>
                <Animated.View style={[styles.orb, styles.orb1, { backgroundColor: config.orb1 }, animatedStyle1]} />
                <Animated.View style={[styles.orb, styles.orb2, { backgroundColor: config.orb2 }, animatedStyle2]} />
            </View>

            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    meshContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
        pointerEvents: 'none',
    },
    orb: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.6,
    },
    orb1: {
        top: '5%',
        right: '-10%',
        width: 350,
        height: 350,
    },
    orb2: {
        bottom: '10%',
        left: '-15%',
        width: 450,
        height: 450,
    }
});
