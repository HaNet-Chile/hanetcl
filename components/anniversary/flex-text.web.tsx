import { AppColors, AppFlexFonts } from '@/constants/design-tokens';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { flexRange, useFlexProgress, variationsAt } from './flex-axes';
import type { FlexTextProps } from './flex-axes';

/**
 * FlexText in the browser: the axes go straight into an animated style
 * (CSS font-variation-settings). Same props as flex-text.tsx.
 */
export function FlexText({ style, steps = AppFlexFonts.ramp, delay = 0, ...props }: FlexTextProps) {
  const { from, to } = flexRange(steps, style);
  const { progress } = useFlexProgress(delay);
  const axes = useAnimatedStyle(() => ({ fontVariationSettings: variationsAt(progress.get(), from, to) }) as never);
  return <Animated.Text {...props} style={[styles.text, style, { fontFamily: AppFlexFonts.variable }, axes]} />;
}

const styles = StyleSheet.create({
  text: { color: AppColors.textPrimary },
});
