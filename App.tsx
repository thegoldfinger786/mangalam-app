import * as Sentry from '@sentry/react-native';
import {
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    useFonts,
} from '@expo-google-fonts/outfit';
import { setAudioModeAsync } from 'expo-audio';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { AppNavigator } from './src/navigation';
import { ThemeProvider } from './src/theme';

import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || '',
    enabled: !__DEV__ && !!(process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
});

function App() {
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
                <AuthProvider>
                    <AppNavigator />
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}

export default Sentry.wrap(App);
