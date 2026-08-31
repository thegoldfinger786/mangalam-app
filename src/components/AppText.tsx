import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../theme';
import type { TypographyRole } from '../theme/typography';

interface AppTextProps extends TextProps {
    /**
     * Semantic typography role. Defaults to `body`. See docs/DESIGN_PRINCIPLES.md
     * § Typography for the scale.
     */
    variant?: TypographyRole;
}

/**
 * The standard text primitive for Mangalam. Prefer this over a bare `<Text>`:
 *
 *   <AppText variant="heading">Your progress</AppText>
 *   <AppText variant="bodySmall" style={{ color: colors.textSecondary }}>…</AppText>
 *
 * It resolves `variant` to the responsive role style (family + size + line
 * height, all device-scaled) and applies that role's `maxFontSizeMultiplier`
 * so OS font-size settings enlarge text without breaking layout. Any `style`
 * you pass still wins (colour, alignment, an explicit size for a genuine
 * one-off). An explicit `maxFontSizeMultiplier` prop also still wins.
 */
export const AppText = ({ variant = 'body', style, maxFontSizeMultiplier, ...rest }: AppTextProps) => {
    const { typography } = useTheme();
    const role = typography.roles[variant];

    return (
        <Text
            {...rest}
            maxFontSizeMultiplier={maxFontSizeMultiplier ?? role.maxFontSizeMultiplier}
            style={[
                {
                    fontFamily: role.fontFamily,
                    fontSize: role.fontSize,
                    lineHeight: role.lineHeight,
                },
                style,
            ]}
        />
    );
};
