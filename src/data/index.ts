import { gitaVerses } from './mockGita';
import { mahabharatEpisodes } from './mockMahabharat';
import { ramayanEpisodes } from './mockRamayan';
import { shivPuranEpisodes } from './mockShivPuran';
import { upanishadVerses } from './mockUpanishads';
import { ContentPath, GitaVerse } from './types';

export const allContent = {
    gita: gitaVerses,
    ramayan: ramayanEpisodes,
    mahabharat: mahabharatEpisodes,
    shiv_puran: shivPuranEpisodes,
    upanishads: upanishadVerses,
};

export const getContentItem = (itemId: string, type: ContentPath) => {
    const collection = allContent[type] as any[];
    return collection.find(item => item.id === itemId);
};

export const getVersesByChapter = (type: 'gita' | 'upanishads' = 'gita') => {
    const verses = (type === 'gita' ? gitaVerses : upanishadVerses) as GitaVerse[];
    const chapters: { chapterNumber: number; verses: GitaVerse[] }[] = [];

    verses.forEach((v) => {
        let chapter = chapters.find((c) => c.chapterNumber === v.chapter);
        if (!chapter) {
            chapter = { chapterNumber: v.chapter, verses: [] };
            chapters.push(chapter);
        }
        chapter.verses.push(v);
    });

    return chapters;
};
