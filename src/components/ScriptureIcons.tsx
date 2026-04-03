import React from 'react';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';

interface IconProps {
    size?: number;
    color?: string;
}

/**
 * Sudarshan Chakra — Bhagavad Gita
 * A stylized disc weapon with spokes and serrated edges
 */
export const SudarshanChakraIcon: React.FC<IconProps> = ({ size = 32, color = '#E88B4A' }) => (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Outer serrated ring */}
        <Path
            d="M32 2L36.5 8.5L42 3.5L44 11L50 7.5L50 15.5L56.5 13.5L54.5 21L61 21L57 27.5L62 30L57 34L62 38L56.5 40L59 47L53 46L54 53L48 50.5L47 57L41.5 53L39 59.5L34.5 54.5L32 61L29.5 54.5L25 59.5L22.5 53L17 57L16 50.5L10 53L11 46L5 47L7.5 40L2 38L7 34L2 30L7 27.5L3 21L9.5 21L7.5 13.5L14 15.5L14 7.5L20 11L22 3.5L27.5 8.5L32 2Z"
            fill={color}
            opacity={0.15}
            stroke={color}
            strokeWidth={1.5}
        />
        {/* Middle ring */}
        <Circle cx="32" cy="32" r="18" stroke={color} strokeWidth={2.5} fill="none" />
        {/* Inner ring */}
        <Circle cx="32" cy="32" r="10" stroke={color} strokeWidth={2} fill="none" />
        {/* Center dot */}
        <Circle cx="32" cy="32" r="3" fill={color} />
        {/* Spokes */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 32 + 10 * Math.cos(rad);
            const y1 = 32 + 10 * Math.sin(rad);
            const x2 = 32 + 18 * Math.cos(rad);
            const y2 = 32 + 18 * Math.sin(rad);
            return (
                <Line
                    key={angle}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color} strokeWidth={2} strokeLinecap="round"
                />
            );
        })}
        {/* Spoke tips (small dots at end of spokes) */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const cx = 32 + 18 * Math.cos(rad);
            const cy = 32 + 18 * Math.sin(rad);
            return <Circle key={`tip-${angle}`} cx={cx} cy={cy} r={2} fill={color} />;
        })}
        {/* Inner triangles (yantra-style) */}
        <Polygon points="32,24 27,36 37,36" stroke={color} strokeWidth={1.5} fill="none" />
        <Polygon points="32,40 27,28 37,28" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
);

/**
 * Bow & Arrow (Dhanush) — Ramayana
 * Taut bow being pulled back, arrow tip visible above the bow peak.
 */
export const BowArrowIcon: React.FC<IconProps> = ({ size = 32, color = '#DE5D3D' }) => (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Bow curve (arched top) - Lowered slightly to allow arrow tip to show */}
        <Path
            d="M8 40C8 26 18 18 32 18C46 18 56 26 56 40"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
        />
        {/* Taut bowstring (pulled to the tail of arrow at y=52) */}
        <Path
            d="M8 40L32 52L56 40"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Arrow shaft (extending well above the bow apex at y=18) */}
        <Path d="M32 52V6" stroke={color} strokeWidth={3.5} strokeLinecap="round" />
        {/* Arrowhead (clearly popping out above the bow peak) */}
        <Path d="M32 2L25 14H39L32 2Z" fill={color} />
        {/* Arrow fletching/nock at the bottom */}
        <Path d="M28 58L32 52L36 58" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
);
/**
 * Crossed Swords — Mahabharata
 * Swords crossed and pointing UP to match reference.
 */
export const CrossedSwordsIcon: React.FC<IconProps> = ({ size = 32, color = '#D6A621' }) => (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Sword 1: bottom-left to top-right */}
        <Path d="M18 52L46 14" stroke={color} strokeWidth={4} strokeLinecap="round" />
        {/* Sword 1 guard */}
        <Path d="M14 44L28 48" stroke={color} strokeWidth={3} strokeLinecap="round" />
        {/* Sword 1 hilt/pommel */}
        <Circle cx="16" cy="54" r="4" fill={color} />

        {/* Sword 2: bottom-right to top-left */}
        <Path d="M46 52L18 14" stroke={color} strokeWidth={4} strokeLinecap="round" />
        {/* Sword 2 guard */}
        <Path d="M50 44L36 48" stroke={color} strokeWidth={3} strokeLinecap="round" />
        {/* Sword 2 hilt/pommel */}
        <Circle cx="48" cy="54" r="4" fill={color} />

        {/* Blade tips (upward triangles) */}
        <Path d="M46 14L41 8L50 11Z" fill={color} />
        <Path d="M18 14L23 8L14 11Z" fill={color} />
    </Svg>
);

