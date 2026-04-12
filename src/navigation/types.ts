import { NavigatorScreenParams } from '@react-navigation/native';
import { ContentPath } from '../data/types';

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
    BookDashboard: { type: string };
    Play:
        | { verseId: string; bookId: string; type: ContentPath; position?: number }
        | { itemId: string; bookId: string; type: ContentPath; autoPlay?: boolean; position?: number };
    CommunityWisdom: undefined;
    About: undefined;
    SupportMangalam: undefined;
    WebView: { url: string };
};
