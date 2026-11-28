import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { HanetDateTimePickerModal } from '@/components/ui/hanet-date-time-picker';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { SettingsToggleRow } from '@/components/settings/settings-list';
import { AppColors, AppRadii, AppSpacing } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { PAUSE_MESSAGE_MAX, closureAsStatus, previewPausedScreen } from '@/services/app-status';
import type { AppPauseKind } from '@/services/app-status';
import { setInstitutionClosure } from '@/services/hnt-admin-service';
import type { AdminInstitution, InstitutionClosureInfo } from '@/services/hnt-admin-service';
import { dateLocale, t } from '@/i18n';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

const KIND_LABELS: Record<AppPauseKind, string> = {
  maintenance: t('components.hnt.institutionClosureCard.preparandoElAno'),
  incident: t('components.hnt.appStatusCard.unProblema'),
  closed: t('components.hnt.appStatusCard.cerradoPorAhora'),
};

type From = 'now' | 'date';
type Until = 'none' | 'classes' | 'date';

function when(ms: number) {
  return new Date(ms).toLocaleString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

// The first day of classes at 8:00, the liceo's own date.
function classesStart(start: string | undefined) {
  if (!start) return null;
  const [year, month, day] = start.split('-').map(Number);
  const date = new Date(year, month - 1, day, 8, 0, 0, 0);
  return date.getTime() > Date.now() ? date.getTime() : null;
}

function isAhead(ms: number | null | undefined) {
  return !!ms && ms > Date.now();
}

function tomorrowAt8() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(8, 0, 0, 0);
  return date.getTime();
}

/**
 * Panel HNT: closes HaNet for this liceo only (functions/institutions.js,
 * setInstitutionClosure), now or from a later time, until a time when it
 * opens by itself or until it is opened by hand. Its members see the closed
 * screen with the liceo's name; HNT and its Admin still get in, and its
 * teachers if "Los docentes también entran" is on.
 */
