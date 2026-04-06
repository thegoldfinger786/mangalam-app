import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthChangeEvent, AuthError, Session, createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

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
        await supabase.auth.signOut();
    } catch (error) {
        console.error('Error forcing sign out:', error);
    } finally {
        isForceSigningOut = false;
    }
};

export const getSession = async () => {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
            if (isRefreshTokenNotFoundError(error)) {
                await forceLogout();
                return null;
            }
            console.error('Error getting session:', error.message);
            return null;
        }
        if (!data.session) {
            return null;
        }
        return data.session;
    } catch (error) {
        if (isRefreshTokenNotFoundError(error)) {
            await forceLogout();
            return null;
        }
        console.error('Error getting session:', error);
        return null;
    }
};

export const signOut = async () => {
    try {
        const { error } = await supabase.auth.signOut();
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
        const result = await supabase.auth.signInWithPassword(params);
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
        const result = await supabase.auth.signUp(params);
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

export const onAuthStateChange = (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESH_FAILED' || !session) {
            void forceLogout();
            callback(event, null);
            return;
        }
        callback(event, session);
    });
    return subscription;
};
