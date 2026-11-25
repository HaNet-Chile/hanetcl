import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import React from 'react';
import { Platform, StyleSheet, type ColorValue } from 'react-native';
import Animated, { withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { EASE_OUT_CUBIC, SPRING_SMOOTH } from '@/constants/motion';

/**
 * Liquid Glass (iOS 26 and later). Everywhere else (Android, the web, older
 * iPhones) each piece keeps its solid surface, so nothing here changes them.
 *
 * Glass is for the controls that float over the content (arrows, a search
 * pill, a close button, a selection), never for the content itself, and it
 * never sits on more glass.
 */
export const LIQUID_GLASS = Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/** A glass view that Reanimated can move (the selection drop of a strip or a segmented control). */
export const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

/**
 * Press feedback for a glass control: it only presses in. Glass that changes
 * opacity can come back blank, so there is no dip.
 */
export const GlassPressed = { transform: [{ scale: 0.95 }] } as const;

/** A control drawn by `GlassFill` leaves its own fill off. */
export const glassClear = { backgroundColor: 'transparent' } as const;

type FillProps = {
  /** The control's corner radius. A pill passes half its height (UIKit does not clamp it). */
  radius: number;
  tintColor?: ColorValue;
};

/**
 * The glass of a control, under its icon or text. The control keeps its own
 * shape and adds `glassClear` on iOS 26; elsewhere this draws nothing and the
 * control keeps its fill.
 */
export function GlassFill({ radius, tintColor }: FillProps) {
  if (!LIQUID_GLASS) return null;
  return (
    <GlassView
      pointerEvents="none"
      glassEffectStyle="regular"
      colorScheme="dark"
      tintColor={tintColor}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}

/**
 * The selection drop swells a little as it leaves and settles when it lands,
 * the way iOS lifts a glass selection while it moves.
 */
export function liftGlass(lift: SharedValue<number>, to = 1.12) {
  lift.set(withSequence(withTiming(to, { duration: 120, easing: EASE_OUT_CUBIC }), withSpring(1, SPRING_SMOOTH)));
}
