import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { AppColors, AppRadii, AppSpacing } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { PAUSE_MESSAGE_MAX, fetchAppStatus, previewPausedScreen, saveAppStatus, useKnownAppStatus } from '@/services/app-status';
import type { AppPauseKind } from '@/services/app-status';
import { dateLocale, t } from '@/i18n';
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

const KIND_LABELS: Record<AppPauseKind, string> = {
  maintenance: t('components.hnt.appStatusCard.mantencion'),
  incident: t('components.hnt.appStatusCard.unProblema'),
  closed: t('components.hnt.appStatusCard.cerradoPorAhora'),
};

type Back = 'none' | 'keep' | '30' | '60' | '120' | 'tomorrow';

const BACK_LABELS: Record<Exclude<Back, 'keep'>, string> = {
  none: t('components.hnt.appStatusCard.sinHora'),
  '30': t('components.hnt.appStatusCard.en30Min'),
  '60': t('components.hnt.appStatusCard.en1Hora'),
  '120': t('components.hnt.appStatusCard.en2Horas'),
  tomorrow: t('components.hnt.appStatusCard.manana800'),
};

function untilFor(back: Back, current: number | null) {
  if (back === 'keep') return current;
  if (back === 'none') return null;
  if (back === 'tomorrow') {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(8, 0, 0, 0);
    return date.getTime();
  }
  return Date.now() + Number(back) * 60_000;
}

function timeText(until: number) {
  return new Date(until).toLocaleString(dateLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/**
 * Panel HNT: closes HaNet to the public (maintenance, a problem, or closed
 * for now) and opens it again. While it is closed everyone but the team sees
 * PausedScreen; "Ver cómo se ve" shows it with these values first.
 */
export function AppStatusCard() {
  const status = useKnownAppStatus();
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<AppPauseKind>('maintenance');
  const [message, setMessage] = useState('');
  const [back, setBack] = useState<Back>('none');
  const [confirm, setConfirm] = useState<'close' | 'open' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAppStatus().then(current => {
      if (!active) return;
      setLoaded(true);
      if (current && !current.open) {
        setKind(current.kind ?? 'maintenance');
        setMessage(current.message ?? '');
        setBack(current.until ? 'keep' : 'none');
      }
    });
    return () => { active = false; };
  }, []);

  const closed = status?.open === false;
  const draft = {
    open: false as const,
    kind,
    message: message.trim() || null,
    until: untilFor(back, status?.until ?? null),
  };

  const save = async (next: typeof draft | { open: true }) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await saveAppStatus(next);
      setDone(result.open ? t('components.hnt.appStatusCard.hanetQuedoAbiertoParaTodos') : t('components.hnt.appStatusCard.listoHanetQuedoCerradoAl'));
      if (result.open) {
        setMessage('');
        setBack('none');
      } else {
        setBack(result.until ? 'keep' : 'none');
      }
    } catch (saveError) {
      setError(describeAuthError(saveError, t('components.hnt.appStatusCard.noPudimosCambiarElEstado')));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const summary = !loaded
    ? t('tickets.scan.revisando')
    : !status
      ? t('components.hnt.appStatusCard.noPudimosSaberElEstado')
      : status.open
        ? t('components.hnt.appStatusCard.abiertoParaTodos')
        : t('components.hnt.appStatusCard.cerradoAlPublicoKindlabelsValue', { kindLabels: KIND_LABELS[status.kind ?? 'maintenance'], value: status.until ? t('components.hnt.appStatusCard.vuelveTimetext', { timeText: timeText(status.until) }) : '' });

  return (
    <View style={styles.card}>
      <ThemedText style={styles.title}>{t('components.hnt.appStatusCard.estadoDeHanet')}</ThemedText>
      <ThemedText style={[styles.muted, closed && styles.closed]}>{summary}</ThemedText>

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
        placeholderTextColor="rgba(221,221,226,0.4)"
        maxLength={PAUSE_MESSAGE_MAX}
        multiline
        style={[styles.input, styles.multiline]}
      />

      <ThemedText style={styles.label}>{t('components.hnt.appStatusCard.cuandoVuelve')}</ThemedText>
      <View style={styles.chips}>
        {back === 'keep' && status?.until && (
          <HanetChip label={t('components.hnt.appStatusCard.comoEstaTimetext', { timeText: timeText(status.until) })} selected onPress={() => setBack('keep')} />
        )}
        {(Object.keys(BACK_LABELS) as Exclude<Back, 'keep'>[]).map(option => (
          <HanetChip key={option} label={BACK_LABELS[option]} selected={back === option} onPress={() => setBack(option)} />
        ))}
      </View>

      <HanetButton label={t('components.hnt.appStatusCard.verComoSeVe')} variant="surface" onPress={() => previewPausedScreen(draft)} />
      {closed ? (
        <>
          <HanetButton label={busy ? t('common.guardando') : t('common.guardarCambios')} variant="surface" disabled={busy} onPress={() => void save(draft)} />
          <HanetButton label={t('components.hnt.appStatusCard.abrirHanet')} disabled={busy || !loaded} onPress={() => setConfirm('open')} />
        </>
      ) : (
        <HanetButton label={t('components.hnt.appStatusCard.cerrarHanetAlPublico')} variant="accent" disabled={busy || !loaded} onPress={() => setConfirm('close')} />
      )}

      {!!done && <ThemedText accessibilityLiveRegion="polite" style={styles.message}>{done}</ThemedText>}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}

      <HanetDialog
        visible={!!confirm}
        onRequestClose={() => { if (!busy) setConfirm(null); }}
        title={confirm === 'open' ? t('components.hnt.appStatusCard.abrirHanetParaTodos') : t('components.hnt.appStatusCard.cerrarHanetAlPublico2')}
        body={confirm === 'open'
          ? t('components.hnt.appStatusCard.todosVuelvenAEntrarNormal')
          : t('components.hnt.appStatusCard.todosMenosElEquipoHanet')}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" disabled={busy} onPress={() => setConfirm(null)} style={dialogStyles.action} />
          <HanetButton
            label={busy ? t('common.guardando') : confirm === 'open' ? t('components.errors.appErrorLayer.abrir') : t('common.cerrar')}
            variant={confirm === 'open' ? 'primary' : 'accent'}
            disabled={busy}
            onPress={() => void save(confirm === 'open' ? { open: true } : draft)}
            style={dialogStyles.action}
          />
        </HanetDialogActions>
      </HanetDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: AppSpacing.md,
    padding: AppSpacing.xl,
    borderRadius: AppRadii.lg,
    borderCurve: 'continuous',
    backgroundColor: AppColors.surface,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.5,
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
