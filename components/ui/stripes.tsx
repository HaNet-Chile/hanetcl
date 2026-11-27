import { ThemedText } from '@/components/themed-text';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

// HaNet's pink stripes: the scratch card's cover (components/classhall/
// scratch-card.tsx) and everything that points to a grade still covered:
// the "N notas nuevas" banners, the small "N nuevas" pill, a new grade in
// the notifications and the ClassHall tile. The stripes mean "something is
// waiting under here", so nothing else in the app wears them.

const SIZE = 640;
const COUNT = 50;

/**
 * The stripes as a plain background that fills its parent (give the parent
 * `overflow: 'hidden'` and its radius). Views instead of Skia, so it costs
 * nothing and draws the same on the web. Hidden from screen readers.
 */
export function Stripes() {
  return (
    <View style={styles.clip} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={styles.field}>
        {Array.from({ length: COUNT }, (_, index) => <View key={index} style={styles.stripe} />)}
      </View>
    </View>
  );
}

type BannerProps = {
  title: string;
  /** A second line, such as the subjects the grades belong to. */
  subtitle?: string;
  /** The white pill on the right ("Destapar"). */
  actionLabel: string;
  onPress: () => void;
  /** Says the count and what the banner opens, since the stripes say nothing. */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A striped card that opens what waits under it: "Tienes 2 notas nuevas ·
 * Destapar". The whole card is the button; the pill only shows where to tap.
 */
export function StripedBanner({ title, subtitle, actionLabel, onPress, accessibilityLabel, style }: BannerProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.banner, !!subtitle && styles.bannerTall, style, pressed && AppPressed]}
    >
      <Stripes />
      <View style={styles.bannerText}>
        <ThemedText style={styles.bannerTitle}>{title}</ThemedText>
        {!!subtitle && <ThemedText numberOfLines={1} style={styles.bannerSub}>{subtitle}</ThemedText>}
      </View>
      <View style={styles.bannerButton}>
        <ThemedText style={styles.bannerButtonText}>{actionLabel}</ThemedText>
      </View>
    </Pressable>
  );
}

/** A small striped label inside a row: "2 nuevas". It isn't a button. */
export function StripedPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Stripes />
      <ThemedText style={styles.pillText}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: AppColors.accent,
  },
  field: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: SIZE,
    height: SIZE,
    marginTop: -SIZE / 2,
    marginLeft: -SIZE / 2,
    flexDirection: 'row',
    gap: 9,
    transform: [{ rotate: '45deg' }],
  },
  stripe: {
    width: 5,
    height: SIZE,
    backgroundColor: AppColors.stripe,
  },
  banner: {
    minHeight: 72,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: AppRadii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  bannerTall: {
    minHeight: 84,
    paddingVertical: 16,
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.4,
    color: AppColors.textPrimary,
  },
  bannerSub: {
    ...AppType.callout,
    fontFamily: 'DMSans_700Bold',
    color: AppColors.textPrimary,
  },
  bannerButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: AppRadii.pill,
    backgroundColor: AppColors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerButtonText: {
    ...AppType.headline,
    color: AppColors.controlOnActive,
  },
  pill: {
    height: 22,
    paddingHorizontal: 9,
    borderRadius: AppRadii.pill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pillText: {
    ...AppType.caption,
    fontFamily: 'DMSans_700Bold',
    color: AppColors.textPrimary,
  },
});
