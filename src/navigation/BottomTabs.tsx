import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useEffect } from 'react';

import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StreaksScreen } from '../screens/StreaksScreen';

import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';
import { BottomTabParamList } from './types';
import { View } from 'react-native';

const Tab = createBottomTabNavigator<BottomTabParamList>();

const TabBarHeightSync = () => {
    const tabBarHeight = useBottomTabBarHeight();

    useEffect(() => {
        const current = useAppStore.getState().tabBarHeight;
        if (current !== tabBarHeight) {
            useAppStore.getState().setTabBarHeight(tabBarHeight);
        }
    }, [tabBarHeight]);

    return null;
};

export const BottomTabs = () => {
    const { colors, typography } = useTheme();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'home';

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Library') {
                        iconName = focused ? 'book' : 'book-outline';
                    } else if (route.name === 'Streaks') {
                        iconName = focused ? 'flame' : 'flame-outline';
                    } else if (route.name === 'Settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: colors.activeTab,
                tabBarInactiveTintColor: colors.inactiveTab,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarLabelStyle: {
                    fontFamily: typography.fontFamilies.medium,
                    fontSize: 12,
                }
            })}
        >
            <Tab.Screen name="Home">
                {() => (
                    <>
                        <TabBarHeightSync />
                        <HomeScreen />
                    </>
                )}
            </Tab.Screen>
            <Tab.Screen name="Library" component={LibraryScreen} />
            <Tab.Screen name="Streaks" component={StreaksScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    </View>
    );
};
