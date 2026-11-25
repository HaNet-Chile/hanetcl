import { hallFormStyles as styles } from '@/components/classhall/hall-form';
import { NoticePreview, StudentPicker } from '@/components/organize/notice-ui';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { HanetChoice, HanetSelect } from '@/components/ui/hanet-select';
import { KeyboardScroll } from '@/components/ui/keyboard';
import { withSheetFrame } from '@/components/ui/sheet-frame';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError, useRole } from '@/services/auth-service';
import { eventWhen } from '@/services/events-service';
import { NOTICE_MAX, canPickStudents, countNotice, listNoticeGroups, listNotices, peekNoticeGroups, peekNotices, sendNotice } from '@/services/notices-service';
import type { GroupMember, NoticeAudience, NoticeGroup, NoticeLink } from '@/services/notices-service';
import { listEventCourses, listOrganizedEvents, peekOrganizedEvents } from '@/services/organize-service';
import type { EventCourse } from '@/services/organize-service';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// "Enviar una notificación" (Organizar): a short notice that rings the phones
// of whoever it's for and stays in their Notificaciones. Before it goes out,
// the server counts who it reaches and the sheet asks once more.

type Kind = NoticeAudience['kind'];
type LinkKind = 'none' | 'calendar' | 'event';

function NotifyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const role = useRole();
  const full = canPickStudents(role);
  // `group` opens it with a saved group chosen (from Grupos de estudiantes).
  const params = useLocalSearchParams<{ group?: string }>();

  const [kind, setKind] = useState<Kind>(params.group ? 'group' : 'all');
  const [jornada, setJornada] = useState<'manana' | 'tarde'>('manana');
  const [staff, setStaff] = useState(false);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [groupId, setGroupId] = useState<string | null>(params.group ?? null);
  const [students, setStudents] = useState<Record<string, GroupMember>>({});
  const [body, setBody] = useState('');
  const [linkKind, setLinkKind] = useState<LinkKind>('none');
  const [eventId, setEventId] = useState<string | null>(null);

  const [courses, setCourses] = useState<EventCourse[] | null>(null);
  const [groups, setGroups] = useState<NoticeGroup[] | undefined>(() => peekNoticeGroups());
  const [from, setFrom] = useState(() => peekNotices()?.from ?? '');
  const [events, setEvents] = useState(() => peekOrganizedEvents()?.events);

  const [openedAt] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    listEventCourses().then(list => { if (live) setCourses(list); }).catch(() => undefined);
    listNotices().then(data => { if (live) setFrom(data.from); }).catch(() => undefined);
    listOrganizedEvents().then(data => { if (live) setEvents(data.events); }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  // Coming back from Grupos de estudiantes, the list may have changed.
  useFocusEffect(useCallback(() => {
    if (!full) return;
    let live = true;
    listNoticeGroups().then(list => { if (live) setGroups(list); }).catch(() => undefined);
    return () => { live = false; };
  }, [full]));

  const kinds = useMemo(() => {
    const list: { value: Kind; label: string }[] = [
      { value: 'all', label: t('services.feedService.todoElLiceo') },
      { value: 'jornada', label: t('organize.notify.unaJornada') },
      { value: 'courses', label: t('anniversary.setup.cursos') },
      { value: 'leads', label: t('organize.presidentesDeCurso') },
      { value: 'directivas', label: t('organize.notify.directivasDeCurso') },
    ];
    if (full) list.push({ value: 'group', label: t('organize.notify.unGrupo') }, { value: 'students', label: t('organize.notify.algunosEstudiantes') });
    return list;
  }, [full]);

  const linkEvents = (events ?? []).filter(event => event.kind === 'institution' && event.status === 'published' && (event.endsAt || event.startsAt) > openedAt - 864e5);

  const audience: NoticeAudience | null = (() => {
    if (kind === 'all') return { kind, staff: full && staff };
    if (kind === 'jornada') return { kind, jornada, staff: full && staff };
    if (kind === 'courses') return courseIds.length ? { kind, courseIds } : null;
    if (kind === 'group') return groupId ? { kind, groupId } : null;
    if (kind === 'students') {
      const uids = Object.keys(students);
      return uids.length ? { kind, uids } : null;
    }
    return { kind };
  })();
  const link: NoticeLink = linkKind === 'calendar' ? 'calendar' : linkKind === 'event' && eventId ? { eventId } : null;
  const ready = !!audience && body.trim().length > 0 && (linkKind !== 'event' || !!eventId);

  const review = async () => {
    if (!ready || !audience || busy) return;
    setBusy(true);
    setError('');
    try {
      const reached = await countNotice({ audience, body: body.trim(), link });
      if (reached === 0) setError(t('organize.notify.noHayNadieAQuien'));
      else setConfirm(reached);
    } catch (err) {
      setError(describeAuthError(err, t('organize.notify.noPudimosRevisarAQuien')));
    } finally {
      setBusy(false);
    }
  };

  const go = async () => {
    if (!audience || busy) return;
    setBusy(true);
    setError('');
    try {
      const reached = await sendNotice({ audience, body: body.trim(), link });
      setConfirm(null);
      setSent(reached);
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setConfirm(null);
      setError(describeAuthError(err, t('organize.notify.noPudimosEnviarLaNotificacion')));
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setSent(null);
    setBody('');
  };

  const toggleCourse = (id: string) => setCourseIds(list => (list.includes(id) ? list.filter(item => item !== id) : [...list, id]));

  return (
    <KeyboardScroll style={styles.sheet} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: AppSpacing.xxl, paddingBottom: insets.bottom + AppSpacing.xl }]}>
      <View>
        <ThemedText accessibilityRole="header" style={styles.title}>{t('common.enviarUnaNotificacion')}</ThemedText>
        <ThemedText style={local.lead}>
          {t('organize.notify.lesSuenaEnElTelefono')}
        </ThemedText>
      </View>

      {sent !== null ? (
        <View style={local.done}>
          <ThemedText accessibilityLiveRegion="polite" style={local.doneTitle}>
            {t('organize.notify.leLlegoACountPersonas', { count: sent })}
          </ThemedText>
          <ThemedText style={local.doneText}>
            {t('organize.notify.quedaEnEnviadasEnOrganizar')}
          </ThemedText>
          <HanetButton label={t('organize.enviarOtra')} variant="surface" onPress={again} />
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('organize.aQuien')}</ThemedText>
            <View accessibilityRole="radiogroup" style={local.chips}>
              {kinds.map(item => (
                <HanetChip key={item.value} label={item.label} selected={kind === item.value} accessibilityRole="radio" onPress={() => { setKind(item.value); setError(''); }} />
              ))}
            </View>
            {!full && <ThemedText style={styles.hint}>{t('organize.notify.elCeeEnviaAGrupos')}</ThemedText>}
          </View>

          {kind === 'jornada' && (
            <HanetChoice
              label={t('eventForm.jornada')}
              options={[{ value: 'manana', label: t('common.manana') }, { value: 'tarde', label: t('eventForm.tarde') }]}
              value={jornada}
              onChange={value => setJornada(value as 'manana' | 'tarde')}
            />
          )}

          {(kind === 'all' || kind === 'jornada') && full && (
            <View style={styles.field}>
              <HanetChip
                label={t('organize.notify.tambienADocentesYAdministracion')}
                selected={staff}
                accessibilityRole="checkbox"
                onPress={() => setStaff(on => !on)}
                style={local.alone}
              />
              <ThemedText style={styles.hint}>
                {kind === 'jornada' ? t('organize.notify.leLlegaAQuienEligio') : t('organize.notify.sinEstoLeLlegaSolo')}
              </ThemedText>
            </View>
          )}
          {kind === 'jornada' && !full && <ThemedText style={styles.hint}>{t('organize.notify.leLlegaAQuienEligio')}</ThemedText>}

          {kind === 'courses' && (
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('anniversary.setup.cursos')}{' '}<ThemedText style={styles.optional}>{courseIds.length ? `· ${courseIds.length}` : ''}</ThemedText></ThemedText>
              {!courses ? <ActivityIndicator color={AppColors.textSecondary} /> : (
                <View style={local.chips}>
                  {courses.map(course => (
                    <HanetChip key={course.id} label={course.id} compact selected={courseIds.includes(course.id)} accessibilityRole="checkbox" onPress={() => toggleCourse(course.id)} />
                  ))}
                </View>
              )}
            </View>
          )}

          {kind === 'leads' && <ThemedText style={styles.hint}>{t('organize.notify.leLlegaAQuienTiene')}</ThemedText>}
          {kind === 'directivas' && <ThemedText style={styles.hint}>{t('organize.notify.leLlegaAQuienesTienen')}</ThemedText>}

          {kind === 'group' && (
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('organize.notify.grupo')}</ThemedText>
              {groups === undefined ? <ActivityIndicator color={AppColors.textSecondary} /> : groups.length > 0 ? (
                <HanetSelect
                  label={t('organize.notify.grupo')}
                  options={groups.map(group => ({ value: group.id, label: `${group.name} · ${group.members.length}` }))}
                  value={groupId}
                  onChange={setGroupId}
                  style={local.select}
                />
              ) : (
                <ThemedText style={styles.hint}>{t('organize.notify.todaviaNoHayGruposGuardados')}</ThemedText>
              )}
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push({ pathname: '/organize/groups', params: { from: 'notify' } })} style={({ pressed }) => [local.linkRow, pressed && styles.pressed]}>
                <ThemedText style={local.link}>{groups?.length ? t('organize.notify.administrarGrupos') : t('organize.notify.armarUnGrupo')}</ThemedText>
              </Pressable>
            </View>
          )}

          {kind === 'students' && <StudentPicker selected={students} onChange={setStudents} />}

          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('feedPost.mensaje')}</ThemedText>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t('organize.notify.porEjemploMananaLaEntrada')}
              placeholderTextColor={AppColors.textSecondary}
              maxLength={NOTICE_MAX}
              multiline
              style={[styles.input, local.message]}
            />
            <ThemedText style={[styles.hint, local.counter]}>{`${body.length}/${NOTICE_MAX}`}</ThemedText>
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('organize.notify.alTocarlaAbre')}</ThemedText>
            <HanetChoice
              label={t('organize.notify.alTocarlaAbre')}
              options={[{ value: 'none', label: t('organize.notify.nada') }, { value: 'calendar', label: 'Calendar' }, ...(linkEvents.length ? [{ value: 'event', label: t('organize.notify.unEvento') }] : [])]}
              value={linkKind}
              onChange={value => setLinkKind(value as LinkKind)}
            />
            {linkKind === 'event' && (
              <HanetSelect
                label={t('services.calendarWidget.evento')}
                options={linkEvents.map(event => ({ value: event.id, label: `${event.title} · ${eventWhen(event)}` }))}
                value={eventId}
                onChange={setEventId}
                style={local.select}
              />
            )}
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('organize.notify.asiSeVera')}</ThemedText>
            <NoticePreview from={from || 'Tu liceo'} body={body.trim()} />
          </View>

          {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
          <Pressable
            accessibilityRole="button"
            disabled={!ready || busy}
            onPress={() => void review()}
            style={({ pressed }) => [styles.submit, local.submit, (!ready || busy) && styles.submitDisabled, pressed && styles.pressed]}
          >
            <ThemedText style={styles.submitText}>{busy && confirm === null ? t('tickets.scan.revisando') : t('components.tools.verbGames.enviar')}</ThemedText>
          </Pressable>
        </>
      )}

      {Platform.OS !== 'ios' && (
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <ThemedText style={styles.cancelText}>{sent !== null ? t('common.cerrar') : t('common.cancelar')}</ThemedText>
        </Pressable>
      )}

      <HanetDialog
        visible={confirm !== null}
        onRequestClose={() => { if (!busy) setConfirm(null); }}
        title={t('organize.notify.enviarACountPersonas', { count: confirm ?? 0 })}
        body={t('organize.notify.lesVaASonarEn')}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" onPress={() => setConfirm(null)} disabled={busy} style={dialogStyles.action} />
          <HanetButton label={busy ? t('common.enviando') : t('components.tools.verbGames.enviar')} variant="accent" onPress={() => void go()} disabled={busy} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>
    </KeyboardScroll>
  );
}

const local = StyleSheet.create({
  lead: { ...AppType.callout, color: AppColors.textSecondary, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  alone: { alignSelf: 'flex-start' },
  select: { backgroundColor: AppColors.canvas },
  message: { minHeight: 110, paddingTop: AppSpacing.lg, paddingBottom: AppSpacing.lg, lineHeight: 22, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end' },
  linkRow: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  link: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  submit: { backgroundColor: AppColors.accent },
  done: { gap: AppSpacing.md, padding: AppSpacing.lg, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.canvas },
  doneTitle: { ...AppType.title3, color: AppColors.textPrimary },
  doneText: { ...AppType.footnote, color: AppColors.textSecondary },
});

export default withSheetFrame(NotifyScreen, AppColors.surface);
