import { institutionCardStyles as styles } from '@/components/hnt/InstitutionClosureCard';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDateTimePickerModal } from '@/components/ui/hanet-date-time-picker';
import { AppColors, AppPressed, AppRadii, AppSpacing } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { setInstitutionSchoolYear } from '@/services/hnt-admin-service';
import type { AdminInstitution, SchoolYear } from '@/services/hnt-admin-service';
import { dateLocale, t } from '@/i18n';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Field = 'start' | 'end' | 'secondSemester';

/** "2027-03-04" ⇄ a local date at noon (no time zone can move the day). */
export function dayToDate(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12, 0, 0, 0);
}

export function dateToDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dayText(day: string) {
  return dayToDate(day).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// A first guess for a liceo without dates: the Chilean calendar's usual March to December.
function suggested(): SchoolYear {
  const now = new Date();
  const year = now.getMonth() >= 11 ? now.getFullYear() + 1 : now.getFullYear();
  return { start: `${year}-03-04`, end: `${year}-12-18`, secondSemester: `${year}-07-28` };
}

/**
 * Panel HNT: the liceo's school year (setInstitutionSchoolYear). Notas
 * splits the semesters at the 2nd semester's first day, the summary of the
 * day doesn't go out before the first day nor after the last one, and
 * "Hasta que empiecen las clases" closes HaNet until the first day.
 */
export function InstitutionSchoolYearCard({ institution, onChange }: { institution: AdminInstitution; onChange: (schoolYear: SchoolYear | null) => void }) {
  const saved = institution.schoolYear ?? null;
  const [draft, setDraft] = useState<SchoolYear>(saved ?? suggested());
  const [picking, setPicking] = useState<Field | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const changed = !saved || saved.start !== draft.start || saved.end !== draft.end || saved.secondSemester !== draft.secondSemester;
  const problem = draft.end <= draft.start
    ? t('components.hnt.institutionSchoolYearCard.elUltimoDiaDeClases')
    : draft.secondSemester && (draft.secondSemester <= draft.start || draft.secondSemester > draft.end)
      ? t('components.hnt.institutionSchoolYearCard.el2SemestreTieneQue')
      : null;

  const save = async (next: SchoolYear | null) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await setInstitutionSchoolYear(institution.id, next);
      onChange(result);
      if (!result) setDraft(suggested());
      setDone(result ? t('components.hnt.institutionSchoolYearCard.listoGuardamosElAnoEscolar') : t('components.hnt.institutionSchoolYearCard.quitamosLasFechasDelAno'));
    } catch (saveError) {
      setError(describeAuthError(saveError, t('components.hnt.institutionSchoolYearCard.noPudimosGuardarElAno')));
    } finally {
      setBusy(false);
    }
  };

  const row = (field: Field, label: string, optional = false) => {
    const value = draft[field];
    return (
      <View style={local.field}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <View style={local.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('components.anniversary.anniversaryForm.labelValueCambiar', { label, value: value ? dayText(value) : t('components.anniversary.anniversaryForm.sinFecha') })}
            disabled={busy}
            onPress={() => setPicking(field)}
            style={({ pressed }) => [local.date, pressed && AppPressed]}
          >
            <ThemedText numberOfLines={1} style={local.dateText}>{value ? dayText(value) : t('components.anniversary.anniversaryForm.sinFecha2')}</ThemedText>
            <ThemedText style={local.action}>{value ? t('common.cambiar') : t('components.anniversary.anniversaryForm.elegir')}</ThemedText>
          </Pressable>
          {optional && !!value && (
            <Pressable accessibilityRole="button" accessibilityLabel={t('components.anniversary.anniversaryForm.quitarLabel', { label: label.toLocaleLowerCase('es') })} disabled={busy} onPress={() => setDraft(current => ({ ...current, [field]: null }))} hitSlop={8} style={({ pressed }) => pressed && AppPressed}>
              <ThemedText style={local.action}>{t('common.quitar')}</ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <ThemedText style={styles.title}>{t('components.hnt.institutionSchoolYearCard.anoEscolar')}</ThemedText>
      <ThemedText style={styles.muted}>
        {saved
          ? t('components.hnt.institutionSchoolYearCard.delDaytextAlDaytext2', { dayText: dayText(saved.start), dayText2: dayText(saved.end) })
          : t('components.hnt.institutionSchoolYearCard.todaviaSinFechasNotasCorta')}
      </ThemedText>
      {row('start', t('components.hnt.institutionSchoolYearCard.primerDiaDeClases'))}
      {row('secondSemester', t('components.hnt.institutionSchoolYearCard.empiezaEl2Semestre'), true)}
      {row('end', t('components.hnt.institutionSchoolYearCard.ultimoDiaDeClases'))}
      <ThemedText style={styles.muted}>{t('components.hnt.institutionSchoolYearCard.notasCortaLosSemestresEn')}</ThemedText>
      {!!problem && <ThemedText style={styles.error}>{problem}</ThemedText>}
      <HanetButton label={busy ? t('common.guardando') : saved ? t('common.guardarCambios') : t('components.hnt.institutionSchoolYearCard.guardarAnoEscolar')} variant="surface" disabled={busy || !changed || !!problem} onPress={() => void save(draft)} />
      {!!saved && (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save(null)} hitSlop={8} style={({ pressed }) => pressed && AppPressed}>
          <ThemedText style={local.action}>{t('components.hnt.institutionSchoolYearCard.quitarLasFechas')}</ThemedText>
        </Pressable>
      )}
      {!!done && <ThemedText accessibilityLiveRegion="polite" style={styles.message}>{done}</ThemedText>}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}

      <HanetDateTimePickerModal
        visible={picking !== null}
        dateOnly
        value={dayToDate((picking && draft[picking]) || draft.start)}
        onCancel={() => setPicking(null)}
        onConfirm={date => {
          if (picking) setDraft(current => ({ ...current, [picking]: dateToDay(date) }));
          setPicking(null);
        }}
      />
    </View>
  );
}

const local = StyleSheet.create({
  field: {
    gap: AppSpacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md,
  },
  date: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppSpacing.md,
    paddingHorizontal: AppSpacing.lg,
    borderRadius: AppRadii.md,
    borderCurve: 'continuous',
    backgroundColor: AppColors.canvas,
  },
  dateText: {
    flexShrink: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 15,
    color: AppColors.textPrimary,
  },
  action: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.accent,
  },
});
