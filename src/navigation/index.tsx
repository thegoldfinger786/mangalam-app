import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';

// Navigators & Screens
import { supabase } from '../lib/supabase';
import { AuthScreen } from '../screens/AuthScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';
import { BottomTabs } from './BottomTabs';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        primary: theme.colors.primary,
    },
};

export const AppNavigator = () => {
    const { session, setSession, hasCompletedOnboarding } = useAppStore();

    useEffect(() => {
        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, [setSession]);

    return (
        <NavigationContainer theme={AppTheme}>
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
                    name="Play"
                    component={PlayScreen}
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
};
