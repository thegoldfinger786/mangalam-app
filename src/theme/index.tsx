import React, { createContext, useContext, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { colors, darkColors } from './colors';
import { typography } from './typography';

const baseSpacing = {
    micro: 2,
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
};

const baseBorderRadius = {
    s: 8,
    m: 12,
    l: 16,
    xl: 24,
    round: 9999,
};

const baseTheme = {
    typography,
    spacing: baseSpacing,
    borderRadius: baseBorderRadius,
    // Layout system principles:
    // - No screen-level spacing decisions
    // - Keyboard behaviour is fully token-driven
    // - Bottom spacing must respect safe area + keyboard tokens
    // - All input screens should reuse layout.welcome or equivalent semantic groups
    layout: {
        content: {
            maxWidth: baseSpacing.xxxl * 8,
        },
        keyboard: {
            animationDuration: 180,
            offset: baseSpacing.m,
            min: baseSpacing.xl + baseSpacing.s,
            max: baseSpacing.xxxl + baseSpacing.xxl + baseSpacing.s,
            edgeClearance: baseSpacing.s,
            androidHeightOffset: baseSpacing.s + baseSpacing.xs,
        },
        welcome: {
            horizontalPadding: baseSpacing.l,
            topPadding: baseSpacing.xxxl + baseSpacing.s,
            compactTopPadding: baseSpacing.xl + baseSpacing.xs,
            titleGap: baseSpacing.xxl,
            compactTitleGap: baseSpacing.l,
            questionGap: baseSpacing.s + baseSpacing.xs,
            inputGap: baseSpacing.m + baseSpacing.xs,
            buttonGap: baseSpacing.s + baseSpacing.xs,
            topSectionMinHeight: baseSpacing.xxxl + baseSpacing.xl,
            panelPadding: baseSpacing.m + baseSpacing.xs,
            panelRadius: baseBorderRadius.m,
            titleKeyboardOpacity: 0.88,
            panelBackgroundAlpha: 'B8',
            panelBorderAlpha: '99',
            fieldPaddingHorizontal: baseSpacing.l,
            fieldPaddingVertical: baseSpacing.m,
        },
        miniPlayerHeight: baseSpacing.xl * 2, // 64px
        tabBarFallbackHeight: 70, // Fallback for initial render/non-tab screens
        heroGlassPanelOverlap: baseSpacing.xxxl, // 64px
        placeholderHeight: 220, // Stable height for CurrentPath card
    },
};

export const lightTheme = {
    ...baseTheme,
    colors,
    dark: false,
};

export const darkTheme = {
    ...baseTheme,
    colors: darkColors,
    dark: true,
};

export type Theme = typeof lightTheme & { themeMode: 'light' | 'dark' };

const ThemeContext = createContext<Theme>({ ...lightTheme, themeMode: 'light' });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { themeMode } = useAppStore();

    const currentTheme = useMemo(() => {
        const theme = themeMode === 'dark' ? darkTheme : lightTheme;
        return { ...theme, themeMode: themeMode as 'light' | 'dark' };
    }, [themeMode]);

    return (
        <ThemeContext.Provider value={currentTheme}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);

// Export a placeholder static theme for initial refactoring safety (will be removed)
export const theme = lightTheme;
