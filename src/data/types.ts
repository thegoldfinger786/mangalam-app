// Global Types for App State
export type ContentPath = 'gita' | 'ramayan' | 'mahabharat' | 'shiv_puran' | 'upanishads';
export type VoicePreference = 'english-male' | 'english-female' | 'hindi-male' | 'hindi-female';
export type AccountStatus = 'free' | 'supporter';

/**
 * What the listener said drew them to Mangalam, captured (optionally) during
 * onboarding. Not consumed yet — it is the seed for the future Journey
 * personalisation hub, at which point it graduates from local storage to a
 * server-side `profiles` / `user_preferences` column.
 */
export type OnboardingIntent =
    | 'daily_reflection'
    | 'wisdom_learning'
    | 'spiritual_practice'
    | 'stories';
