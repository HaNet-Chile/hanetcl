import { SettingsNote } from '@/components/settings/settings-list';
import { ThemedText } from '@/components/themed-text';
import { restartApp } from '@/components/errors/AppErrorScreens';
import { AppColors, AppPalettes, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import type { AppScheme } from '@/constants/design-tokens';
import { colorSchemeMode, saveColorSchemeMode } from '@/services/color-scheme';
import type { ColorSchemeMode } from '@/services/color-scheme';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { t } from '@/i18n';

type Option = { mode: ColorSchemeMode; label: string };

// Built on each render, so the labels follow the language in use.
const options = (): Option[] => [
  { mode: 'dark', label: t('components.settings.appearanceSetting.oscuro') },
  { mode: 'light', label: t('components.settings.appearanceSetting.claro') },
  { mode: 'system', label: t('components.settings.appearanceSetting.automatico') },
];

/** A tiny screen in one theme: the canvas, a card and the pink accent. */
function Preview({ scheme }: { scheme: AppScheme }) {
  const palette = AppPalettes[scheme];
  return (
    <View style={[styles.preview, { backgroundColor: palette.canvas }]}>
      <View style={[styles.previewCard, { backgroundColor: palette.surface }]}>
        <View style={[styles.previewLine, { backgroundColor: palette.textPrimary }]} />
        <View style={[styles.previewLine, styles.previewLineShort, { backgroundColor: palette.textSecondary }]} />
      </View>
      <View style={styles.previewRow}>
        <View style={[styles.previewPill, { backgroundColor: palette.controlActive }]} />
        <View style={[styles.previewDot, { backgroundColor: palette.accent }]} />
      </View>
    </View>
  );
}

/**
 * Configuraciones → Apariencia: dark (the default), light or the phone's
 * own. Every screen reads its colors once when it loads, so a new choice
 * opens HaNet again.
 */
export function AppearanceSetting() {
  const [mode, setMode] = useState<ColorSchemeMode>(colorSchemeMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (next: ColorSchemeMode) => {
    if (saving || next === mode) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    const previous = mode;
    setMode(next);
    setError(null);
    setSaving(true);
    try {
      await saveColorSchemeMode(next);
      await restartApp();
    } catch {
      setMode(previous);
      setError(t('components.settings.appearanceSetting.noPudimosCambiarLaApariencia'));
      setSaving(false);
    }
  };

  return (
    <View style={styles.block}>
      <ThemedText accessibilityRole="header" style={styles.title}>{t('components.settings.appearanceSetting.apariencia')}</ThemedText>
      <View accessibilityRole="radiogroup" style={styles.card}>
        {options().map(option => {
          const selected = option.mode === mode;
          return (
            <Pressable
              key={option.mode}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected, disabled: saving }}
              disabled={saving}
              onPress={() => void choose(option.mode)}
              style={({ pressed }) => [styles.option, pressed && AppPressed]}
            >
              <View style={[styles.ring, selected && styles.ringSelected]}>
                {option.mode === 'system' ? (
                  <View style={styles.split}>
                    <View style={styles.half}><View style={[styles.halfInner, styles.halfLeft]}><Preview scheme="dark" /></View></View>
                    <View style={styles.half}><View style={[styles.halfInner, styles.halfRight]}><Preview scheme="light" /></View></View>
                  </View>
                ) : (
                  <Preview scheme={option.mode} />
                )}
              </View>
              <ThemedText numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>{option.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      {!!error && <SettingsNote error>{error}</SettingsNote>}
      <SettingsNote>
        {mode === 'system'
          ? t('components.settings.appearanceSetting.sigueElModoClaroU')
          : t('components.settings.appearanceSetting.alCambiarlaHanetSeVuelve')}
      </SettingsNote>
    </View>
  );
}

const PREVIEW_HEIGHT = 92;

const styles = StyleSheet.create({
  block: { gap: AppSpacing.sm },
  title: { ...AppType.footnote, fontFamily: 'DMSans_700Bold', color: AppColors.textSecondary, paddingHorizontal: AppSpacing.sm },
  card: { flexDirection: 'row', gap: AppSpacing.sm, padding: 14, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  option: { flex: 1, alignItems: 'center', gap: AppSpacing.sm },
  ring: { alignSelf: 'stretch', padding: 3, borderRadius: 18, borderCurve: 'continuous', borderWidth: 2, borderColor: 'transparent' },
  ringSelected: { borderColor: AppColors.accent },
  preview: { height: PREVIEW_HEIGHT, borderRadius: 13, borderCurve: 'continuous', padding: 8, gap: 6, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: AppColors.separator },
  previewCard: { flex: 1, borderRadius: 7, padding: 7, gap: 5 },
  previewLine: { height: 5, width: '80%', borderRadius: 3 },
  previewLineShort: { width: '50%', opacity: 0.7 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  previewPill: { flex: 1, height: 12, borderRadius: AppRadii.pill },
  previewDot: { width: 12, height: 12, borderRadius: 6 },
  split: { height: PREVIEW_HEIGHT, flexDirection: 'row', borderRadius: 13, borderCurve: 'continuous', overflow: 'hidden' },
  half: { flex: 1, overflow: 'hidden' },
  // Each half shows its side of a full-width preview.
  halfInner: { position: 'absolute', top: 0, width: '200%' },
  halfLeft: { left: 0 },
  halfRight: { right: 0 },
  label: { ...AppType.caption, color: AppColors.textSecondary, textAlign: 'center' },
  labelSelected: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold' },
});
