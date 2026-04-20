import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';

interface CircularProgressProps {
    progress: number; // 0 to 1
    size?: number;
    strokeWidth?: number;
    children?: React.ReactNode;
}

export const CircularProgress = ({
    progress,
    size = 120,
    strokeWidth = 10,
    children,
}: CircularProgressProps) => {
    const { colors } = useTheme();
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - progress * circumference;

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size}>
                {/* Background Circle */}
                <Circle
                    stroke={colors.border}
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                />
                {/* Progress Circle */}
                <Circle
                    stroke={colors.primary}
                    fill="none"
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    originX={size / 2}
                    originY={size / 2}
                    rotation="-90" // Start from top
                />
            </Svg>
            <View style={[StyleSheet.absoluteFillObject, styles.contentContainer]}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
