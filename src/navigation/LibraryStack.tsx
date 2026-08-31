import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { BookDetailScreen } from '../screens/library/BookDetailScreen';
import { ChapterVersesScreen } from '../screens/library/ChapterVersesScreen';
import { LibraryBooksScreen } from '../screens/library/LibraryBooksScreen';
import { LibraryStackParamList } from './types';

const Stack = createNativeStackNavigator<LibraryStackParamList>();

/**
 * The Library tab is a real stack: Books → BookDetail → ChapterVerses, so the
 * iOS edge-swipe and Android hardware back both unwind it. Each screen renders
 * its own `ScreenHeader`; the tab bar stays visible throughout.
 */
export const LibraryStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="LibraryBooks" component={LibraryBooksScreen} />
        <Stack.Screen name="BookDetail" component={BookDetailScreen} />
        <Stack.Screen name="ChapterVerses" component={ChapterVersesScreen} />
    </Stack.Navigator>
);
