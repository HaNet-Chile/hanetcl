import { ThemedText } from '@/components/themed-text';
import { AppColors, AppPressed, AppRadii, AppSpacing } from '@/constants/design-tokens';
import { Image } from 'expo-image';
import type { ImageSource } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export const ERROR_ICONS = {
  lock: require('@/assets/errors/lock.svg'),
  server: require('@/assets/errors/server.svg'),
  offline: require('@/assets/errors/wifi-off.svg'),
  arrow: require('@/assets/errors/arrow-right.svg'),
  sunset: require('@/assets/errors/sea-and-sun.svg'),
};

type Action = { label: string; onPress: () => void; disabled?: boolean };

type Props = {
  /** An icon, or a short text such as ":(" in its place. */
  icon: ImageSource | string;
  title: string;
  /** The explanation under the divider; may hold bold parts. */
  body: React.ReactNode;
  /** A second, smaller card under the main one. */
  note?: React.ReactNode;
  primary: Action;
  secondary?: Action;
  /** "sunset": the main card warms up to orange at its top left, for a goodbye or a move rather than a failure. */
  tone?: 'accent' | 'sunset';
};

// Text grows with the system size only this much, so the screen always fits.
const TITLE_MAX_SCALE = 1.1;
const BODY_MAX_SCALE = 1.2;

/**
 * HaNet's error screen (Figma "ERRORES DE APP"): a pink card with an icon,
 * a large headline and the explanation, an optional note card and two pill
 * buttons. Everything fits the screen without scrolling: the type steps down
 * on shorter phones and the main card takes whatever height is left.
 */
export function ErrorScreen({ icon, title, body, note, primary, secondary, tone = 'accent' }: Props) {
  const { height } = useWindowDimensions();
  const titleSize = height >= 840 ? 48 : height >= 760 ? 42 : height >= 680 ? 36 : 30;
  const bodySize = height >= 760 ? 16 : 15;
  const roomy = height >= 760;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.card, styles.main, !roomy && styles.cardTight]}>
        {tone === 'sunset' && <SunsetFill />}
        {typeof icon === 'string'
          ? <ThemedText maxFontSizeMultiplier={TITLE_MAX_SCALE} style={[styles.textIcon, { fontSize: titleSize * 0.75, lineHeight: titleSize * 0.9 }]}>{icon}</ThemedText>
          : <Image source={icon} style={styles.icon} contentFit="contain" accessibilityIgnoresInvertColors />}
        <View style={[styles.text, !roomy && styles.textTight]}>
          <ThemedText
            accessibilityRole="header"
            maxFontSizeMultiplier={TITLE_MAX_SCALE}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.2, letterSpacing: -titleSize * 0.05 }]}
          >
            {title}
          </ThemedText>
          <View style={styles.divider} />
          <ThemedText maxFontSizeMultiplier={BODY_MAX_SCALE} style={[styles.body, { fontSize: bodySize, lineHeight: bodySize * 1.5 }]}>
            {body}
          </ThemedText>
        </View>
      </View>

      {!!note && (
        <View style={[styles.card, styles.noteCard, !roomy && styles.cardTight]}>
          <ThemedText maxFontSizeMultiplier={BODY_MAX_SCALE} style={[styles.body, { fontSize: bodySize, lineHeight: bodySize * 1.5 }]}>
            {note}
          </ThemedText>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: primary.disabled }}
          disabled={primary.disabled}
          onPress={primary.onPress}
          style={({ pressed }) => [styles.button, styles.primary, !secondary && styles.wide, primary.disabled && styles.disabled, pressed && AppPressed]}
        >
          <ThemedText maxFontSizeMultiplier={BODY_MAX_SCALE} numberOfLines={1} style={styles.primaryText}>{primary.label}</ThemedText>
        </Pressable>
        {!!secondary && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: secondary.disabled }}
            disabled={secondary.disabled}
            onPress={secondary.onPress}
            style={({ pressed }) => [styles.button, styles.secondary, secondary.disabled && styles.disabled, pressed && AppPressed]}
          >
            <ThemedText maxFontSizeMultiplier={BODY_MAX_SCALE} numberOfLines={1} style={styles.secondaryText}>{secondary.label}</ThemedText>
            <Image source={ERROR_ICONS.arrow} style={styles.arrow} contentFit="contain" />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/** A color partway (0–1) from one #RRGGBB to another. */
function mixHex(from: string, to: string, amount: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * amount).toString(16).padStart(2, '0')).join('');
}

// Figma's linear-gradient(-39deg, accent 49.7 %, sunset 129.2 %): on a card
// this shape it runs corner to corner, and the top left corner (100 %) is
// only partway to the yellow. SVG stops stop at 1, so that color is worked out.
const SUNSET_START = 0.497;
const SUNSET_CORNER = mixHex(AppColors.accent, AppColors.sunset, (1 - SUNSET_START) / (1.292 - SUNSET_START));

/** The sunset card's fill, under its content. */
function SunsetFill() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="error-sunset" x1="1" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={AppColors.accent} />
          <Stop offset={SUNSET_START} stopColor={AppColors.accent} />
          <Stop offset="1" stopColor={SUNSET_CORNER} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#error-sunset)" />
    </Svg>
  );
}

/** Bold part inside an error text; a plain nested Text so it keeps the size around it. */
export function Strong({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Text accessibilityRole={onPress ? 'link' : undefined} onPress={onPress} style={[styles.strong, !!onPress && styles.link]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: AppSpacing.md,
    paddingHorizontal: AppSpacing.md,
    paddingTop: AppSpacing.md,
    paddingBottom: AppSpacing.md,
    backgroundColor: AppColors.canvas,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: AppSpacing.xxl,
    borderRadius: AppRadii.xl,
    borderCurve: 'continuous',
    backgroundColor: AppColors.accent,
  },
  cardTight: {
    padding: AppSpacing.xl,
  },
  // Takes the height left over, so the screen never needs to scroll.
  main: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  icon: {
    width: 35,
    height: 35,
  },
  textIcon: {
    fontFamily: 'DMSans_500Medium',
    color: AppColors.textOnLight,
  },
  text: {
    flexShrink: 1,
    gap: AppSpacing.xxl,
  },
  textTight: {
    gap: AppSpacing.lg,
  },
  title: {
    flexShrink: 1,
    fontFamily: 'DMSans_500Medium',
    color: AppColors.textOnLight,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.textOnLight,
    opacity: 0.6,
  },
  // Medium weight: dark text on the accent needs the extra stroke to read well.
  body: {
    fontFamily: 'DMSans_500Medium',
    letterSpacing: -0.3,
    color: AppColors.textOnLight,
  },
  strong: {
    fontFamily: 'DMSans_700Bold',
    color: AppColors.textOnLight,
  },
  link: {
    textDecorationLine: 'underline',
  },
  noteCard: {
    justifyContent: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: AppSpacing.md,
    paddingHorizontal: AppSpacing.xs,
  },
  button: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppSpacing.md,
    paddingHorizontal: AppSpacing.xl,
    borderRadius: AppRadii.pill,
  },
  primary: {
    flex: 128,
    backgroundColor: AppColors.primary,
  },
  wide: {
    flex: 1,
  },
  secondary: {
    flex: 221,
    backgroundColor: AppColors.controlActive,
  },
  disabled: {
    opacity: 0.6,
  },
  primaryText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: AppColors.textPrimary,
  },
  secondaryText: {
    flexShrink: 1,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: AppColors.controlOnActive,
  },
  arrow: {
    width: 24,
    height: 24,
  },
});
