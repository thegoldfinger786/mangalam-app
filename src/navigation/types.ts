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
    BookDashboard: { type: ContentPath };
    Play: { itemId: string; type: ContentPath };
    CommunityWisdom: undefined;
    About: undefined;
    SupportMangalam: undefined;
};
