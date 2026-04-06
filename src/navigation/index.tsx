import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';

// Navigators & Screens
import { getSession, onAuthStateChange } from '../lib/supabase';
import { AuthScreen } from '../screens/AuthScreen';
import { BookDashboardScreen } from '../screens/BookDashboardScreen';
import { CommunityWisdomScreen } from '../screens/CommunityWisdomScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { SupportMangalamScreen } from '../screens/SupportMangalamScreen';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { BottomTabs } from './BottomTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
    const { session, setSession, hasCompletedOnboarding } = useAppStore();
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

    useEffect(() => {
        let isMounted = true;

        const loadSession = async () => {
            const session = await getSession();
            if (isMounted) {
                setSession(session);
            }
        };

        void loadSession();

        const subscription = onAuthStateChange((_event, session) => {
            if (isMounted) {
                setSession(session);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [setSession]);

    return (
        <NavigationContainer theme={currentTheme}>
            <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                }}
            >
                {!session ? (
                    <Stack.Screen name="Auth" component={AuthScreen} />
                ) : !hasCompletedOnboarding ? (
                    <Stack.Screen name="Welcome" component={WelcomeScreen} />
                ) : (
                    <Stack.Screen name="MainTabs" component={BottomTabs} />
                )}
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
            </Stack.Navigator>
        </NavigationContainer>
    );
};
