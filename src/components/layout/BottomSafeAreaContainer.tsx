import React from 'react';
import { View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme/spacing';

export interface BottomSafeAreaContainerProps extends ViewProps {
    children: React.ReactNode;
}

export const BottomSafeAreaContainer: React.FC<BottomSafeAreaContainerProps> = ({ 
    children, 
    style, 
    ...props 
}) => {
    const insets = useSafeAreaInsets();
    
    // Default to at least spacing.md (12) padding bottom, or the notch inset.
    // This prevents overlaps with gesture bars on devices without safe area padding.
    const bottomPadding = Math.max(insets.bottom, spacing.md);

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
