import { SettingsGroup, SettingsLinkRow } from '@/components/settings/settings-list';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { HanetDialog } from '@/components/ui/hanet-dialog';
import { AppSpacing } from '@/constants/design-tokens';
import { HOME_CALENDAR_TYPES, setHomeCalendarTypes, useHomeCalendarTypes } from '@/services/home-calendar';
import type { HomeCalendarType } from '@/services/home-calendar';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { t } from '@/i18n';

/**
 * Configuraciones → Inicio: which kinds of events of the course the
 * Calendar's notice on the Home may show. The row says how many are chosen
 * and opens the picker, a dialog with one chip per kind; each tap is saved.
 */
export function HomeCalendarSetting() {
  const chosen = useHomeCalendarTypes();
  const [open, setOpen] = useState(false);

  const toggle = (type: HomeCalendarType) => {
    setHomeCalendarTypes(chosen.includes(type) ? chosen.filter(item => item !== type) : [...chosen, type]);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };

  const detail = chosen.length === 0
    ? t('components.settings.homeCalendarSetting.apagado')
    : chosen.length === HOME_CALENDAR_TYPES.length
      ? t('components.settings.homeCalendarSetting.todos')
      : chosen.length === 1 ? chosen[0] : t('components.settings.homeCalendarSetting.countTipos', { count: chosen.length });

  return (
    <>
      <SettingsGroup title={t('layout.inicio')} footer={t('components.settings.homeCalendarSetting.elAvisoMuestraLoMas')}>
        <SettingsLinkRow icon="calendar-outline" label={t('components.settings.homeCalendarSetting.avisoDelCalendar')} detail={detail} hint={t('components.settings.homeCalendarSetting.eligeQueEventosMuestra')} onPress={() => setOpen(true)} />
      </SettingsGroup>

      <HanetDialog
        visible={open}
        onRequestClose={() => setOpen(false)}
        dismissOnBackdrop
        title={t('components.settings.homeCalendarSetting.avisoDelCalendar')}
        body={t('components.settings.homeCalendarSetting.eligeQueEventosDeTu')}
      >
        <View style={styles.chips}>
          {HOME_CALENDAR_TYPES.map(type => (
            <HanetChip key={type} label={type} selected={chosen.includes(type)} accessibilityRole="checkbox" onPress={() => toggle(type)} />
          ))}
        </View>
        <HanetButton label={t('common.listo')} variant="surface" onPress={() => setOpen(false)} />
      </HanetDialog>
    </>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
    marginBottom: AppSpacing.sm,
  },
});
