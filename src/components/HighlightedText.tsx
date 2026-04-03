import React, { useMemo } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useTheme } from '../theme';

interface HighlightedTextProps {
    text: string;
    progress: number; // 0 to 1
    style?: StyleProp<TextStyle>;
    activeColor?: string;
    inactiveColor?: string;
}

export const HighlightedText = ({ text, progress, style, activeColor, inactiveColor }: HighlightedTextProps) => {
    const { colors } = useTheme();
    const active = activeColor || colors.text;
    const inactive = inactiveColor || colors.textSecondary;

    // Clean SSML and markdown artifacts before display
    const cleanedText = useMemo(() => {
        if (!text) return '';
        return text
            .replace(/<break\s+time="[^"]*"\s*\/>/gi, '') // strip <break time="500ms"/>
            .replace(/<break\s*\/>/gi, '')                 // strip <break/>
            .replace(/\*\*/g, '')                          // strip markdown bold
            .replace(/\s{2,}/g, ' ')                       // collapse extra spaces
            .trim();
    }, [text]);

    // Split text into sentences and calculate cumulative lengths for better syncing
    const sentenceData = useMemo(() => {
        if (!cleanedText) return [];
        // Improved sentence-splitting: match any block ending with punctuation (or newline) without requiring a following space.
        const matches = cleanedText.match(/[^.!?।॥\n]+[.!?।॥\n]*["']?/g);
        const sentences = matches ? matches.map(s => s.trim()).filter(Boolean) : [cleanedText];
        
        const getWeightedLength = (t: string) => {
            let weight = 0;
            for (let i = 0; i < t.length; i++) {
                const code = t.charCodeAt(i);
                if (code >= 0x0900 && code <= 0x097F) {
                    weight += 2.0; 
                } else if (t[i] === '\n') {
                    weight += 15.0;
                } else if (/[.,!?;।॥]/.test(t[i])) {
                    weight += 25.0; 
                } else {
                    weight += 1.0;
                }
            }
            return weight;
        };

        const totalWeightedLength = getWeightedLength(cleanedText) || 1;
        let currentPos = 0;
        
        return sentences.map((sentence) => {
            const startIndex = cleanedText.indexOf(sentence, currentPos);
            const endIndex = startIndex + sentence.length;
            currentPos = endIndex;

            const start = getWeightedLength(cleanedText.substring(0, startIndex)) / totalWeightedLength;
            const end = getWeightedLength(cleanedText.substring(0, endIndex)) / totalWeightedLength;

            return { sentence, start, end };
        });
    }, [cleanedText]);

    if (!sentenceData.length) return null;

    return (
        <Text style={style}>
            {sentenceData.map((data, index) => {
                // A sentence is active if the progress falls within its range
                const isActive = progress >= data.start && progress < data.end;
                // Exception for the very last sentence when progress is 1.0
                const isVeryEnd = index === sentenceData.length - 1 && progress >= 0.99;
                
                const color = (isActive || isVeryEnd) ? active : inactive;
                
                return (
                    <Text key={index} style={{ color, fontWeight: (isActive || isVeryEnd) ? '500' : 'normal' }}>
                        {data.sentence}{index < sentenceData.length - 1 ? ' ' : ''}
                    </Text>
                );
            })}
        </Text>
    );
};
