import { AppFlexAxes, AppFlexFonts } from '@/constants/design-tokens';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { LayoutChangeEvent, StyleProp, TextProps, TextStyle } from 'react-native';
import { Easing, cancelAnimation, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

// What FlexText (native and web) shares: where its axes start and end, the
// string for fontVariationSettings and the clock that moves between them.

export type FlexTextProps = Omit<TextProps, 'style'> & {
  style?: StyleProp<TextStyle>;
  /** Cuts from AppFlexFonts: the text glides from the first one's axes to the last one's. */
  steps?: readonly string[];
  delay?: number;
  /**
   * Stays on one line: the size shrinks just enough for the widest moment
   * (the last cut) to fit the width it has. For big numbers that widen; the
   * parent has to give it a width (it doesn't hug its content).
   */
  fit?: boolean;
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

/**
 * For `fit`: the width there is (the wrapper) and the width the text takes
 * at its last cut and full size (a hidden probe), and the scale between them.
 */
export function useFlexFit() {
  const [room, setRoom] = useState(0);
  const [natural, setNatural] = useState(0);
  const onRoom = useCallback((event: LayoutChangeEvent) => setRoom(event.nativeEvent.layout.width), []);
  const onNatural = useCallback((event: LayoutChangeEvent) => setNatural(event.nativeEvent.layout.width), []);
  // A little margin, since the last letter's side bearing and rounding vary
  // by platform. The floor keeps a parent that hugs its content (it should
  // give the text a width instead) from shrinking it to nothing.
  const scale = room > 0 && natural > 0 ? Math.max(0.4, Math.min(1, (room * 0.97) / natural)) : 1;
  return { scale, onRoom, onNatural };
}

/** The text's size, line height and tracking, times `scale`. */
export function scaledText(style: StyleProp<TextStyle>, scale: number): StyleProp<TextStyle> {
  if (scale >= 1) return style;
  const flat = StyleSheet.flatten(style) ?? {};
  return [
    style,
    {
      ...(flat.fontSize ? { fontSize: flat.fontSize * scale } : {}),
      ...(flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : {}),
      ...(flat.letterSpacing ? { letterSpacing: flat.letterSpacing * scale } : {}),
    },
  ];
}

export const flexFitStyles = StyleSheet.create({
  room: { alignSelf: 'stretch' },
  // Wide enough that the probe never wraps, and out of sight and of reach.
  probeBox: { position: 'absolute', left: 0, top: 0, width: 4000, opacity: 0, alignItems: 'flex-start' },
});
