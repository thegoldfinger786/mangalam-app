import { NavigatorScreenParams } from '@react-navigation/native';

/** Minimal book identity carried between the Library stack screens. */
export type LibraryBook = {
    bookId: string;
    slug: string;
    title: string;
};

export type LibraryStackParamList = {
    LibraryBooks: undefined;
    BookDetail: { book: LibraryBook };
    ChapterVerses: { book: LibraryBook; chapterNo: number };
};

export type BottomTabParamList = {
    Home: undefined;
    Library: NavigatorScreenParams<LibraryStackParamList> | undefined;
    Journey: undefined;
    Settings: undefined;
};

export type RootStackParamList = {
    Auth: undefined;
    Onboarding: undefined;
    MainTabs: NavigatorScreenParams<BottomTabParamList>;
    Play:
        | { verseId: string; bookId: string; autoPlay?: boolean; position?: number; startPosition?: number; resumeSource?: string }
        | { itemId: string; bookId: string; autoPlay?: boolean; position?: number; startPosition?: number; resumeSource?: string };
    CommunityWisdom: undefined;
    About: undefined;
    SupportMangalam: undefined;
};
