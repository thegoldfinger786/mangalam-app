import * as AppleAuthentication from 'expo-apple-authentication';
import React, { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { GoogleIcon } from './GoogleIcon';

export const AuthButtonWrapper = ({ children }: { children: ReactNode }) => {
    const { spacing } = useTheme();
    return (
        <View style={{ gap: spacing.m, width: '100%', marginTop: spacing.s }}>
            {children}
        </View>
    );
};

export const AppleAuthButton = ({ onPress, disabled, loading }: { onPress: () => void; disabled?: boolean; loading?: boolean }) => {
    const { borderRadius } = useTheme();
    
    // expo-apple-authentication button renders on iOS, but falls back or throws on Android without specific web setup.
    // For a premium native build, Apple login is typically shown on iOS.
    if (Platform.OS !== 'ios') return null;
    
    return (
        <View style={{ width: '100%', opacity: loading ? 0.9 : 1 }} pointerEvents={(disabled || loading) ? 'none' : 'auto'}>
            <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={borderRadius.m}
                style={styles.appleButton}
                onPress={onPress}
            />
            {loading && (
                <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator color="#FFFFFF" />
                </View>
            )}
        </View>
    );
};

export const GoogleAuthButton = ({ onPress, disabled, loading }: { onPress: () => void; disabled?: boolean; loading?: boolean }) => {
    const { colors, typography, borderRadius } = useTheme();
    return (
        <Pressable
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.googleButton,
                {
                    backgroundColor: '#FFFFFF',
                    borderColor: 'rgba(0,0,0,0.15)',
                    borderRadius: borderRadius.m,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 1,
                    elevation: 1,
                }
            ]}
            onPress={onPress}
        >
            {loading ? (
                <ActivityIndicator color="#1F2024" />
            ) : (
                <>
                    <View style={styles.iconContainer}>
                        <GoogleIcon size={20} />
                    </View>
                    <Text style={[styles.googleButtonText, { fontFamily: typography.fontFamilies.medium, color: '#1F2937' }]}>
                        Continue with Google
                    </Text>
                </>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    appleButton: {
        width: '100%',
        minHeight: 44, // Let Apple dictate natural height, but provide a natural sensible min fallback.
    },
    googleButton: {
        width: '100%',
        height: 44, // Match Apple button precisely
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    iconContainer: {
        position: 'absolute',
        left: 20, // Match typical Apple icon placement
    },
    googleButtonText: {
        fontSize: 18, // Matches Apple Button's standard 18-19pt
        fontWeight: '500',
        color: '#1F2024',
    }
});
