import { BlotView, GLOW_MAX_SCALE, glowPalette } from '@/components/events/event-glow';
import type { Blot } from '@/components/events/event-glow';
import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

// The cover's light behind a ticket (Llegada, Entrada válida, Recibir): the
// same drifting blots as an event's page (EventGlow), gathered around the
// ticket instead of the top of a page, so it breathes instead of sitting
// there like a picture. Each blot fades to nothing inside its own box, so no
// edge ever shows; on a wide window it keeps its phone size around the
// (centered) ticket instead of filling the window.

const FRAME_WIDTH = 412;

/** Blots on the 412-wide frame, around (cx, cy). */
function blotsAround(colors: string[], cx: number, cy: number): Blot[] {
  const { top, center, light, side, deep } = glowPalette(colors);
  return [
    { color: top, cx, cy: cy - 190, rx: 300, ry: 240, opacity: 0.55, dx: 14, dy: 12, ms: 12000 },
    { color: top, cx: cx + 24, cy: cy - 50, rx: 200, ry: 200, opacity: 0.75, dx: 26, dy: 18, ms: 9000 },
    { color: center, cx: cx - 30, cy: cy + 30, rx: 170, ry: 160, opacity: 0.6, dx: -30, dy: 22, ms: 7600 },
    { color: light, cx: cx + 190, cy: cy + 10, rx: 90, ry: 150, opacity: 0.32, dx: -18, dy: -26, ms: 8400 },
    { color: side, cx: cx - 180, cy: cy + 70, rx: 120, ry: 150, opacity: 0.35, dx: 22, dy: -20, ms: 10200 },
    { color: deep, cx: cx - 160, cy: cy - 150, rx: 130, ry: 140, opacity: 0.6, dx: 16, dy: 12, ms: 11000 },
  ];
}

/**
 * Fills its parent, behind everything. `x` is a fraction of the (phone-sized,
 * centered) frame and `y` a distance from the top, in points; `style` can fade it in.
 */
export function TicketGlow({ colors, x = 0.5, y, style, id = 'ticket' }: { colors: string[]; x?: number; y: number; style?: AnimatedStyle<ViewStyle>; id?: string }) {
  const { width } = useWindowDimensions();
  const scale = Math.min(width / FRAME_WIDTH, GLOW_MAX_SCALE);
  const left = (width - FRAME_WIDTH * scale) / 2;
  const key = colors.join();
  const blots = useMemo(() => blotsAround(key ? key.split(',') : [], FRAME_WIDTH * x, y / scale), [key, x, y, scale]);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, style]}>
      {blots.map((blot, index) => (
        <BlotView key={index} blot={blot} id={`${id}-glow-${index}`} scale={scale} flip={false} offset={0} left={left} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { overflow: 'hidden' },
});
