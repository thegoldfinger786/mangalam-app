import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { OnboardingIntent } from '../data/types';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../theme';

/**
 * First-run onboarding — five light steps: welcome → language → intent
 * (optional) → name (optional) → ready. Replaces the old single-screen
 * `WelcomeScreen`.
 *
 * Completion signal: a `profiles` row (rows are app-created — no signup
 * trigger — so row presence, not `display_name`, means "onboarded"; see
 * AuthProvider). This is what lets the name step be genuinely optional.
 *
 * Personalisation: the intent answer is stored as `useAppStore.onboardingIntent`
 * (persisted locally). Nothing reads it yet — it is the seed for the Journey
 * personalisation hub (tracker JOURNEY-01), at which point it should move to a
 * server-side `profiles` / `user_preferences` column so it survives reinstall
 * and follows the account across devices.
 */
const STEP_COUNT = 5;

type Language = 'english' | 'hindi';

const VALUE_ROWS: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }[] = [
    { icon: 'headset-outline', title: 'Listen', body: 'Narrated wisdom from the Gita, Ramayan and Mahabharat.' },
    { icon: 'leaf-outline', title: 'Reflect', body: 'A few quiet minutes, whenever the day allows.' },
    { icon: 'compass-outline', title: 'Practice', body: 'Bring the ideas into how you live, work and relate.' },
];

const INTENT_OPTIONS: { value: OnboardingIntent; label: string; hint: string }[] = [
    { value: 'daily_reflection', label: 'Daily reflection', hint: 'A calm moment each day' },
    { value: 'wisdom_learning', label: 'Wisdom & learning', hint: 'Understand the ideas and their context' },
    { value: 'spiritual_practice', label: 'Spiritual practice', hint: 'A steady personal practice' },
    { value: 'stories', label: 'The stories', hint: 'Explore the epics and their characters' },
];

const LANGUAGE_OPTIONS: { value: Language; label: string; sub?: string }[] = [
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'हिन्दी', sub: 'Hindi' },
];

