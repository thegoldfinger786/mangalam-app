import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { theme } from '../theme';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StreaksScreen } from '../screens/StreaksScreen';

import { BottomTabParamList } from './types';

const Tab = createBottomTabNavigator<BottomTabParamList>();

export const BottomTabs = () => {
    return (
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
                tabBarActiveTintColor: theme.colors.activeTab,
                tabBarInactiveTintColor: theme.colors.inactiveTab,
                tabBarStyle: {
                    backgroundColor: theme.colors.surface,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border,
                    elevation: 0, // removed shadow on android for cleaner look
                    shadowOpacity: 0, // removed shadow on ios for cleaner look
                },
                tabBarLabelStyle: {
                    fontFamily: theme.typography.fontFamilies.medium,
                    fontSize: 12,
                }
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Library" component={LibraryScreen} />
            <Tab.Screen name="Streaks" component={StreaksScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};
