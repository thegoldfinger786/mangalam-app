import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthError, createClient } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-url-polyfill/auto';

WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Check your Expo public env vars.');
}

let _supabase: ReturnType<typeof createClient> | null = null;

export const getSupabase = () => {
    if (!_supabase) {
        console.log('[SUPABASE] client initialized');
        _supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                storage: AsyncStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false, // 🔥 IMPORTANT: we now handle manually
            },
        });
    }
    return _supabase;
};

export const supabase = (() => getSupabase())();

let isForceSigningOut = false;

const isRefreshTokenNotFoundError = (error: unknown) => {
    const authError = error as Partial<AuthError> | null;
    const code = authError?.code;
    const message = authError?.message?.toLowerCase?.() || '';

    return code === 'refresh_token_not_found' || message.includes('refresh token not found');
};

const forceLogout = async () => {
    if (isForceSigningOut) return;

    isForceSigningOut = true;
    try {
        await getSupabase().auth.signOut();
    } catch (error) {
        console.error('Error forcing sign out:', error);
    } finally {
        isForceSigningOut = false;
    }
};

export const signOut = async () => {
    try {
        const { error } = await getSupabase().auth.signOut();
        if (error) {
            console.error('Error signing out:', error.message);
        }
        return { error };
    } catch (error) {
        console.error('Error signing out:', error);
        return { error: error as AuthError };
    }
};

export const signInWithPassword = async (params: { email: string; password: string }) => {
    try {
        const result = await getSupabase().auth.signInWithPassword(params);
        if (result.error && isRefreshTokenNotFoundError(result.error)) {
            await forceLogout();
        }
        return result;
    } catch (error) {
        if (isRefreshTokenNotFoundError(error)) {
            await forceLogout();
        }
        throw error;
    }
};

export const signUp = async (params: { email: string; password: string }) => {
    try {
        const result = await getSupabase().auth.signUp(params);
        if (result.error && isRefreshTokenNotFoundError(result.error)) {
            await forceLogout();
        }
        return result;
    } catch (error) {
        if (isRefreshTokenNotFoundError(error)) {
            await forceLogout();
        }
        throw error;
    }
};

export const signInWithGoogle = async () => {
    console.log('[AUTH] Starting Google OAuth');

    try {
        const redirectUri = AuthSession.makeRedirectUri({
            scheme: 'mangalamapp',
        });

        const { data, error } = await getSupabase().auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUri,
                skipBrowserRedirect: true,
                queryParams: {
                    prompt: 'select_account',
                },
            },
        });

        if (error) {
            console.error('[AUTH] signInWithOAuth error:', error);
            return { data: null, error };
        }

        if (!data?.url) {
            return { data: null, error: new Error('No OAuth URL returned') };
        }

        console.log('[AUTH] Opening AuthSession');

        const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectUri
        );

        console.log('[AUTH] AuthSession result:', result.type);

        if (result.type !== 'success' || !result.url) {
            return { data: null, error: new Error('OAuth cancelled or failed') };
        }

        // Extract tokens
        const access_token = result.url.split('#access_token=')[1]?.split('&')[0];
        const refresh_token = result.url.split('refresh_token=')[1]?.split('&')[0];

        if (!access_token || !refresh_token) {
            return { data: null, error: new Error('Failed to extract tokens') };
        }

        // Set session
        const { data: sessionData, error: sessionError } =
            await getSupabase().auth.setSession({
                access_token,
                refresh_token,
            });

        console.log('[AUTH] Session established:', sessionData?.session?.user?.email);

        return { data: sessionData, error: sessionError };

    } catch (err) {
        console.error('[AUTH] OAuth exception:', err);
        return { data: null, error: err };
    }
};