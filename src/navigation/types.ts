import { NavigatorScreenParams } from '@react-navigation/native';

export type BottomTabParamList = {
    Home: undefined;
    Library: undefined;
    Streaks: undefined;
    Settings: undefined;
};

export type RootStackParamList = {
    Auth: undefined;
    Welcome: undefined;
    MainTabs: NavigatorScreenParams<BottomTabParamList>;
    BookDashboard: { bookId: string; clickedBookId?: string; clickedTitle?: string };
    Play:
        | { verseId: string; bookId: string; autoPlay?: boolean; position?: number; startPosition?: number; resumeSource?: string }
        | { itemId: string; bookId: string; autoPlay?: boolean; position?: number; startPosition?: number; resumeSource?: string };
    CommunityWisdom: undefined;
    About: undefined;
    SupportMangalam: undefined;
    WebView: { url: string };
};
