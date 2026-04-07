import React, { createContext, useContext, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { colors, darkColors } from './colors';
import { typography } from './typography';

const baseTheme = {
    typography,
    spacing: {
        micro: 2,
        xs: 4,
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
        xxl: 48,
        xxxl: 64,
    },
    borderRadius: {
        s: 8,
        m: 12,
        l: 16,
        xl: 24,
        round: 9999,
    }
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
