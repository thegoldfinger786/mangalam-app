import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ScreenContainerProps extends ViewProps {
    children: React.ReactNode;
    backgroundColor?: string;
    edges?: ('top' | 'bottom')[];
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ 
    children, 
    style, 
    backgroundColor,
    edges = ['top', 'bottom'],
    ...props 
}) => {
    const insets = useSafeAreaInsets();

    return (
        <View 
            style={[
                styles.container,
                {
                    paddingTop: edges.includes('top') ? Math.max(insets.top, 0) : 0,
                    paddingBottom: edges.includes('bottom') ? Math.max(insets.bottom, 0) : 0,
                    backgroundColor: backgroundColor || 'transparent',
                },
                style
            ]}
            {...props}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
