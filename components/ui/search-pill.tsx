import { ThemedText } from '@/components/themed-text';
import { AppColors, AppPressed, AppRadii, AppTouch } from '@/constants/design-tokens';
import { EASE_OUT_CUBIC } from '@/constants/motion';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { GlassFill, GlassPressed, LIQUID_GLASS, glassClear } from '@/components/ui/liquid-glass';

/** How long each suggestion stays before the next one comes up. */
export const SEARCH_PILL_INTERVAL = 3200;
// The line travels about half its height: it reads as a wheel turning.
const TRAVEL = 12;
const OUT_MS = 160;
const IN_MS = 280;

type Props = {
  /** What the field says first, and what it is called for a screen reader ("Buscar en HaNet"). */
  label: string;
  /** Short version of the label that fits the pill ("Buscar"). */
  shortLabel?: string;
  /** Things that can be found, shown one at a time while nobody touches it. */
  suggestions?: string[];
  onPress: () => void;
  /** `glass` sits over a photo (the desktop Home's header). */
  tone?: 'surface' | 'glass';
  /** Stops the rotation (the showcase's "still" example). */
  still?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A search field that is really a button: a pill that opens the search. While
 * idle it goes through things that can be found, one every few seconds, each
 * rising in as the last one leaves upward. It stops while its screen is
 * behind another or the app is in the background, and with "Reducir
 * movimiento" the texts swap with a short fade and no travel.
 */
export function SearchPill({ label, shortLabel, suggestions, onPress, tone = 'surface', still = false, style }: Props) {
  const lines = React.useMemo(() => [shortLabel ?? label, ...(suggestions ?? [])], [label, shortLabel, suggestions]);
  const [index, setIndex] = useState(0);
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  // One line at a time: the one showing leaves upward, and only once it is
  // gone does the text change and the next one rise in. (Two lines crossing
  // would need the text and the animation to change on the same frame.)
  const opacity = useSharedValue(1);
  const shift = useSharedValue(0);
  const rotating = lines.length > 1 && focused && active && !still;
  useEffect(() => {
    if (!rotating) return;
    const next = () => setIndex(current => current + 1);
    const timer = setInterval(() => {
      shift.set(withTiming(reduceMotion ? 0 : -TRAVEL, { duration: OUT_MS, easing: Easing.in(Easing.quad) }));
      opacity.set(withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.quad) }, () => {
        'worklet';
        scheduleOnRN(next);
      }));
    }, SEARCH_PILL_INTERVAL);
    return () => clearInterval(timer);
  }, [opacity, reduceMotion, rotating, shift]);

  const first = React.useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    shift.set(reduceMotion ? 0 : TRAVEL);
    shift.set(withTiming(0, { duration: IN_MS, easing: EASE_OUT_CUBIC }));
    opacity.set(withTiming(1, { duration: IN_MS, easing: EASE_OUT_CUBIC }));
  }, [index, opacity, reduceMotion, shift]);

  const lineStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: shift.get() }] }));
  const position = index % lines.length;

  // On iOS 26 the pill on the canvas is Liquid Glass; over a photo (`tone="glass"`) it keeps its own tint.
  const glass = LIQUID_GLASS && tone === 'surface';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, tone === 'glass' && styles.glass, glass && glassClear, pressed && (glass ? GlassPressed : AppPressed), style]}
    >
      {glass && <GlassFill radius={AppTouch.minimum / 2} />}
      <Ionicons name="search" size={18} color={AppColors.textSecondary} style={styles.icon} />
      <View style={styles.lines} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.line, lineStyle]}>
          <ThemedText numberOfLines={1} style={[styles.text, position > 0 && styles.suggestion]}>{lines[position]}</ThemedText>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: AppTouch.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: AppRadii.pill,
    backgroundColor: AppColors.surface,
    overflow: 'hidden',
  },
  glass: {
    borderWidth: 1,
    borderColor: AppColors.hairline,
    backgroundColor: 'rgba(40, 40, 41, 0.6)',
  },
  icon: {
    opacity: 0.8,
  },
  lines: {
    flex: 1,
    height: 24,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 24,
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: AppColors.textSecondary,
    opacity: 0.6,
  },
  // What can be found reads a little stronger than the plain label.
  suggestion: {
    fontFamily: 'DMSans_500Medium',
    opacity: 0.86,
  },
});
