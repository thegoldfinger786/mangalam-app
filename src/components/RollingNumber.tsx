import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { 
    useAnimatedStyle, 
    useSharedValue, 
    withSpring,
    interpolate
} from 'react-native-reanimated';
import { useTheme } from '../theme';

interface RollingNumberProps {
    value: number;
    fontSize?: number;
    color?: string;
}

export const RollingNumber = ({ value, fontSize = 24, color }: RollingNumberProps) => {
    const { colors, typography } = useTheme();
    const textColor = color || colors.text;
    
    // Shared value for the number
    const animatedValue = useSharedValue(0);

    useEffect(() => {
        animatedValue.value = withSpring(value, {
            damping: 12,
            stiffness: 90
        });
    }, [value]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: interpolate(animatedValue.value % 1, [0, 1], [0, -fontSize]) }
            ],
            opacity: interpolate(animatedValue.value, [value - 0.5, value, value + 0.5], [0.8, 1, 0.8])
        };
    });

    // For a real odometer, we'd loop through numbers 0-9. 
    // Here we'll do a simpler high-performance spring jump for the whole number.
    const containerStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { scale: withSpring(value !== 0 ? 1.2 : 1, { damping: 10 }) },
                { scale: withSpring(1, { damping: 10 }) }
            ]
        };
    });

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            <Text style={[
                styles.text, 
                { 
                    fontSize, 
                    color: textColor,
                    fontFamily: typography.fontFamilies.semiBold
                }
            ]}>
                {value}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        textAlign: 'center',
    },
});