export const OnboardingScreen = () => {
    const { colors, spacing, typography, borderRadius } = useTheme();
    const styles = useMemo(() => createStyles(colors, spacing, borderRadius), [colors, spacing, borderRadius]);

    const { session, setUserName, setOnboardingIntent, setVoicePreference, setHasCompletedOnboarding } = useAppStore();

    const [step, setStep] = useState(1);
    const [language, setLanguage] = useState<Language | null>(null);
    const [intent, setIntent] = useState<OnboardingIntent | null>(null);
    const [name, setName] = useState(session?.user?.user_metadata?.full_name?.split(' ')?.[0] ?? '');
    const [saving, setSaving] = useState(false);

    // Gentle enter transition, replayed on every step change.
    const enter = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        enter.setValue(0);
        Animated.timing(enter, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    }, [step, enter]);

    const goNext = () => setStep((s) => Math.min(STEP_COUNT, s + 1));
    const goBack = () => setStep((s) => Math.max(1, s - 1));

    const finish = async () => {
        if (saving) return;
        setSaving(true);

        const trimmed = name.trim();
        const userId = useAppStore.getState().session?.user?.id;

        // Persist locally first, so getting into the app never hinges on the network.
        if (language) setVoicePreference(language === 'hindi' ? 'hindi-male' : 'english-male');
        setOnboardingIntent(intent);
        setUserName(trimmed);

        // A `profiles` row is what marks onboarding complete for future sessions
        // (see AuthProvider). Write it even when the name was skipped.
        if (userId) {
            try {
                const { error } = await supabase.from('profiles').upsert({
                    id: userId,
                    display_name: trimmed || null,
                    updated_at: new Date().toISOString(),
                });
                if (error) throw error;
            } catch (error) {
                logger.error('Failed to save onboarding profile', { error });
                // Non-fatal — the local flag still lets them in; the row gets
                // written on the next profile save (Settings name edit).
            }
        }

        setSaving(false);
        setHasCompletedOnboarding(true);
    };

    const animatedStyle = {
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
    };

    const brandMark = (
        <View style={styles.brandMark}>
            <View style={[styles.sun, { backgroundColor: colors.primaryLight }]} />
        </View>
    );

    const heading = (title: string, sub: string) => (
        <View style={styles.stepHeading}>
            <AppText variant="title" style={{ color: colors.text }}>{title}</AppText>
            <AppText variant="bodySmall" style={{ color: colors.textSecondary, marginTop: spacing.s }}>{sub}</AppText>
        </View>
    );

    return (
        <View style={[styles.flex, { backgroundColor: colors.background }]}>
            <ScreenContainer edges={['top', 'bottom']} style={styles.flex}>
                <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                        <View style={styles.frame}>
                            <View style={styles.topBar}>
                                <View style={styles.backSlot}>
                                    {step > 1 && step < STEP_COUNT && (
                                        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
                                            <Ionicons name="chevron-back" size={26} color={colors.text} />
                                        </Pressable>
                                    )}
                                </View>
                                <View style={styles.dots}>
                                    {Array.from({ length: STEP_COUNT }).map((_, i) => (
                                        <View key={i} style={[styles.dot, { backgroundColor: i < step ? colors.primary : colors.border }]} />
                                    ))}
                                </View>
                                <View style={styles.backSlot} />
                            </View>

                            <Animated.View style={[styles.body, animatedStyle]}>
                                {/* 1 — Welcome */}
                                {step === 1 && (
                                    <View style={styles.stepContent}>
                                        <View style={styles.heroBlock}>
                                            {brandMark}
                                            <AppText variant="display" style={[styles.centered, { color: colors.text }]} maxFontSizeMultiplier={1.2}>
                                                Mangalam
                                            </AppText>
                                            <AppText variant="body" style={[styles.centered, styles.lede, { color: colors.textSecondary }]}>
                                                Ancient wisdom for everyday life.
                                            </AppText>
                                        </View>
                                        <View style={styles.valueRows}>
                                            {VALUE_ROWS.map((r) => (
                                                <View key={r.title} style={styles.valueRow}>
                                                    <View style={[styles.valueIcon, { backgroundColor: colors.primary + '15' }]}>
                                                        <Ionicons name={r.icon} size={20} color={colors.primary} />
                                                    </View>
                                                    <View style={styles.flex}>
                                                        <AppText variant="subheading" style={{ color: colors.text }}>{r.title}</AppText>
                                                        <AppText variant="bodySmall" style={{ color: colors.textSecondary }}>{r.body}</AppText>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                        <Button title="Get started" onPress={goNext} style={styles.ctaSpaced} />
                                    </View>
                                )}

                                {/* 2 — Language */}
                                {step === 2 && (
                                    <View style={styles.stepContent}>
                                        {heading('Which language would you like?', 'This sets the language for narration and text. You can change it any time in Settings.')}
                                        <View style={styles.stepMiddle}>
                                        <View style={styles.languageRow}>
                                            {LANGUAGE_OPTIONS.map((o) => {
                                                const selected = language === o.value;
                                                return (
                                                    <Pressable
                                                        key={o.value}
                                                        onPress={() => setLanguage(o.value)}
                                                        accessibilityRole="button"
                                                        accessibilityState={{ selected }}
                                                        style={[styles.languageCard, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '10' : colors.surface }]}
                                                    >
                                                        <AppText variant="heading" style={{ color: selected ? colors.primary : colors.text }}>{o.label}</AppText>
                                                        {o.sub ? <AppText variant="caption" style={{ color: colors.textSecondary }}>{o.sub}</AppText> : null}
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                        </View>
                                        <Button title="Continue" onPress={goNext} disabled={!language} style={styles.ctaSpaced} />
                                    </View>
                                )}

                                {/* 3 — Intent (optional) */}
                                {step === 3 && (
                                    <View style={styles.stepContent}>
                                        {heading('What brings you to Mangalam?', 'Optional — it helps us shape what we show you over time.')}
                                        <View style={styles.stepMiddle}>
                                        <View style={styles.optionList}>
                                            {INTENT_OPTIONS.map((o) => {
                                                const selected = intent === o.value;
                                                return (
                                                    <Pressable
                                                        key={o.value}
                                                        onPress={() => setIntent(selected ? null : o.value)}
                                                        accessibilityRole="button"
                                                        accessibilityState={{ selected }}
                                                        style={[styles.optionRow, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '10' : colors.surface }]}
                                                    >
                                                        <View style={styles.flex}>
                                                            <AppText variant="body" style={{ color: colors.text, fontFamily: typography.fontFamilies.semiBold }}>{o.label}</AppText>
                                                            <AppText variant="caption" style={{ color: colors.textSecondary }}>{o.hint}</AppText>
                                                        </View>
                                                        <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.primary : colors.border} />
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                        </View>
                                        <View style={styles.stackedCtas}>
                                            <Button title="Continue" onPress={goNext} style={styles.cta} />
                                            <Pressable onPress={goNext} hitSlop={8} style={styles.skip}>
                                                <AppText variant="bodySmall" style={{ color: colors.textSecondary }}>Skip for now</AppText>
                                            </Pressable>
                                        </View>
                                    </View>
                                )}

                                {/* 4 — Name (optional) */}
                                {step === 4 && (
                                    <View style={styles.stepContent}>
                                        {heading('What should we call you?', 'Just so Mangalam feels like yours. Optional.')}
                                        <View style={styles.stepMiddle}>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontSize: typography.sizes.l }]}
                                            placeholder="Your name"
                                            placeholderTextColor={colors.textSecondary}
                                            value={name}
                                            onChangeText={setName}
                                            autoCapitalize="words"
                                            autoCorrect={false}
                                            returnKeyType="done"
                                            onSubmitEditing={goNext}
                                            maxFontSizeMultiplier={1.3}
                                        />
                                        </View>
                                        <View style={styles.stackedCtas}>
                                            <Button title="Continue" onPress={goNext} style={styles.cta} />
                                            <Pressable onPress={goNext} hitSlop={8} style={styles.skip}>
                                                <AppText variant="bodySmall" style={{ color: colors.textSecondary }}>Skip</AppText>
                                            </Pressable>
                                        </View>
                                    </View>
                                )}

                                {/* 5 — Ready */}
                                {step === 5 && (
                                    <View style={styles.stepContent}>
                                        <View style={styles.stepHero}>
                                            {brandMark}
                                            <AppText variant="title" style={[styles.centered, { color: colors.text }]}>
                                                {name.trim() ? `You're all set, ${name.trim()}.` : "You're all set."}
                                            </AppText>
                                            <AppText variant="body" style={[styles.centered, styles.lede, { color: colors.textSecondary }]}>
                                                {'Here’s something to begin with today.'}
                                            </AppText>
                                        </View>
                                        <Button
                                            title={saving ? 'One moment…' : 'Start Mangalam'}
                                            onPress={finish}
                                            disabled={saving}
                                            style={styles.ctaSpaced}
                                        />
                                    </View>
                                )}
                            </Animated.View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </ScreenContainer>
        </View>
    );
};

const createStyles = (
    colors: ReturnType<typeof useTheme>['colors'],
    spacing: ReturnType<typeof useTheme>['spacing'],
    borderRadius: ReturnType<typeof useTheme>['borderRadius'],
) =>
    StyleSheet.create({
        flex: { flex: 1 },
        frame: {
            flex: 1,
            paddingHorizontal: spacing.l,
        },
        topBar: {
            flexDirection: 'row',
            alignItems: 'center',
            height: 44,
        },
        backSlot: {
            width: 40,
            justifyContent: 'center',
        },
        dots: {
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.s,
        },
        dot: {
            width: 7,
            height: 7,
            borderRadius: borderRadius.round,
        },
        body: { flex: 1 },
        stepContent: {
            flex: 1,
            paddingTop: spacing.xl,
            paddingBottom: spacing.m,
        },
        stepHero: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        heroBlock: {
            alignItems: 'center',
            paddingTop: spacing.l,
            marginBottom: spacing.xl,
        },
        brandMark: { marginBottom: spacing.l },
        sun: {
            width: 72,
            height: 72,
            borderRadius: borderRadius.round,
            opacity: 0.85,
        },
        centered: { textAlign: 'center' },
        lede: {
            marginTop: spacing.s,
            paddingHorizontal: spacing.l,
        },
        valueRows: {
            gap: spacing.l,
        },
        valueRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.m,
        },
        valueIcon: {
            width: 44,
            height: 44,
            borderRadius: borderRadius.round,
            alignItems: 'center',
            justifyContent: 'center',
        },
        stepHeading: { marginBottom: spacing.l },
        // Interactive content sits in the upper-middle and lets whitespace flow
        // down toward the CTA — the same rhythm as step 1 — rather than floating
        // dead-centre (which looks sparse on tall devices).
        stepMiddle: {
            flex: 1,
            paddingTop: spacing.l,
        },
        languageRow: {
            flexDirection: 'row',
            gap: spacing.m,
        },
        languageCard: {
            flex: 1,
            minHeight: 132,
            borderWidth: 1.5,
            borderRadius: borderRadius.l,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.l,
        },
        optionList: {
            gap: spacing.m,
        },
        optionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.m,
            borderWidth: 1.5,
            borderRadius: borderRadius.l,
            padding: spacing.m,
        },
        input: {
            borderWidth: 1,
            borderRadius: borderRadius.m,
            paddingHorizontal: spacing.l,
            paddingVertical: spacing.m,
            minHeight: 52,
        },
        stackedCtas: {
            marginTop: 'auto',
            alignItems: 'center',
            gap: spacing.s,
        },
        cta: { width: '100%' },
        ctaSpaced: {
            width: '100%',
            marginTop: 'auto',
        },
        skip: { paddingVertical: spacing.s },
    });
