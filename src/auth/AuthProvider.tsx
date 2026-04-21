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
    signOut as supabaseSignOut,
} from '../lib/supabaseClient';
import { signInWithAppleService as startAppleOAuth } from '../services/auth/appleSignIn';
import { useAppStore } from '../store/useAppStore';
import { logger } from '../lib/logger';
import * as Sentry from '@sentry/react-native';
import { stopAudio, resetAudioState } from '../store/useAudioStore';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/** Shape of the `profiles` row returned by fetchUserProfile */
interface UserProfile {
    display_name: string | null;
}

type AuthContextValue = {
    /** True during initial session bootstrap only. Resolves exactly once. */
    loading: boolean;
    /** True while an OAuth sign-in is in-flight. */
    authLoading: boolean;
    /** True while profile data is being fetched after session change. */
    isProfileLoading: boolean;
    session: Session | null;
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_LOADING_TIMEOUT_MS = 15000;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        logger.error('[AUTH] Profile fetch error', { error, tags: { module: 'auth' } });
        return null;
    }

    // Supabase returns `null` when no row found
    if (!data) return null;

    // Safe cast: we selected only `display_name`
    return data as unknown as UserProfile;
}

/**
 * Clears all auth-related Zustand state.
 * Called during signOut and failed session restore.
 */
function clearLocalAuthState() {
    const store = useAppStore.getState();
    store.setAuthState(null);
    store.setHasCompletedOnboarding(false);
    store.setUserName('');
}

