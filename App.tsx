import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    useFonts,
} from '@expo-google-fonts/outfit';
import { setAudioModeAsync } from 'expo-audio';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation';
import { ThemeProvider } from './src/theme';

export default function App() {
    const [fontsLoaded] = useFonts({
        Outfit_400Regular,
        Outfit_500Medium,
        Outfit_600SemiBold,
    });

    useEffect(() => {
        setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: 'doNotMix',
            shouldRouteThroughEarpiece: false,
        }).catch(console.error);
    }, []);

    if (!fontsLoaded) {
        return null;
    }

    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <AppNavigator />
            </ThemeProvider>
        </SafeAreaProvider>
    );
}