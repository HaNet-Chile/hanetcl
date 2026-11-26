import { SettingsLinkRow } from '@/components/settings/settings-list';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { HanetTimeWheels } from '@/components/ui/hanet-date-time-picker';
import { AppSpacing } from '@/constants/design-tokens';
import { MORNING_HOURS, MORNING_STEP, morningClock, morningMinutes } from '@/services/push-service';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { t } from '@/i18n';

/** "07:15" as the app writes times: "7:15". */
export function morningLabel(time: string) {
  return time.replace(/^0/, '');
}

/**
 * Configuraciones → Notificaciones: when the day's summary arrives. The row
 * shows the time and opens a dialog with wheels (every 15 minutes, 5:00 to
 * 13:45); "Guardar" saves it with the account.
 */
export function MorningTimeRow({ value, onSave, disabled = false }: {
  value: string;
  onSave: (time: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => morningMinutes(value));
  const [saving, setSaving] = useState(false);

  const show = () => {
    if (disabled) return;
    setDraft(morningMinutes(value));
    setOpen(true);
  };

  const save = async () => {
    const time = morningClock(draft);
    if (time === value) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(time);
    } catch {
      // Configuraciones says what went wrong under the group.
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <>
      <SettingsLinkRow
        icon="time-outline"
        label={t('components.settings.morningTimeRow.horaDelResumen')}
        detail={morningLabel(value)}
        hint={t('components.settings.morningTimeRow.eligeAQueHoraTe')}
        onPress={show}
      />
      <HanetDialog
        visible={open}
        onRequestClose={() => !saving && setOpen(false)}
        dismissOnBackdrop={!saving}
        title={t('components.settings.morningTimeRow.horaDelResumen')}
        body={t('components.settings.morningTimeRow.teLlegaLosDiasDe')}
      >
        <View style={styles.wheels}>
          <HanetTimeWheels minutes={draft} onChange={setDraft} minuteStep={MORNING_STEP} hours={MORNING_HOURS} label={t('components.settings.morningTimeRow.horaDelResumen')} />
        </View>
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" onPress={() => setOpen(false)} disabled={saving} style={dialogStyles.action} />
          <HanetButton label={saving ? t('common.guardando') : t('common.guardar')} variant="accent" onPress={() => void save()} disabled={saving} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>
    </>
  );
}

const styles = StyleSheet.create({
  wheels: { alignItems: 'center', marginBottom: AppSpacing.md },
});
