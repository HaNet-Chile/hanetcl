import { ThemedText } from '@/components/themed-text';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useWide } from '@/components/ui/wide-page';

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
  /** Buttons beside the title on a wide window; under the intro on the phone. */
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The top of a page that scrolls with its content: eyebrow, title and
 * intro, the same on every page of Herramientas, Notas and Configuraciones.
 * The title is the screen's header for screen readers. Beside the side
 * navigation (a wide web window) the title grows to the desktop size, the
 * same as ClassHall's, and `actions` move up beside it.
 */
export function PageHeader({ eyebrow, title, intro, above, children, actions, style }: Props) {
  const wide = useWide();
  const text = (
    <>
      {above}
      {!!eyebrow && <ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText>}
      <ThemedText accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>{title}</ThemedText>
      {typeof intro === 'string' ? <ThemedText style={[styles.intro, wide && styles.introWide]}>{intro}</ThemedText> : intro}
      {children}
    </>
  );
  if (wide) {
    return (
      <View style={[styles.header, styles.headerWide, style]}>
        <View style={styles.text}>{text}</View>
        {!!actions && <View style={styles.actionsWide}>{actions}</View>}
      </View>
    );
  }
  return (
    <View style={[styles.header, style]}>
      {text}
      {!!actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: AppSpacing.lg, gap: AppSpacing.xs },
  eyebrow: { ...AppType.caption, color: AppColors.textSecondary },
  title: { ...AppType.title1, color: AppColors.textPrimary },
  intro: { ...AppType.footnote, color: AppColors.textSecondary, marginTop: AppSpacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm, marginTop: AppSpacing.sm },
  // Wide web window: the desktop title, with the actions on its right.
  headerWide: { paddingTop: 0, flexDirection: 'row', alignItems: 'flex-end', gap: AppSpacing.lg },
  text: { flex: 1, minWidth: 0, gap: AppSpacing.xs },
  titleWide: { fontSize: 40, lineHeight: 46, letterSpacing: -1.6 },
  introWide: { ...AppType.callout, maxWidth: 620 },
  actionsWide: { flexDirection: 'row', gap: AppSpacing.sm, paddingBottom: 2 },
});