// ────────────────────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: PropsWithChildren) => {
    const setAuthState = useAppStore((state) => state.setAuthState);
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(false);
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [session, setSession] = useState<Session | null>(null);

    // Refs for OAuth timeout management
    const authLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeOAuthRequestIdRef = useRef<number | null>(null);
    const oauthRequestCounterRef = useRef(0);

    // ── Bootstrap guard ──
    // Prevents the INITIAL_SESSION event from onAuthStateChange from causing
    // a second applySession() call after getSession() already handled it.
    const isBootstrappedRef = useRef(false);

    // ── OAuth timeout helpers ──

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
            logger.warn('[AUTH] OAuth loading timeout reached; resetting pending state');
            activeOAuthRequestIdRef.current = null;
            setAuthLoading(false);
            authLoadingTimeoutRef.current = null;
        }, AUTH_LOADING_TIMEOUT_MS);

        return requestId;
    }, [clearAuthLoadingTimeout]);

    // ── Session application ──

    const applySession = useCallback(async (nextSession: Session | null) => {
        setIsProfileLoading(true);
        try {
            if (nextSession?.user?.id) {
                const profile = await fetchUserProfile(nextSession.user.id);
                const { setHasCompletedOnboarding, setUserName } = useAppStore.getState();

                if (!profile?.display_name) {
                    logger.log('[AUTH] First-time user → navigate to Welcome');
                    setHasCompletedOnboarding(false);
                } else {
                    logger.log('[AUTH] Existing user → navigate to Home');
                    setHasCompletedOnboarding(true);
                    setUserName(profile.display_name);
                }
            }

            setSession(nextSession);
            setAuthState(nextSession);

            if (nextSession?.user?.id) {
                Sentry.setUser({ id: nextSession.user.id });
            } else {
                Sentry.setUser(null);
            }
        } finally {
            setIsProfileLoading(false);
        }
    }, [setAuthState]);

    // ── Bootstrap effect ──
    // Single source of truth: getSession() provides the initial session.
    // onAuthStateChange handles all *subsequent* changes (sign-in, sign-out,
    // token refresh). The INITIAL_SESSION event is explicitly skipped to
    // prevent a double-apply race.

    useEffect(() => {
        let isMounted = true;
        const supabase = getSupabase();

        // 1. Register listener FIRST so we don't miss events that fire
        //    between getSession() resolving and listener registration.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, eventSession) => {
                if (!isMounted) return;

                // Skip the INITIAL_SESSION event — getSession() handles it.
                if (event === 'INITIAL_SESSION') {
                    logger.log('[AUTH] onAuthStateChange: INITIAL_SESSION skipped (handled by getSession)');
                    return;
                }

                logger.log('[AUTH] onAuthStateChange:', event);
                applySession(eventSession);

                // Reset OAuth loading state if an OAuth flow was pending
                if (activeOAuthRequestIdRef.current !== null) {
                    resetAuthLoading();
                } else {
                    clearAuthLoadingTimeout();
                    setAuthLoading(false);
                }
            },
        );

        // 2. Bootstrap from persisted session
        const bootstrapSession = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();

                if (!isMounted) return;

                if (error) {
                    logger.error('[AUTH] Initial session error', { error, tags: { module: 'auth' } });
                    await applySession(null);
                } else {
                    logger.log('[AUTH] Initial session restored:', data.session?.user?.email ?? 'none');
                    await applySession(data.session);
                }
            } catch (error) {
                if (!isMounted) return;
                logger.error('[AUTH] Session bootstrap failed', { error, tags: { module: 'auth' } });
                await applySession(null);
            } finally {
                if (isMounted) {
                    isBootstrappedRef.current = true;
                    setLoading(false);
                }
            }
        };

        void bootstrapSession();

        return () => {
            isMounted = false;
            resetAuthLoading();
            subscription.unsubscribe();
        };
    }, [applySession, clearAuthLoadingTimeout, resetAuthLoading]);

    // ── Sign-in handlers ──

    const signInWithGoogle = useCallback(async () => {
        if (activeOAuthRequestIdRef.current !== null) {
            logger.log('[AUTH] OAuth attempt already active; ignoring');
            return;
        }

        setAuthLoading(true);
        const requestId = startOAuthAttempt();

        try {
            logger.log('[AUTH] Starting Google OAuth');
            const { data, error } = await startGoogleOAuth();

            // Handle session returned directly (native flow)
            if (data?.session) {
                logger.log('[AUTH] Session returned directly from Google OAuth');
                applySession(data.session);
                resetAuthLoading();
                return;
            }

            if (error) {
                if (activeOAuthRequestIdRef.current === requestId) {
                    resetAuthLoading();
                }
                throw error;
            }
        } catch (error) {
            logger.error('[AUTH] Google OAuth error', { error, tags: { module: 'auth' } });
            if (activeOAuthRequestIdRef.current === requestId) {
                resetAuthLoading();
            }
            throw error;
        }
    }, [resetAuthLoading, startOAuthAttempt, applySession]);

    const signInWithApple = useCallback(async () => {
        if (activeOAuthRequestIdRef.current !== null) {
            logger.log('[AUTH] OAuth attempt already active; ignoring');
            return;
        }

        setAuthLoading(true);
        const requestId = startOAuthAttempt();

        try {
            logger.log('[AUTH] Starting Apple OAuth');
            const { data, error } = await startAppleOAuth();

            if (data?.session) {
                logger.log('[AUTH] Session returned directly from Apple OAuth');
                applySession(data.session);
                resetAuthLoading();
                return;
            }

            if (error) {
                if (activeOAuthRequestIdRef.current === requestId) {
                    resetAuthLoading();
                }
                throw error;
            }
        } catch (error) {
            logger.error('[AUTH] Apple OAuth error', { error, tags: { module: 'auth' } });
            if (activeOAuthRequestIdRef.current === requestId) {
                resetAuthLoading();
            }
            throw error;
        }
    }, [resetAuthLoading, startOAuthAttempt, applySession]);

    // ── Sign-out ──
    // Always clears local state regardless of Supabase response.
    // This prevents "stuck session" scenarios on network failure.

    const handleSignOut = useCallback(async () => {
        logger.log('[AUTH] signOut initiated');

        // 1. Synchronously stop audio & force final remote sync while session still exists
        try {
            await stopAudio();
        } catch (e) {
            logger.warn('[AUTH] Error stopping audio during logout', { error: e });
        } finally {
            resetAudioState();
        }

        // 2. Always clear local state to prevent stuck sessions
        setSession(null);
        clearLocalAuthState();

        // 3. Attempt to clear server-side session
        try {
            const { error } = await supabaseSignOut();
            if (error) {
                logger.error('[AUTH] Supabase signOut returned error', { error });
            } else {
                logger.log('[AUTH] signOut complete — server and local state cleared');
            }
        } catch (error) {
            // Network failure etc. — local state is already cleared, user is logged out.
            logger.error('[AUTH] Supabase signOut threw', { error });
        }
    }, []);

    // ── Context value ──

    const value = useMemo(() => ({
        loading,
        authLoading,
        isProfileLoading,
        session,
        signInWithGoogle,
        signInWithApple,
        signOut: handleSignOut,
    }), [authLoading, loading, isProfileLoading, session, signInWithGoogle, signInWithApple, handleSignOut]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
};
