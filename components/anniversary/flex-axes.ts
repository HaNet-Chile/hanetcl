import { AppFlexAxes, AppFlexFonts } from '@/constants/design-tokens';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, TextProps, TextStyle } from 'react-native';
import { Easing, cancelAnimation, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

// What FlexText (native and web) shares: where its axes start and end, the
// string for fontVariationSettings and the clock that moves between them.

export type FlexTextProps = Omit<TextProps, 'style'> & {
  style?: StyleProp<TextStyle>;
  /** Cuts from AppFlexFonts: the text glides from the first one's axes to the last one's. */
  steps?: readonly string[];
  delay?: number;
};

export type FlexAxes = { wght: number; wdth: number; opsz: number };

/** Long enough to see the letters fill out, short enough not to wait for them. */
const DURATION = 560;
const FALLBACK = AppFlexAxes[AppFlexFonts.bold];

/** The axes at the start and at the end, for text of this size. */
export function flexRange(steps: readonly string[], style: StyleProp<TextStyle>): { from: FlexAxes; to: FlexAxes } {
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 17;
  // Optical size follows the size, as browsers do with font-optical-sizing: auto.
  const opsz = Math.max(1, Math.min(144, fontSize));
  const first = AppFlexAxes[steps[0]] ?? FALLBACK;
  const last = AppFlexAxes[steps[steps.length - 1]] ?? FALLBACK;
  return { from: { ...first, opsz }, to: { ...last, opsz } };
}

export function variationsAt(progress: number, from: FlexAxes, to: FlexAxes) {
  'worklet';
  const wght = from.wght + (to.wght - from.wght) * progress;
  const wdth = from.wdth + (to.wdth - from.wdth) * progress;
  return `"opsz" ${to.opsz.toFixed(1)}, "wdth" ${wdth.toFixed(1)}, "wght" ${wght.toFixed(0)}`; // i18n-ignore (CSS axes, not text)
}

/** 0 → 1 once, after `delay`; already at 1 with Reduce Motion (`start` says where it begins). */
export function useFlexProgress(delay: number) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.set(1);
      return;
    }
    progress.set(withDelay(delay, withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) })));
    return () => cancelAnimation(progress);
  }, [delay, progress, reduceMotion]);
  return { progress, start: reduceMotion ? 1 : 0 };
}
