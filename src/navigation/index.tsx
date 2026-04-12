import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// Navigators & Screens
import { getSupabase } from '../lib/supabaseClient';
import { useAuth } from '../auth/AuthProvider';
import { BookDashboardScreen } from '../screens/BookDashboardScreen';
import { CommunityWisdomScreen } from '../screens/CommunityWisdomScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { SupportMangalamScreen } from '../screens/SupportMangalamScreen';
import { WebViewScreen } from '../screens/WebViewScreen';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { BottomTabs } from './BottomTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
    );
};

const AuthLoadingScreen = () => {
    const { colors } = useTheme();

    return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>AUTH: LOADING</Text>
        </View>
    );
};

const AuthDebugBadge = ({ label }: { label: string }) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.debugBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.debugBadgeText, { color: colors.text }]}>{label}</Text>
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
            const onReceiveURL = async ({ url }: { url: string }) => {
                // Ignore OAuth callback so Supabase can process it
                if (url.includes('login-callback')) {
                    console.log('[LINKING] OAuth callback received:', url);

                    // 🔥 THIS IS THE FIX
                    const supabase = getSupabase();
                    const { data, error } = await supabase.auth.setSession({
                        access_token: url.split('#access_token=')[1]?.split('&')[0],
                        refresh_token: url.split('refresh_token=')[1]?.split('&')[0],
                    });

                    console.log('[AUTH] Manual session set:', data, error);

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
                <NavigationContainer theme={currentTheme} linking={linking}>
                    {session ? <AuthenticatedApp /> : <UnauthenticatedApp />}
                </NavigationContainer>
            )}
            <AuthDebugBadge
                label={loading || isProfileLoading ? 'AUTH: LOADING' : session ? 'AUTH: LOGGED IN' : 'AUTH: LOGGED OUT'}
            />
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
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    debugBadge: {
        position: 'absolute',
        top: 56,
        right: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        opacity: 0.92,
    },
    debugBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
});
