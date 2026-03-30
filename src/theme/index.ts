import { colors } from './colors';
import { typography } from './typography';

export const theme = {
    colors,
    typography,
    spacing: {
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

export type Theme = typeof theme;
