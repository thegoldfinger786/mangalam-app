import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    useFonts
} from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation';

export default function App() {
    const [fontsLoaded] = useFonts({
        Outfit_400Regular,
        Outfit_500Medium,
        Outfit_600SemiBold,
    });

    if (!fontsLoaded) {
        return null; // Or a simple splash screen
    }

    return (
        <SafeAreaProvider>
            <StatusBar style="auto" />
            <AppNavigator />
        </SafeAreaProvider>
    );
}
