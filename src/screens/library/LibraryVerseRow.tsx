import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { VerseListRow } from '../../components/VerseListRow';
import { assertValidBookId } from '../../lib/bookIdentity';
import { navigationRef } from '../../navigation/navigationRef';
import { useAppStore } from '../../store/useAppStore';
import { useTheme } from '../../theme';

interface Props {
    verse: any;
    bookId: string;
    /** Secondary line — e.g. "Verse 12" or "Chapter 2, Verse 47". */
    contextLabel: string;
}

/** A verse row in the Library stack: tap opens Play, completed verses get a tick. */
export const LibraryVerseRow = ({ verse, bookId, contextLabel }: Props) => {
    const { colors } = useTheme();
    const completed = useAppStore((s) => s.completedVerses).includes(verse.verse_id);

    const openPlay = () => {
        if (!assertValidBookId(bookId, 'LibraryVerseRow.openPlay')) return;
        // Play lives in the root stack — navigate through the root ref, the same
        // path the mini-player uses.
        navigationRef.navigate('Play', { itemId: verse.verse_id, bookId });
    };

    return (
        <VerseListRow
            badge={verse.verse_no}
            title={verse.title || verse.sanskrit || verse.reference || 'Verse'}
            subtitle={contextLabel}
            highlighted={completed}
            onPress={openPlay}
            right={completed ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : undefined}
        />
    );
};