/**
 * Trident (Trishul) — Shiv Puran
 */
export const TridentIcon: React.FC<IconProps> = ({ size = 32, color = '#5C7485' }) => (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Central shaft */}
        <Line x1="32" y1="18" x2="32" y2="58" stroke={color} strokeWidth={3} strokeLinecap="round" />
        {/* Center prong */}
        <Line x1="32" y1="6" x2="32" y2="22" stroke={color} strokeWidth={3} strokeLinecap="round" />
        {/* Center prong tip */}
        <Polygon points="32,4 29,12 35,12" fill={color} />
        {/* Left prong */}
        <Path d="M32 22C28 20 22 16 18 10" stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" />
        {/* Left prong tip */}
        <Polygon points="18,8 15,16 21,14" fill={color} />
        {/* Right prong */}
        <Path d="M32 22C36 20 42 16 46 10" stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" />
        {/* Right prong tip */}
        <Polygon points="46,8 43,14 49,16" fill={color} />
        {/* Decorative cross-bar */}
        <Ellipse cx="32" cy="22" rx="6" ry="2" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
);

/**
 * Book with Feather — Upanishads / Purana
 */
export const BookFeatherIcon: React.FC<IconProps> = ({ size = 32, color = '#568E65' }) => (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Book body */}
        <Rect x="14" y="20" width="36" height="32" rx="3" stroke={color} strokeWidth={2.5} fill="none" />
        {/* Book spine */}
        <Line x1="32" y1="20" x2="32" y2="52" stroke={color} strokeWidth={2} />
        {/* Book pages (left) */}
        <Line x1="18" y1="28" x2="28" y2="28" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Line x1="18" y1="33" x2="28" y2="33" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Line x1="18" y1="38" x2="28" y2="38" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        {/* Book pages (right) */}
        <Line x1="36" y1="28" x2="46" y2="28" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Line x1="36" y1="33" x2="46" y2="33" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Line x1="36" y1="38" x2="46" y2="38" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        {/* Feather quill */}
        <Path
            d="M38 8C42 12 44 18 40 24C44 20 48 14 46 8C44 4 40 6 38 8Z"
            fill={color}
            opacity={0.3}
            stroke={color}
            strokeWidth={1.5}
        />
        {/* Feather shaft */}
        <Path d="M40 24L42 8" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        {/* Radiating lines (wisdom glow) */}
        {[150, 170, 190, 210].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 32 + 26 * Math.cos(rad);
            const y1 = 36 + 26 * Math.sin(rad);
            const x2 = 32 + 30 * Math.cos(rad);
            const y2 = 36 + 30 * Math.sin(rad);
            return (
                <Line key={angle} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color} strokeWidth={1.5} strokeLinecap="round" opacity={0.4}
                />
            );
        })}
        {[-30, -10, 10, 30].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 32 + 26 * Math.cos(rad);
            const y1 = 36 + 26 * Math.sin(rad);
            const x2 = 32 + 30 * Math.cos(rad);
            const y2 = 36 + 30 * Math.sin(rad);
            return (
                <Line key={`r-${angle}`} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color} strokeWidth={1.5} strokeLinecap="round" opacity={0.4}
                />
            );
        })}
    </Svg>
);

/**
 * Helper function to get the correct scripture icon component by slug.
 * Drop-in replacement for <Ionicons name={...} size={...} color={...} />
 */
export const getScriptureIcon = (slug: string, size: number = 32, color?: string): React.ReactElement => {
    switch (slug) {
        case 'gita':
            return <SudarshanChakraIcon size={size} color={color || '#E88B4A'} />;
        case 'ramayan':
            return <BowArrowIcon size={size} color={color || '#DE5D3D'} />;
        case 'mahabharat':
            return <CrossedSwordsIcon size={size} color={color || '#D6A621'} />;
        case 'shiv_puran':
            return <TridentIcon size={size} color={color || '#5C7485'} />;
        case 'upanishads':
            return <BookFeatherIcon size={size} color={color || '#568E65'} />;
        default:
            return <BookFeatherIcon size={size} color={color || '#568E65'} />;
    }
};