export function InstitutionClosureCard({ institution, onChange }: { institution: AdminInstitution; onChange: (closure: InstitutionClosureInfo | null) => void }) {
  const current = institution.closure ?? null;
  const classes = classesStart(institution.schoolYear?.start);
  const [kind, setKind] = useState<AppPauseKind>(current?.kind ?? 'maintenance');
  const [message, setMessage] = useState(current?.message ?? '');
  const [from, setFrom] = useState<From>(() => (isAhead(current?.from) ? 'date' : 'now'));
  const [fromAt, setFromAt] = useState<number>(() => (isAhead(current?.from) ? current!.from! : tomorrowAt8()));
  const [until, setUntil] = useState<Until>(current?.until ? (current.until === classes ? 'classes' : 'date') : 'none');
  const [untilAt, setUntilAt] = useState<number>(current?.until ?? classes ?? tomorrowAt8());
  const [teachers, setTeachers] = useState(current?.teachers ?? false);
  const [picking, setPicking] = useState<'from' | 'until' | null>(null);
  const [confirm, setConfirm] = useState<'close' | 'open' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const draft = {
    closed: true as const,
    kind,
    message: message.trim() || null,
    from: from === 'date' ? fromAt : null,
    until: until === 'none' ? null : until === 'classes' ? classes : untilAt,
    teachers,
  };

  const save = async (next: typeof draft | { closed: false }) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const closure = await setInstitutionClosure(institution.id, next);
      onChange(closure);
      setDone(!closure
        ? t('components.hnt.institutionClosureCard.hanetQuedoAbiertoEnName', { name: institution.name })
        : closure.active ? t('components.hnt.institutionClosureCard.listoHanetQuedoCerradoEn', { name: institution.name }) : t('components.hnt.institutionClosureCard.listoHanetSeCierraEn', { name: institution.name, when: when(closure.from ?? Date.now()) }));
    } catch (saveError) {
      setError(describeAuthError(saveError, t('components.hnt.institutionClosureCard.noPudimosCambiarElEstado')));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const summary = !current
    ? t('components.hnt.appStatusCard.abiertoParaTodos')
    : current.active
      ? (current.until ? t('components.hnt.institutionClosureCard.cerradoAhoraAbreSoloEl', { when: when(current.until) }) : t('components.hnt.institutionClosureCard.cerradoAhoraHastaQueLo'))
      : t('components.hnt.institutionClosureCard.seCierraElWhenValue', { when: when(current.from ?? 0), value: current.until ? t('components.hnt.institutionClosureCard.yAbreElWhen', { when: when(current.until) }) : '' });

  return (
    <View style={styles.card}>
      <ThemedText style={styles.title}>{t('components.hnt.institutionClosureCard.cerrarHanetEnEsteLiceo')}</ThemedText>
      <ThemedText style={[styles.muted, current?.active && styles.closed]}>{summary}</ThemedText>
      <ThemedText style={styles.muted}>{t('components.hnt.institutionClosureCard.mientrasEstaCerradoSoloEl')}</ThemedText>

      <ThemedText style={styles.label}>{t('dayChange.quePasa')}</ThemedText>
      <View style={styles.chips}>
        {(Object.keys(KIND_LABELS) as AppPauseKind[]).map(option => (
          <HanetChip key={option} label={KIND_LABELS[option]} selected={kind === option} onPress={() => setKind(option)} />
        ))}
      </View>
      <TextInput
        accessibilityLabel={t('components.hnt.appStatusCard.mensajeParaLaPantalla')}
        value={message}
        onChangeText={setMessage}
        placeholder={t('components.hnt.appStatusCard.mensajeOpcionalSiLoEscribes')}
        placeholderTextColor={AppColors.placeholder}
        maxLength={PAUSE_MESSAGE_MAX}
        multiline
        style={[styles.input, styles.multiline]}
      />

      <ThemedText style={styles.label}>{t('dayChange.desde')}</ThemedText>
      <View style={styles.chips}>
        <HanetChip label={t('common.ahora')} selected={from === 'now'} onPress={() => setFrom('now')} />
        <HanetChip label={from === 'date' ? when(fromAt) : t('components.hnt.institutionClosureCard.elegirFecha')} selected={from === 'date'} onPress={() => { setFrom('date'); setPicking('from'); }} />
      </View>

      <ThemedText style={styles.label}>{t('anniversary.deadline.hasta')}</ThemedText>
      <View style={styles.chips}>
        <HanetChip label={t('components.hnt.institutionClosureCard.hastaQueLoAbras')} selected={until === 'none'} onPress={() => setUntil('none')} />
        {classes !== null && <HanetChip label={t('components.hnt.institutionClosureCard.hastaQueEmpiecenLasClases')} selected={until === 'classes'} onPress={() => setUntil('classes')} />}
        <HanetChip label={until === 'date' ? when(untilAt) : t('components.hnt.institutionClosureCard.elegirFecha')} selected={until === 'date'} onPress={() => { setUntil('date'); setPicking('until'); }} />
      </View>
      {until !== 'none' && <ThemedText style={styles.muted}>{t('components.hnt.institutionClosureCard.aEsaHoraHanetSe')}</ThemedText>}

      <View style={styles.toggle}>
        <SettingsToggleRow
          icon="school-outline"
          label={t('components.hnt.institutionClosureCard.losDocentesTambienEntran')}
          detail={t('components.hnt.institutionClosureCard.paraQueArmenSusHalls')}
          value={teachers}
          onChange={setTeachers}
          disabled={busy}
        />
      </View>

      <HanetButton label={t('components.hnt.appStatusCard.verComoSeVe')} variant="surface" onPress={() => previewPausedScreen(closureAsStatus({ ...draft, name: institution.name }))} />
      {current ? (
        <>
          <HanetButton label={busy ? t('common.guardando') : t('common.guardarCambios')} variant="surface" disabled={busy} onPress={() => void save(draft)} />
          <HanetButton label={t('components.hnt.institutionClosureCard.abrirHanetEnElLiceo')} disabled={busy} onPress={() => setConfirm('open')} />
        </>
      ) : (
        <HanetButton label={t('components.hnt.institutionClosureCard.cerrarHanetEnElLiceo')} variant="accent" disabled={busy} onPress={() => setConfirm('close')} />
      )}
      {!!done && <ThemedText accessibilityLiveRegion="polite" style={styles.message}>{done}</ThemedText>}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}

      <HanetDateTimePickerModal
        visible={picking !== null}
        value={new Date(picking === 'from' ? fromAt : untilAt)}
        onCancel={() => setPicking(null)}
        onConfirm={date => {
          if (picking === 'from') setFromAt(date.getTime());
          else setUntilAt(date.getTime());
          setPicking(null);
        }}
      />
      <HanetDialog
        visible={!!confirm}
        onRequestClose={() => { if (!busy) setConfirm(null); }}
        title={confirm === 'open' ? t('components.hnt.institutionClosureCard.abrirHanetEnName', { name: institution.name }) : t('components.hnt.institutionClosureCard.cerrarHanetEnName', { name: institution.name })}
        body={confirm === 'open'
          ? t('components.hnt.institutionClosureCard.todosLosDelLiceoVuelven')
          : teachers
            ? t('components.hnt.institutionClosureCard.estudiantesDirectivasYCeeVen')
            : t('components.hnt.institutionClosureCard.estudiantesDocentesDirectivasYCee')}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" disabled={busy} onPress={() => setConfirm(null)} style={dialogStyles.action} />
          <HanetButton
            label={busy ? t('common.guardando') : confirm === 'open' ? t('components.errors.appErrorLayer.abrir') : t('common.cerrar')}
            variant={confirm === 'open' ? 'primary' : 'accent'}
            disabled={busy}
            onPress={() => void save(confirm === 'open' ? { closed: false } : draft)}
            style={dialogStyles.action}
          />
        </HanetDialogActions>
      </HanetDialog>
    </View>
  );
}

export const institutionCardStyles = StyleSheet.create({
  // A section of the institution's card in the Panel HNT, like "Identidad".
  card: {
    gap: AppSpacing.md,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    lineHeight: 22,
    color: AppColors.textPrimary,
  },
  label: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.textPrimary,
  },
  muted: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.textSecondary,
  },
  closed: {
    color: AppColors.errorText,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.md,
    borderRadius: AppRadii.md,
    borderCurve: 'continuous',
    backgroundColor: AppColors.canvas,
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: AppColors.textPrimary,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  toggle: {
    borderRadius: AppRadii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: AppColors.canvas,
  },
  message: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.textPrimary,
  },
  error: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.errorText,
  },
});

const styles = institutionCardStyles;
