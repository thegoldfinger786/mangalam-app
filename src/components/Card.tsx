import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { theme } from '../theme';

interface CardProps extends ViewProps {
    children: React.ReactNode;
}

export const Card = ({ children, style, ...rest }: CardProps) => {
    return (
        <View style={[styles.card, style]} {...rest}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
        padding: theme.spacing.l,
        shadowColor: theme.colors.cardShadow,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 4, // for android
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
});
