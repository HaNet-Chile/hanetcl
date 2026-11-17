import { AppColors, AppFlexFonts } from '@/constants/design-tokens';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { flexFitStyles, flexRange, scaledText, useFlexFit, useFlexProgress, variationsAt } from './flex-axes';
import type { FlexTextProps } from './flex-axes';

/**
 * FlexText in the browser: the axes go straight into an animated style
 * (CSS font-variation-settings). Same props as flex-text.tsx.
 */
export function FlexText({ style, steps = AppFlexFonts.ramp, delay = 0, fit = false, children, ...props }: FlexTextProps) {
  const { from, to } = flexRange(steps, style);
  const { progress } = useFlexProgress(delay);
  const { scale, onRoom, onNatural } = useFlexFit();
  const axes = useAnimatedStyle(() => ({ fontVariationSettings: variationsAt(progress.get(), from, to) }) as never);
  const text = (
    <Animated.Text {...props} numberOfLines={fit ? 1 : props.numberOfLines} style={[styles.text, scaledText(style, fit ? scale : 1), { fontFamily: AppFlexFonts.variable }, axes]}>
      {children}
    </Animated.Text>
  );
  if (!fit) return text;
  return (
    <View style={flexFitStyles.room} onLayout={onRoom}>
      {text}
      <View style={flexFitStyles.probeBox} pointerEvents="none" aria-hidden>
        <Text numberOfLines={1} onLayout={onNatural} style={[styles.text, style, { fontFamily: AppFlexFonts.variable, fontVariationSettings: variationsAt(1, from, to) } as never]}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: AppColors.textPrimary },
});
