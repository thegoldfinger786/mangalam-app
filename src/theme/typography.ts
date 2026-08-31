import { Dimensions } from 'react-native';

/**
 * Mangalam typography foundation.
 *
 * Three layers, smallest surface first:
 *
 *   1. `fontFamilies` — the three Outfit weights the app bundles. Always set a
 *      family; a bare `fontWeight` renders in the system font, not Outfit.
 *   2. `sizes` / `lineHeights` — the primitive numeric ramp. Kept for existing
 *      call sites and for the rare component that needs an explicit value.
 *   3. `roles` — the semantic scale. **New code uses these** (via `<AppText>` or
 *      by spreading `typography.roles.body` into a style). Each role already has
 *      device scaling baked in and carries an accessibility cap.
 *
 * Responsive scaling: every size below is passed through `fontScale()`, a gentle
 * curve keyed off the device's shorter edge against a 390pt baseline (iPhone
 * 13/14/15/16 width). Mainstream phones land at ~1.0 — the visual design is
 * unchanged there. Small phones (SE) ease down to ~0.92; large phones and
 * tablets ease up, hard-capped at 1.08 so text never balloons. This is NOT a
 * flat width multiplier — the slope is deliberately shallow and clamped.
 *
 * Accessibility: OS font-size settings still apply (`allowFontScaling` stays on).
 * Each role sets a `maxFontSizeMultiplier` so a large accessibility setting
 * enlarges text without destroying headers, buttons and fixed-height rows.
 *
 * See docs/DESIGN_PRINCIPLES.md § Typography for the usage rules.
 */

const BASELINE_WIDTH = 390; // iPhone 13 / 14 / 15 / 16 logical width

const shortEdge = (): number => {
    const { width, height } = Dimensions.get('window');
    return Math.min(width, height);
};

/**
 * Gentle, clamped device-size scaling for a font size in pt.
 *
 * - ratio 1.0 (≈390pt wide) → factor 1.0, value unchanged
 * - smaller: factor eases down at half the deficit, floored at 0.92
 * - larger: factor eases up at ~a third of the surplus, capped at 1.08
 *
 * Result is rounded to the nearest 0.5pt for crisp text rendering.
 */
export const fontScale = (size: number): number => {
    const ratio = shortEdge() / BASELINE_WIDTH;
    let factor: number;
    if (ratio >= 1) {
        factor = Math.min(1 + (ratio - 1) * 0.35, 1.08);
    } else {
        factor = Math.max(1 - (1 - ratio) * 0.5, 0.92);
    }
    return Math.round(size * factor * 2) / 2;
};

const fontFamilies = {
    regular: 'Outfit_400Regular',
    medium: 'Outfit_500Medium',
    semiBold: 'Outfit_600SemiBold',
};

const rawSizes = {
    xs: 12,
    s: 14,
    m: 16,
    l: 18,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    hero: 72,
};

const rawLineHeights = {
    s: 20,
    m: 24,
    l: 28,
    xl: 32,
    xxl: 40,
};

const sizes = Object.fromEntries(
    Object.entries(rawSizes).map(([k, v]) => [k, fontScale(v)]),
) as typeof rawSizes;

const lineHeights = Object.fromEntries(
    Object.entries(rawLineHeights).map(([k, v]) => [k, fontScale(v)]),
) as typeof rawLineHeights;

/**
 * Semantic typography roles. Each is a ready-to-spread text style plus a
 * `maxFontSizeMultiplier` accessibility cap.
 *
 * | role         | ~size | use for                                              |
 * |--------------|-------|------------------------------------------------------|
 * | display      | 32    | screen hero titles ("Mangalam"), large hero numbers   |
 * | title        | 24    | greeting, primary card titles, screen section heroes  |
 * | heading      | 20    | card titles, section headers, dialog titles           |
 * | subheading   | 18    | sub-headers, list-group headers, prominent labels     |
 * | body         | 16    | primary reading / paragraph text                      |
 * | bodySmall    | 14    | secondary text, descriptions, helper copy             |
 * | caption      | 13    | footnotes, timestamps, disclaimers                    |
 * | label        | 12    | uppercase tags, tab-bar labels, metadata, overlines   |
 * | button       | 16    | text inside buttons / primary tap targets             |
 */
const roles = {
    display: {
        fontFamily: fontFamilies.semiBold,
        fontSize: fontScale(32),
        lineHeight: fontScale(40),
        maxFontSizeMultiplier: 1.3,
    },
    title: {
        fontFamily: fontFamilies.semiBold,
        fontSize: fontScale(24),
        lineHeight: fontScale(32),
        maxFontSizeMultiplier: 1.3,
    },
    heading: {
        fontFamily: fontFamilies.semiBold,
        fontSize: fontScale(20),
        lineHeight: fontScale(28),
        maxFontSizeMultiplier: 1.35,
    },
    subheading: {
        fontFamily: fontFamilies.semiBold,
        fontSize: fontScale(18),
        lineHeight: fontScale(26),
        maxFontSizeMultiplier: 1.4,
    },
    body: {
        fontFamily: fontFamilies.regular,
        fontSize: fontScale(16),
        lineHeight: fontScale(24),
        maxFontSizeMultiplier: 1.6,
    },
    bodySmall: {
        fontFamily: fontFamilies.regular,
        fontSize: fontScale(14),
        lineHeight: fontScale(20),
        maxFontSizeMultiplier: 1.6,
    },
    caption: {
        fontFamily: fontFamilies.regular,
        fontSize: fontScale(13),
        lineHeight: fontScale(18),
        maxFontSizeMultiplier: 1.5,
    },
    label: {
        fontFamily: fontFamilies.medium,
        fontSize: fontScale(12),
        lineHeight: fontScale(16),
        maxFontSizeMultiplier: 1.4,
    },
    button: {
        fontFamily: fontFamilies.medium,
        fontSize: fontScale(16),
        lineHeight: fontScale(20),
        maxFontSizeMultiplier: 1.4,
    },
} as const;

export type TypographyRole = keyof typeof roles;

export const typography = {
    fontFamilies,
    sizes,
    lineHeights,
    roles,
};
