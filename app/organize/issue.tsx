import { hallFormStyles as styles } from '@/components/classhall/hall-form';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { HanetChoice } from '@/components/ui/hanet-select';
import { withSheetFrame } from '@/components/ui/sheet-frame';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { getLoadedEvent } from '@/services/events-service';
import { listCourseLeads, listEventCourses, peekOrganizedEvents } from '@/services/organize-service';
import type { CourseLead, EventCourse } from '@/services/organize-service';
import { issueTickets } from '@/services/ticket-admin-service';
import type { IssueInput, IssueResult } from '@/services/ticket-admin-service';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Tickets for whole courses, from the nómina: one (or N) per student, or N
// per course to its Presidente de curso, who hands them out. The server says
// how many would go before anything is issued.

const MAX_PER_PERSON = 10;

function IssueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = peekOrganizedEvents()?.events.find(item => item.id === id) ?? getLoadedEvent(id);
  const [courses, setCourses] = useState<EventCourse[] | null>(null);
  const [leads, setLeads] = useState<CourseLead[]>([]);
  const [loadError, setLoadError] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [holder, setHolder] = useState<'student' | 'courseLead'>('student');
  const [perStudent, setPerStudent] = useState(1);
  const [plan, setPlan] = useState<{ key: string; result: IssueResult | null; error: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let live = true;
    setLoadError('');
    Promise.all([listEventCourses(), listCourseLeads().catch(() => [] as CourseLead[])])
      .then(([list, people]) => { if (live) { setCourses(list); setLeads(people); } })
      .catch(err => { if (live) setLoadError(describeAuthError(err, t('organize.noPudimosCargarLosCursos'))); });
    return () => { live = false; };
  }, []);
  // Again on coming back from naming Presidentes de curso.
  useFocusEffect(load);

  const input: IssueInput = { eventId: id, mode: 'courses', courseIds: chosen, perStudent, holder };
  const planKey = JSON.stringify(input);
  const missingLeads = holder === 'courseLead' ? chosen.filter(course => !leads.some(lead => lead.courseId === course)) : [];
  const ready = chosen.length > 0 && missingLeads.length === 0;

  // What it would issue, asked again a moment after the choice stops changing.
  useEffect(() => {
    if (!ready) return;
    let live = true;
    const timer = setTimeout(() => {
      issueTickets({ ...input, dryRun: true })
        .then(result => { if (live) setPlan({ key: planKey, result, error: '' }); })
        .catch(err => { if (live) setPlan({ key: planKey, result: null, error: describeAuthError(err, t('organize.noPudimosCalcularLasEntradas')) }); });
    }, 400);
    return () => { live = false; clearTimeout(timer); };
  }, [planKey, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = ready && plan?.key === planKey ? plan : null;
  const count = current?.result?.count ?? 0;

  const toggle = (course: string) => setChosen(list => list.includes(course) ? list.filter(item => item !== course) : [...list, course]);
  const allChosen = !!courses?.length && chosen.length === courses.length;

  const issue = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await issueTickets(input);
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirming(false);
      router.back();
    } catch (err) {
      setConfirming(false);
      setBusy(false);
      setError(describeAuthError(err, t('organize.noPudimosEmitirLasEntradas')));
    }
  };

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={[styles.content, { paddingTop: AppSpacing.xxl, paddingBottom: insets.bottom + AppSpacing.xl }]} showsVerticalScrollIndicator={false}>
      <View>
        <ThemedText accessibilityRole="header" style={styles.title}>{t('organize.emitirPorCurso')}</ThemedText>
        {!!event && <ThemedText style={local.event}>{event.title}</ThemedText>}
      </View>

      {!courses && !loadError && <ActivityIndicator color={AppColors.textSecondary} />}
      {!!loadError && (
        <View style={styles.field}>
          <ThemedText style={styles.error}>{loadError}</ThemedText>
          <HanetButton label={t('calendar.intentarDeNuevo')} variant="surface" onPress={load} />
        </View>
      )}

      {!!courses && (
        <>
          <View style={styles.field}>
            <View style={local.labelLine}>
              <ThemedText style={styles.label}>{t('organize.cursos')}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => setChosen(allChosen ? [] : courses.map(course => course.id))} hitSlop={8}>
                <ThemedText style={local.link}>{allChosen ? t('organize.ninguno') : t('organize.todosLosCursos')}</ThemedText>
              </Pressable>
            </View>
            {courses.length === 0 && <ThemedText style={styles.hint}>{t('organize.laNominaTodaviaNoTiene')}</ThemedText>}
            <View style={local.chips}>
              {courses.map(course => (
                <HanetChip
                  key={course.id}
                  label={`${course.id} · ${course.students}`}
                  selected={chosen.includes(course.id)}
                  accessibilityRole="checkbox"
                  onPress={() => toggle(course.id)}
                  compact
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('organize.quienLasRecibe')}</ThemedText>
            <HanetChoice
              label={t('organize.quienLasRecibe')}
              options={[{ value: 'student', label: t('organize.cadaEstudiante') }, { value: 'courseLead', label: t('organize.elPresidenteDeCadaCurso') }]}
              value={holder}
              onChange={value => setHolder(value as typeof holder)}
            />
            <ThemedText style={styles.hint}>{holder === 'student' ? t('organize.quienYaTieneUnaEntrada') : t('organize.elPresidenteRecibeLasEntradas')}</ThemedText>
            {missingLeads.length > 0 && (
              <View style={local.warning}>
                <ThemedText style={local.warningText}>{t('organize.sinPresidenteDeCursoCourses', { courses: missingLeads.join(', ') })}</ThemedText>
                <HanetButton label={t('organize.nombrarPresidentesDeCurso')} variant="surface" onPress={() => router.push('/organize/leads')} />
              </View>
            )}
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>{holder === 'student' ? t('organize.entradasPorEstudiante') : t('organize.entradasPorCurso')}</ThemedText>
            <View style={local.stepper}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('organize.menos')} disabled={perStudent <= 1} onPress={() => setPerStudent(value => Math.max(1, value - 1))} style={({ pressed }) => [local.step, perStudent <= 1 && local.stepOff, pressed && AppPressed]}>
                <Ionicons name="remove" size={20} color={AppColors.textPrimary} />
              </Pressable>
              <ThemedText accessibilityLiveRegion="polite" style={local.stepValue}>{perStudent}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel={t('organize.mas')} disabled={perStudent >= MAX_PER_PERSON} onPress={() => setPerStudent(value => Math.min(MAX_PER_PERSON, value + 1))} style={({ pressed }) => [local.step, perStudent >= MAX_PER_PERSON && local.stepOff, pressed && AppPressed]}>
                <Ionicons name="add" size={20} color={AppColors.textPrimary} />
              </Pressable>
            </View>
          </View>

          {ready && (
            <View accessibilityLiveRegion="polite" style={local.plan}>
              {!current && <ActivityIndicator color={AppColors.textSecondary} />}
              {!!current?.result && (
                <>
                  <ThemedText style={local.planTitle}>{t('organize.seEmitiranCountEntradas', { count: current.result.count })}</ThemedText>
                  {!!current.result.skipped && <ThemedText style={local.planText}>{t('organize.countYaTenianUna', { count: current.result.skipped })}</ThemedText>}
                  {current.result.remaining !== null && (
                    <ThemedText style={local.planText}>{t('organize.quedanRemainingDeCap', { remaining: current.result.remaining, cap: current.result.cap })}</ThemedText>
                  )}
                </>
              )}
              {!!current?.error && <ThemedText style={styles.error}>{current.error}</ThemedText>}
            </View>
          )}

          {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
          <Pressable
            accessibilityRole="button"
            disabled={!count || busy}
            onPress={() => setConfirming(true)}
            style={({ pressed }) => [styles.submit, local.submit, (!count || busy) && styles.submitDisabled, pressed && styles.pressed]}
          >
            <ThemedText style={styles.submitText}>{count ? t('organize.emitirCountEntradas', { count }) : t('organize.emitirEntradas')}</ThemedText>
          </Pressable>
        </>
      )}

      {Platform.OS !== 'ios' && (
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <ThemedText style={styles.cancelText}>{t('common.cancelar')}</ThemedText>
        </Pressable>
      )}

      <HanetDialog
        visible={confirming}
        onRequestClose={() => { if (!busy) setConfirming(false); }}
        title={t('organize.emitirCountEntradasPregunta', { count })}
        body={t('organize.lesLlegaUnAvisoY')}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" onPress={() => setConfirming(false)} disabled={busy} style={dialogStyles.action} />
          <HanetButton label={busy ? t('organize.emitiendo') : t('organize.emitir')} variant="accent" onPress={() => void issue()} disabled={busy} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  event: { ...AppType.callout, color: AppColors.textSecondary, marginTop: 4 },
  labelLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  warning: { gap: AppSpacing.md, padding: AppSpacing.lg, borderRadius: AppRadii.md, borderCurve: 'continuous', backgroundColor: AppColors.canvas },
  warningText: { ...AppType.footnote, color: AppColors.textPrimary },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: AppSpacing.md, padding: 4, borderRadius: AppRadii.pill, backgroundColor: AppColors.canvas },
  step: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.surfaceMuted },
  stepOff: { opacity: 0.4 },
  stepValue: { ...AppType.title3, minWidth: 28, textAlign: 'center', color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  plan: { gap: 4, padding: AppSpacing.lg, borderRadius: AppRadii.md, borderCurve: 'continuous', backgroundColor: AppColors.canvas },
  planTitle: { ...AppType.headline, color: AppColors.textPrimary },
  planText: { ...AppType.footnote, color: AppColors.textSecondary },
  submit: { backgroundColor: AppColors.accent },
});

export default withSheetFrame(IssueScreen, AppColors.surface);
