import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Navigators & Screens
import { useAuth } from '../auth/AuthProvider';
import { MiniPlayer } from '../components/MiniPlayer';
import { AboutScreen } from '../screens/AboutScreen';
import { BookDashboardScreen } from '../screens/BookDashboardScreen';
import { CommunityWisdomScreen } from '../screens/CommunityWisdomScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { SupportMangalamScreen } from '../screens/SupportMangalamScreen';
import { WebViewScreen } from '../screens/WebViewScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { BottomTabs } from './BottomTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

import { navigationRef } from './navigationRef';
import { logger } from '../lib/logger';

function getActiveRouteName(state: any): string | null {
    if (!state || !state.routes) return null;
    let route = state.routes[state.index];
    while (route.state) {
        route = route.state.routes[route.state.index];
    }
    return route.name;
}

const UnauthenticatedApp = () => (
    <Stack.Navigator
        screenOptions={{
            headerShown: false,
        }}
    >
        <Stack.Screen name="Auth" component={LoginScreen} />
    </Stack.Navigator>
);

const AuthenticatedApp = () => {
    const hasCompletedOnboarding = useAppStore((state) => state.hasCompletedOnboarding);

    return (
        <View style={{ flex: 1 }}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                }}
            >
                {!hasCompletedOnboarding ? (
                    <Stack.Screen name="Welcome" component={WelcomeScreen} />
                ) : (
                    <>
                        <Stack.Screen name="MainTabs" component={BottomTabs} />
                        <Stack.Screen
                            name="BookDashboard"
                            component={BookDashboardScreen}
                            options={{
                                presentation: 'modal',
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="Play"
                            component={PlayScreen}
                            options={{
                                presentation: 'modal',
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="CommunityWisdom"
                            component={CommunityWisdomScreen}
                            options={{
                                presentation: 'modal',
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="About"
                            component={AboutScreen}
                            options={{
                                headerShown: false,
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="SupportMangalam"
                            component={SupportMangalamScreen}
                            options={{
                                headerShown: false,
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="WebView"
                            component={WebViewScreen}
                            options={{
                                headerShown: false,
                                animation: 'slide_from_right',
                            }}
                        />
                    </>
                )}
            </Stack.Navigator>
            <MiniPlayer />
        </View>
    );
};

const AuthLoadingScreen = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="small" color={colors.primary} />
        </View>
    );
};


export const AppNavigator = () => {
    const { loading, isProfileLoading, session } = useAuth();
    const { colors, themeMode } = useTheme();

    const currentTheme = useMemo(() => ({
        ...DefaultTheme,
        colors: {
            ...DefaultTheme.colors,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.border,
            primary: colors.primary,
        },
    }), [colors]);

    const linking = {
        prefixes: ['mangalamapp://'],
        subscribe(listener: (url: string) => void) {
            const onReceiveURL = ({ url }: { url: string }) => {
                // OAuth callbacks are handled by supabaseClient.ts (token extraction + setSession).
                // Swallow them here to prevent React Navigation from trying to match them as routes.
                if (url.includes('login-callback')) {
                    logger.log('[LINKING] OAuth callback intercepted (handled by auth flow)');
                    return;
                }
                listener(url);
            };

            const subscription = Linking.addEventListener('url', onReceiveURL);
            return () => subscription.remove();
        },
    };

    return (
        <View style={styles.root}>
            <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
            {loading || isProfileLoading ? (
                <AuthLoadingScreen />
            ) : (
                <NavigationContainer 
                    ref={navigationRef}
                    theme={currentTheme} 
                    linking={linking}
                    onReady={() => {
                        const routeName = getActiveRouteName(navigationRef.getRootState());
                        useAppStore.getState().setCurrentRouteName(routeName);
                    }}
                    onStateChange={() => {
                        const previousRouteName = useAppStore.getState().currentRouteName;
                        const currentRouteName = getActiveRouteName(navigationRef.getRootState());

                        if (previousRouteName !== currentRouteName) {
                            useAppStore.getState().setCurrentRouteName(currentRouteName);
                        }
                    }}
                >
                    {session ? <AuthenticatedApp /> : <UnauthenticatedApp />}
                </NavigationContainer>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
