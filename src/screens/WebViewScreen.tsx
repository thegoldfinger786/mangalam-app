import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type WebViewRouteProp = RouteProp<RootStackParamList, 'WebView'>;

export const WebViewScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<WebViewRouteProp>();
    const { colors, spacing, typography, borderRadius } = useTheme();
    const { url } = route.params;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>
            <WebView source={{ uri: url }} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: 56,
        justifyContent: 'center',
        borderBottomWidth: 1,
    },
    backButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
