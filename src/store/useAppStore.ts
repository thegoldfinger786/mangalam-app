import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AccountStatus, VoicePreference } from '../data/types';

interface AppState {
    activeBookId: string | null;
    voicePreference: VoicePreference;
    themeMode: 'light' | 'dark';
    accountStatus: AccountStatus;

    // Supabase Session
    session: Session | null;
    user: User | null;

    // User Info & Onboarding
    hasCompletedOnboarding: boolean;
    userName: string;

    // Streaks & Usage (Placeholders, will be fetched from Supabase)
    currentStreak: number;

    // Progress Tracking (Local)
    completedVerses: string[];
    playbackRate: number;

    // Actions
    setAuthState: (session: Session | null) => void;
    setActiveBookId: (bookId: string | null) => void;
    setVoicePreference: (voice: VoicePreference) => void;
    setThemeMode: (mode: 'light' | 'dark') => void;
    setAccountStatus: (status: AccountStatus) => void;
    setHasCompletedOnboarding: (status: boolean) => void;
    setUserName: (name: string) => void;
    addCompletedVerse: (verseId: string) => void;
    setPlaybackRate: (rate: number) => void;
    
    // Layout Logic
    tabBarHeight: number;
    setTabBarHeight: (height: number) => void;

    // Navigation Logic
    currentRouteName: string | null;
    setCurrentRouteName: (name: string | null) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            activeBookId: null,
            voicePreference: 'english-male',
            themeMode: 'light',
            accountStatus: 'free',

            hasCompletedOnboarding: false,
            userName: '',

            currentStreak: 0,
            session: null,
            user: null,
            completedVerses: [],
            playbackRate: 1.0,
            tabBarHeight: 0,
            currentRouteName: null,

            setAuthState: (session) => set({ session, user: session?.user ?? null }),
            setActiveBookId: (bookId) => set({ activeBookId: bookId }),
            setVoicePreference: (voice) => set({ voicePreference: voice }),
            setThemeMode: (mode) => set({ themeMode: mode }),
            setAccountStatus: (status) => set({ accountStatus: status }),
            setHasCompletedOnboarding: (status) => set({ hasCompletedOnboarding: status }),
            setUserName: (name) => set({ userName: name }),
            addCompletedVerse: (verseId: string) =>
                set((state) => ({
                    completedVerses: state.completedVerses.includes(verseId)
                        ? state.completedVerses
                        : [...state.completedVerses, verseId],
                })),
            setPlaybackRate: (rate: number) => set({ playbackRate: rate }),
            setTabBarHeight: (height) => set({ tabBarHeight: height }),
            setCurrentRouteName: (name) => set({ currentRouteName: name }),
        }),
        {
            name: 'mangalam-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                activeBookId: state.activeBookId,
                voicePreference: state.voicePreference,
                themeMode: state.themeMode,
                accountStatus: state.accountStatus,
                hasCompletedOnboarding: state.hasCompletedOnboarding,
                userName: state.userName,
                currentStreak: state.currentStreak,
                completedVerses: state.completedVerses,
                playbackRate: state.playbackRate,
                // Layout & Navigation state explicitly EXCLUDED from persistence
            }),
        }
    )
);
