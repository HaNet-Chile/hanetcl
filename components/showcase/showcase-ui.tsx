import { ThemedText } from '@/components/themed-text';
import { AppColors, AppRadii, AppSpacing } from '@/constants/design-tokens';
import React, { createContext, useContext } from 'react';
import { StyleSheet, View } from 'react-native';

// The pieces of Sistema HaNet UI (app/ui-showcase.tsx, Panel HNT): each
// component goes in a Section with what it is for, and a Note under a test
// button says what happened or why it can't run here. Only the team sees
// this, with sample data, so its texts don't go through t() (the i18n script
// skips app/ui-showcase.tsx and components/showcase/).

export function Section({ title, description, source, children }: { title: string; description: string; source?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>{title}</ThemedText>
      <ThemedText style={styles.sectionDescription}>{description}</ThemedText>
      {children}
      {!!source && <ThemedText style={styles.source} selectable>{source}</ThemedText>}
    </View>
  );
}

export function GroupTitle({ children }: { children: string }) {
  return <ThemedText accessibilityRole="header" style={styles.groupTitle}>{children}</ThemedText>;
}

/** A line under a test button: what happened, or why it cannot run here. */
export function Note({ children }: { children: string | null | false | undefined }) {
  if (!children) return null;
  return <ThemedText style={styles.note} accessibilityLiveRegion="polite">{children}</ThemedText>;
}

/** A plain surface to sit an example on. */
export function Stage({ children, canvas = false }: { children: React.ReactNode; canvas?: boolean }) {
  return <View style={[styles.stage, canvas && styles.stageCanvas]}>{children}</View>;
}

/**
 * Lets a section show something over the whole screen for a moment, such
 * as a TopNotice, which sits at the top of the window.
 */
export const OverlayContext = createContext<(node: React.ReactNode, ms?: number) => void>(() => {});
export const useOverlay = () => useContext(OverlayContext);

export const showcaseStyles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  buttonStack: { gap: AppSpacing.sm },
  buttonRow: { flexDirection: 'row', gap: AppSpacing.sm },
  flexButton: { flex: 1 },
  // The feed's components keep their own side margins; here they sit flush.
  bleed: { marginHorizontal: -AppSpacing.lg },
});

const styles = StyleSheet.create({
  groupTitle: { marginBottom: -AppSpacing.md, color: AppColors.accent, fontFamily: 'DMSans_700Bold', fontSize: 13, lineHeight: 18, letterSpacing: 0.4, textTransform: 'uppercase' },
  section: { gap: AppSpacing.md },
  sectionTitle: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
  sectionDescription: { color: AppColors.textSecondary, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  note: { color: AppColors.textSecondary, fontFamily: 'DMSans_500Medium', fontSize: 13, lineHeight: 18 },
  source: { color: AppColors.surfaceSoft, opacity: 0.7, fontFamily: 'DMSans_500Medium', fontSize: 11, lineHeight: 15 },
  stage: { gap: AppSpacing.md, padding: AppSpacing.lg, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  stageCanvas: { backgroundColor: AppColors.canvas, borderWidth: StyleSheet.hairlineWidth, borderColor: AppColors.surfaceMuted },
});
