import { BlurTargetView, BlurView } from 'expo-blur';
import React, { createContext, useContext, useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppColors, AppTheme } from '@/constants/design-tokens';

type BlurTarget = ComponentRef<typeof View>;

/**
 * How far the frosted bar reaches down the screen: the status bar plus any
 * header it carries. Scrolling content starts this far down, so at rest it
 * sits below the bar and while scrolling it passes under it.
 */
const FrostedInsetContext = createContext(0);

/** The frosted bar's height, for lists nested inside a `FrostedScreen`. */
export const useFrostedInset = () => useContext(FrostedInsetContext);

type FrostedScreenProps = {
  style?: StyleProp<ViewStyle>;
  /**
   * Stays on top while the content scrolls under it (the Calendar's week
   * strip), as frosted glass that also covers the status bar. Without one
   * nothing covers the status bar: the content runs edge to edge.
   */
  header?: React.ReactNode;
  /** Receives the bar's height, to pad the content that scrolls under it. */
  children: React.ReactNode | ((top: number) => React.ReactNode);
};

/**
 * A screen whose content runs under the status bar (and its header, if any)
 * instead of being cut at the safe area. A fixed header is frosted glass:
 * what scrolls under it shows through, blurred, so it never reads as a solid
 * band that chops the content.
 */
export function FrostedScreen({ style, header, children }: FrostedScreenProps) {
  const insets = useSafeAreaInsets();
  // Android blurs what a BlurTargetView draws; iOS and web blur what is behind.
  const target = useRef<BlurTarget>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const top = insets.top + (header ? headerHeight : 0);
  const background = StyleSheet.flatten(style)?.backgroundColor;

  const content = typeof children === 'function' ? children(top) : children;

  // Without a fixed header the content simply runs to the top edge, under
  // the status bar, with nothing over it (decided 2026-11-03): the glass is
  // only for bars that stay put while the content scrolls.
  if (!header) {
    return (
      <View style={[styles.screen, style]}>
        <FrostedInsetContext.Provider value={top}>{content}</FrostedInsetContext.Provider>
      </View>
    );
  }

  return (
    <View style={[styles.screen, style]}>
      <FrostedInsetContext.Provider value={top}>
        <BlurTargetView ref={target} style={[styles.fill, { backgroundColor: background }]}>
          {content}
        </BlurTargetView>
      </FrostedInsetContext.Provider>
      <View style={styles.bar} pointerEvents="box-none">
        <FrostedFill target={target} />
        <View style={{ height: insets.top }} />
        <View onLayout={event => setHeaderHeight(Math.round(event.nativeEvent.layout.height))}>
          {header}
        </View>
      </View>
    </View>
  );
}

/**
 * The frosted material alone, filling its parent. Pass `target` on Android:
 * without it the blur falls back to a plain translucent fill there.
 */
export function FrostedFill({ target }: { target?: React.RefObject<BlurTarget | null> }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={Platform.OS === 'android' ? 40 : 60}
        tint={AppTheme.blurTint}
        {...(Platform.OS === 'android' && target ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const, blurTarget: target } : {})}
        style={StyleSheet.absoluteFill}
      />
      {/* The canvas color over the blur keeps the bar in the app's tone
          instead of the system's grey; Android below 12 has no blur, so
          there it is denser to keep the text on the bar readable. */}
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  tint: {
    backgroundColor: Platform.select({
      android: `${AppColors.canvas}C7`,
      default: `${AppColors.canvas}8C`,
    }),
  },
});

/**
 * A scroll's content style pushed down by `top` (the frosted bar's height),
 * keeping the padding it already had on top of that.
 */
export function withTopInset(style: StyleProp<ViewStyle>, top: number): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const own = flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0;
  return { ...flat, paddingTop: top + (typeof own === 'number' ? own : 0) };
}

/**
 * Adds the home indicator's height to a scroll content's own bottom padding.
 * The screen itself is never padded at the bottom: a padded screen cuts the
 * scrolling content in a straight line above the home indicator, which reads
 * as a band chopping the page (the sign-in screens had it until v0.18.1).
 * The content runs to the bottom edge and only its end stays clear.
 */
export function withBottomInset(style: StyleProp<ViewStyle>, bottom: number): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const own = flat.paddingBottom ?? flat.paddingVertical ?? flat.padding ?? 0;
  return { ...flat, paddingBottom: bottom + (typeof own === 'number' ? own : 0) };
}
