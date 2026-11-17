import { ThemedText } from '@/components/themed-text';
import { AppFlexFonts } from '@/constants/design-tokens';
import React, { forwardRef } from 'react';
import type { ComponentRef } from 'react';
import { Text } from 'react-native';
import type { TextProps } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { flexRange, useFlexProgress, variationsAt } from './flex-axes';
import type { FlexTextProps } from './flex-axes';

type AxisProps = TextProps & { fontVariationSettings?: string };

// Reanimated 4.7 filters fontVariationSettings out of animated styles, so it
// travels as a prop that this Text turns into its style. The first render
// already carries the starting axes.
const AxisText = forwardRef<ComponentRef<typeof Text>, AxisProps>(function AxisText({ fontVariationSettings, style, ...props }, ref) {
  return <Text ref={ref} {...props} style={[style, fontVariationSettings ? { fontVariationSettings } : undefined]} />;
});
const AnimatedAxisText = Animated.createAnimatedComponent(AxisText);

/**
 * Big text that grows into its weight and width when it appears: Google Sans
 * Flex's variable axes glide from the first cut of `steps` (narrow and light)
 * to the last (wide and black), as Spotify Wrapped's type does. Give it a new
 * `key` to play it again. The web version is flex-text.web.tsx.
 */
export function FlexText({ style, steps = AppFlexFonts.ramp, delay = 0, children, ...props }: FlexTextProps) {
  const { from, to } = flexRange(steps, style);
  const { progress, start } = useFlexProgress(delay);
  const animatedProps = useAnimatedProps<AxisProps>(() => ({ fontVariationSettings: variationsAt(progress.get(), from, to) }));

  // The font and the layout stay on the outer Text; the axes go on the inner
  // run, so Android measures the letters again as they widen.
  return (
    <ThemedText {...props} style={[style, { fontFamily: AppFlexFonts.variable }]}>
      <AnimatedAxisText fontVariationSettings={variationsAt(start, from, to)} animatedProps={animatedProps}>{children}</AnimatedAxisText>
    </ThemedText>
  );
}
