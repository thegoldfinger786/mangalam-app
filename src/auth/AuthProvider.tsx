import { Session } from '@supabase/supabase-js';
import React, {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    getSupabase,
    signInWithGoogle as startGoogleOAuth,
} from '../lib/supabaseClient';
import { useAppStore } from '../store/useAppStore';

type AuthContextValue = {
    loading: boolean;
    authLoading: boolean;
    isProfileLoading: boolean;
    session: Session | null;
    signInWithGoogle: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_LOADING_TIMEOUT_MS = 15000;

async function fetchUserProfile(userId: string) {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('[AUTH] Profile fetch error:', error);
        return null;
    }

    return data;
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
    console.log('[AUTH PROVIDER] mounted');
    const setAuthState = useAppStore((state) => state.setAuthState);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(false);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [session, setSession] = useState<Session | null>(null);
    const authLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeOAuthRequestIdRef = useRef<number | null>(null);
    const oauthRequestCounterRef = useRef(0);

    const clearAuthLoadingTimeout = useCallback(() => {
        if (authLoadingTimeoutRef.current) {
            clearTimeout(authLoadingTimeoutRef.current);
            authLoadingTimeoutRef.current = null;
        }
    }, []);

    const clearActiveOAuthAttempt = useCallback(() => {
        activeOAuthRequestIdRef.current = null;
    }, []);

    const resetAuthLoading = useCallback(() => {
        clearAuthLoadingTimeout();
        clearActiveOAuthAttempt();
        setAuthLoading(false);
    }, [clearActiveOAuthAttempt, clearAuthLoadingTimeout]);

    const startOAuthAttempt = useCallback(() => {
        oauthRequestCounterRef.current += 1;
        const requestId = oauthRequestCounterRef.current;
        activeOAuthRequestIdRef.current = requestId;

        clearAuthLoadingTimeout();
        authLoadingTimeoutRef.current = setTimeout(() => {
            if (activeOAuthRequestIdRef.current !== requestId) {
                return;
            }
            console.log('[AUTH] authLoading timeout reached; resetting pending state');
            activeOAuthRequestIdRef.current = null;
            setAuthLoading(false);
            authLoadingTimeoutRef.current = null;
        }, AUTH_LOADING_TIMEOUT_MS);

        return requestId;
    }, [clearAuthLoadingTimeout]);

    const applySession = useCallback(async (nextSession: Session | null) => {
        console.log('[AUTH] applySession called', nextSession);
        setIsProfileLoading(true);
        try {
            if (nextSession?.user?.id) {
                const profile = await fetchUserProfile(nextSession.user.id);
                const { setHasCompletedOnboarding, setUserName } = useAppStore.getState();

                if (!profile || !profile.display_name) {
                    console.log('[AUTH] First-time user → navigate to Welcome');
                    setHasCompletedOnboarding(false);
                } else {
                    console.log('[AUTH] Existing user → navigate to Home');
                    setHasCompletedOnboarding(true);
                    setUserName(profile.display_name);
                }
            }

            console.log('[AUTH] Applying session:', nextSession?.user?.email);
            setSession(nextSession);
            setAuthState(nextSession); // keep Zustand if needed
        } finally {
            setIsProfileLoading(false);
        }
    }, [setAuthState]);

    useEffect(() => {
        let isMounted = true;
        let subscription: { unsubscribe: () => void } | null = null;

        const bootstrapSession = async () => {
            const supabase = getSupabase();
            try {
                const { data, error } = await supabase.auth.getSession();

                if (!isMounted) return;

                if (error) {
                    console.error('[AUTH] Initial session error:', error);
                    applySession(null);
                } else {
                    console.log('[AUTH] Initial session check done');
                    applySession(data.session);
                }
            } catch (error) {
                if (!isMounted) return;
                console.error('[AUTH] Initial session bootstrap failed:', error);
                applySession(null);
            } finally {
                if (!isMounted) return;

                setLoading(false);

                const authListener = supabase.auth.onAuthStateChange((event, session) => {
                    console.log('[AUTH] Event:', event);
                    applySession(session);
                    if (activeOAuthRequestIdRef.current !== null) {
                        resetAuthLoading();
                    } else {
                        clearAuthLoadingTimeout();
                        setAuthLoading(false);
                    }
                });

                subscription = authListener.data.subscription;
            }
        };

        void bootstrapSession();

        return () => {
            isMounted = false;
            resetAuthLoading();
            subscription?.unsubscribe();
        };
    }, [applySession, clearAuthLoadingTimeout, resetAuthLoading]);

    const signInWithGoogle = useCallback(async () => {
        if (activeOAuthRequestIdRef.current !== null) {
            console.log('[AUTH] OAuth attempt already active; ignoring');
            return;
        }

        setAuthLoading(true);
        const requestId = startOAuthAttempt();

        try {
            console.log('[AUTH] Calling startGoogleOAuth()');

            const { data, error } = await startGoogleOAuth();

            // ✅ NEW: handle session immediately if returned
            if (data?.session) {
                console.log('[AUTH] Session returned directly from OAuth');
                applySession(data.session);
                resetAuthLoading();
                return;
            }

            // existing error handling
            if (error) {
                if (activeOAuthRequestIdRef.current === requestId) {
                    resetAuthLoading();
                }
            }
        } catch (error) {
            console.error('Unexpected Google OAuth error:', error);
            if (activeOAuthRequestIdRef.current === requestId) {
                resetAuthLoading();
            }
        }
    }, [resetAuthLoading, startOAuthAttempt, applySession]);

    const value = useMemo(() => ({
        loading,
        authLoading,
        isProfileLoading,
        session,
        signInWithGoogle,
    }), [authLoading, loading, isProfileLoading, session, signInWithGoogle]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};
