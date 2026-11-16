import { ThemedText } from '@/components/themed-text';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  /** Where the page lives, small and grey over the title ("Herramientas", "Configuraciones"). */
  eyebrow?: string;
  title: string;
  /** One or two lines on what the page is for. A string, or text of its own. */
  intro?: React.ReactNode;
  /** Something above the eyebrow, such as a status chip ("Intento anterior"). */
  above?: React.ReactNode;
  /** More under the title (a teacher's name, a note). */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The top of a page that scrolls with its content: eyebrow, title and
 * intro, the same on every page of Herramientas, Notas and Configuraciones.
 * The title is the screen's header for screen readers.
 */
export function PageHeader({ eyebrow, title, intro, above, children, style }: Props) {
  return (
    <View style={[styles.header, style]}>
      {above}
      {!!eyebrow && <ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText>}
      <ThemedText accessibilityRole="header" style={styles.title}>{title}</ThemedText>
      {typeof intro === 'string' ? <ThemedText style={styles.intro}>{intro}</ThemedText> : intro}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: AppSpacing.lg, gap: AppSpacing.xs },
  eyebrow: { ...AppType.caption, color: AppColors.textSecondary },
  title: { ...AppType.title1, color: AppColors.textPrimary },
  intro: { ...AppType.footnote, color: AppColors.textSecondary, marginTop: AppSpacing.xs },
});
