import { PRONUNCIATION_ATLAS } from './pronunciation_atlas.js';

/**
 * Escapes special characters for SSML.
 */
function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

/**
 * Processes text into SSML format with phonetic overrides from the atlas.
 */
export function processToSsml(text: string): string {
    if (!text) return '<speak></speak>';

    // Escape basic XML first
    let processed = escapeXml(text);

    // Sort keys by length descending to ensure "Vishwamitr" doesn't partially match "Vishwamitr" vs others
    const sortedKeys = Object.keys(PRONUNCIATION_ATLAS).sort((a, b) => b.length - a.length);

    // Replace words with aliases
    for (const word of sortedKeys) {
        const alias = PRONUNCIATION_ATLAS[word];
        // Use word boundary to avoid partial matches (e.g., "Sumit" in "Sumitra")
        // Note: SSML <sub> tag is used for substitution
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        processed = processed.replace(regex, `<sub alias="${alias}">${word}</sub>`);
    }

    return `<speak>${processed}</speak>`;
}
