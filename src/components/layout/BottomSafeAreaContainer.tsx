import React from 'react';
import { View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';

export interface BottomSafeAreaContainerProps extends ViewProps {
    children: React.ReactNode;
}

export const BottomSafeAreaContainer: React.FC<BottomSafeAreaContainerProps> = ({ 
    children, 
    style, 
    ...props 
}) => {
    const { spacing } = useTheme();
    const insets = useSafeAreaInsets();
    
    // Default to at least spacing.m padding bottom, or the notch inset.
    // This prevents overlaps with gesture bars on devices without safe area padding.
    const bottomPadding = Math.max(insets.bottom, spacing.m);

    return (
        <View 
            style={[
                { paddingBottom: bottomPadding },
                style
            ]}
            {...props}
        >
            {children}
        </View>
    );
};
