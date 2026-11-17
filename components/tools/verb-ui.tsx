import { ThemedText } from '@/components/themed-text';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import type { Verb } from '@/constants/verbs';
import type { VerbForm } from '@/services/verbs-quiz';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { StyleProp, TextInputInstance, TextInputProps, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { t } from '@/i18n';

// Pieces of Verbos en inglés (Herramientas). The game screens are in
// app/tools/verbs/ and components/tools/verb-games.tsx.

export function formLabel(form: VerbForm) {
  switch (form) {
    case 'infinitive': return t('components.tools.verbUi.infinitivo');
    case 'pastSimple': return t('components.tools.verbUi.pasadoSimple');
    case 'pastParticiple': return t('components.tools.verbUi.participioPasado');
  }
}

/** The short name, for the three boxes of Infinito. */
export function formShortLabel(form: VerbForm) {
  switch (form) {
    case 'infinitive': return t('components.tools.verbUi.infinitivo');
    case 'pastSimple': return t('components.tools.verbUi.pasado');
    case 'pastParticiple': return t('components.tools.verbUi.participio');
  }
}

export function typeLabel(verb: Verb) {
  return verb.type === 'irregular' ? t('components.tools.verbUi.irregular') : t('components.tools.verbUi.regular');
}

/** A small pill with what is being asked, or the kind of verb. */
export function VerbTag({ label, strong = false }: { label: string; strong?: boolean }) {
  return (
    <View style={[styles.tag, strong && styles.tagStrong]}>
      <ThemedText style={[styles.tagText, strong && styles.tagTextStrong]}>{label}</ThemedText>
    </View>
  );
}

export type AnswerState = 'idle' | 'right' | 'wrong';

type AnswerFieldProps = Omit<TextInputProps, 'style'> & {
  ref?: React.Ref<TextInputInstance>;
  label?: string;
  state?: AnswerState;
  style?: StyleProp<ViewStyle>;
};

/**
 * Where an answer is written: no autocorrect or capitals (the phone would
 * "fix" the English), and after checking, a mark for right or wrong.
 */
export function VerbAnswerField({ ref, label, state = 'idle', style, onFocus, onBlur, ...props }: AnswerFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {!!label && <ThemedText style={styles.fieldLabel}>{label}</ThemedText>}
      <View>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
          placeholderTextColor={AppColors.surfaceMuted}
          selectionColor={AppColors.accent}
          {...props}
          onFocus={event => { setFocused(true); onFocus?.(event); }}
          onBlur={event => { setFocused(false); onBlur?.(event); }}
          style={[styles.input, focused && styles.inputFocused, state === 'right' && styles.inputRight, state === 'wrong' && styles.inputWrong]}
        />
        {state !== 'idle' && (
          <View pointerEvents="none" style={styles.mark}>
            <Ionicons
              name={state === 'right' ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={state === 'right' ? AppColors.accentMint : AppColors.errorText}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Infinito's clock: a bar that empties as the seconds drain and turns pink
 * near the end. It follows the clock's ticks linearly, so it slides instead
 * of stepping.
 */
export function VerbTimeBar({ seconds, max, low, tick = 100 }: { seconds: number; max: number; low: boolean; tick?: number }) {
  const fill = useSharedValue(Math.min(1, seconds / max));
  useEffect(() => {
    fill.set(withTiming(Math.max(0, Math.min(1, seconds / max)), { duration: tick, easing: Easing.linear }));
  }, [fill, max, seconds, tick]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: Math.ceil(seconds) }}>
      <Animated.View style={[styles.trackFill, low && styles.trackFillLow, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: AppRadii.pill, backgroundColor: AppColors.surfaceMuted, justifyContent: 'center' },
  tagStrong: { backgroundColor: AppColors.accentTint },
  tagText: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.textSecondary },
  tagTextStrong: { color: AppColors.textPrimary },
  field: { gap: 6 },
  fieldLabel: { ...AppType.caption, color: AppColors.textSecondary },
  input: {
    ...AppType.body,
    fontFamily: 'DMSans_500Medium',
    minHeight: 50,
    paddingHorizontal: AppSpacing.lg,
    paddingRight: 44,
    borderRadius: AppRadii.md,
    borderCurve: 'continuous',
    backgroundColor: AppColors.canvas,
    color: AppColors.textPrimary,
    borderWidth: 1.5,
    borderColor: AppColors.hairline,
    outlineStyle: 'none' as never,
  },
  inputFocused: { borderColor: AppColors.surfaceSoft },
  inputRight: { borderColor: AppColors.accentMint },
  inputWrong: { borderColor: AppColors.errorText },
  mark: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  track: { height: 8, borderRadius: AppRadii.pill, backgroundColor: AppColors.surface, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: AppRadii.pill, backgroundColor: AppColors.surfaceSoft },
  trackFillLow: { backgroundColor: AppColors.accent },
});
