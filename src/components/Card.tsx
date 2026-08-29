import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const Card = ({ children, style }: CardProps) => {
    const { colors, borderRadius } = useTheme();

    return (
        <View style={[
            styles.card,
            {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.cardShadow,
                borderRadius: borderRadius.l,
            },
            style
        ]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        // borderRadius is applied dynamically from theme token
        borderWidth: 1,
        // iOS Shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
        // Android Shadow
        elevation: 3,
    },
});

