import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AccountStatus, ContentPath, VoicePreference } from '../data/types';

interface AppState {
    activePath: ContentPath;
    voicePreference: VoicePreference;
    themeMode: 'light' | 'dark';
    accountStatus: AccountStatus;

    // Supabase Session
    session: Session | null;

    // User Info & Onboarding
    hasCompletedOnboarding: boolean;
    userName: string;

    // Streaks & Usage (Placeholders, will be fetched from Supabase)
    currentStreak: number;

    // Actions
    setSession: (session: Session | null) => void;
    setActivePath: (path: ContentPath) => void;
    setVoicePreference: (voice: VoicePreference) => void;
    setThemeMode: (mode: 'light' | 'dark') => void;
    setAccountStatus: (status: AccountStatus) => void;
    setHasCompletedOnboarding: (status: boolean) => void;
    setUserName: (name: string) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            activePath: 'gita',
            voicePreference: 'english-male',
            themeMode: 'light',
            accountStatus: 'free',

            hasCompletedOnboarding: false,
            userName: '',

            currentStreak: 0,
            session: null,

            setSession: (session) => set({ session }),
            setActivePath: (path) => set({ activePath: path }),
            setVoicePreference: (voice) => set({ voicePreference: voice }),
            setThemeMode: (mode) => set({ themeMode: mode }),
            setAccountStatus: (status) => set({ accountStatus: status }),
            setHasCompletedOnboarding: (status) => set({ hasCompletedOnboarding: status }),
            setUserName: (name) => set({ userName: name }),
        }),
        {
            name: 'daily-shlokya-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
