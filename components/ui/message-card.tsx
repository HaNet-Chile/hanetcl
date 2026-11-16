import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { t } from '@/i18n';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  message: string;
  /** Shows "Reintentar" under the message, for a load that failed. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Read out when it appears (errors). On by default when there is a retry. */
  live?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A plain card with one message in place of a list or a section: it could
 * not load (with "Reintentar"), there is nothing yet, or a module is off.
 * Grey, never pink: it is information, not an alarm.
 */
export function MessageCard({ message, onRetry, retryLabel, live, style }: Props) {
  const announce = live ?? !!onRetry;
  return (
    <View style={[styles.card, style]}>
      <ThemedText accessibilityLiveRegion={announce ? 'polite' : undefined} style={styles.body}>{message}</ThemedText>
      {onRetry && <HanetButton label={retryLabel ?? t('common.reintentar')} variant="surface" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: AppSpacing.md,
    padding: AppSpacing.lg,
    borderRadius: AppRadii.lg,
    borderCurve: 'continuous',
    backgroundColor: AppColors.surface,
  },
  body: {
    ...AppType.callout,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 21,
    color: AppColors.textPrimary,
  },
});
