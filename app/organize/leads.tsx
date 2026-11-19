import { hallFormStyles as styles } from '@/components/classhall/hall-form';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetSelect } from '@/components/ui/hanet-select';
import { withSheetFrame } from '@/components/ui/sheet-frame';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { listCourseLeads, listCoursePeople, listEventCourses, setCourseLead } from '@/services/organize-service';
import type { CourseLead, EventCourse, EventPerson } from '@/services/organize-service';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Presidentes de curso: one per course, a cargo on top of the role. They
// receive the course's tickets when they're issued "to the Presidente".

function LeadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [courses, setCourses] = useState<EventCourse[] | null>(null);
  const [leads, setLeads] = useState<CourseLead[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ course: string; people: EventPerson[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let live = true;
    Promise.all([listEventCourses(), listCourseLeads()])
      .then(([list, current]) => { if (live) { setCourses(list); setLeads(current); } })
      .catch(err => { if (live) setError(describeAuthError(err, t('organize.noPudimosCargarLosCursos'))); });
    return () => { live = false; };
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!editing) return;
    let live = true;
    listCoursePeople(editing)
      .then(list => { if (live) setLoaded({ course: editing, people: list }); })
      .catch(err => { if (live) setError(describeAuthError(err, t('organize.noPudimosCargarElCurso'))); });
    return () => { live = false; };
  }, [editing]);

  const people = loaded && loaded.course === editing ? loaded.people : null;

  const choose = async (courseId: string, uid: string | null) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const current = leads.find(lead => lead.courseId === courseId);
      if (uid) await setCourseLead(uid, true);
      else if (current) await setCourseLead(current.uid, false);
      const name = people?.find(person => person.uid === uid)?.name ?? '';
      setLeads(list => [...list.filter(lead => lead.courseId !== courseId), ...(uid ? [{ courseId, uid, name }] : [])]);
      setEditing(null);
    } catch (err) {
      setError(describeAuthError(err, t('organize.noPudimosGuardarElCambio')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={[styles.content, { paddingTop: AppSpacing.xxl, paddingBottom: insets.bottom + AppSpacing.xl }]}>
      <ThemedText accessibilityRole="header" style={styles.title}>{t('organize.presidentesDeCurso')}</ThemedText>
      <ThemedText style={styles.lead}>{t('organize.unoPorCursoRecibeLas')}</ThemedText>

      {!courses && !error && <ActivityIndicator color={AppColors.textSecondary} />}
      {!!courses && (
        <View style={local.group}>
          {courses.map((course, index) => {
            const lead = leads.find(item => item.courseId === course.id);
            const open = editing === course.id;
            return (
              <View key={course.id} style={[local.item, index > 0 && local.itemLine]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${course.id}: ${lead?.name || t('organize.sinPresidente')}`}
                  accessibilityState={{ expanded: open }}
                  onPress={() => setEditing(open ? null : course.id)}
                  style={({ pressed }) => [local.row, pressed && AppPressed]}
                >
                  <ThemedText style={local.course}>{course.id}</ThemedText>
                  <ThemedText numberOfLines={1} style={[local.lead, !lead && local.none]}>{lead?.name || t('organize.sinPresidente')}</ThemedText>
                </Pressable>
                {open && (
                  <View style={local.edit}>
                    {!people ? <ActivityIndicator color={AppColors.textSecondary} /> : (
                      <HanetSelect
                        label={t('organize.presidenteDeCourse', { course: course.id })}
                        options={people.map(person => ({ value: person.uid, label: person.name }))}
                        value={lead?.uid ?? null}
                        onChange={uid => void choose(course.id, uid)}
                        disabled={busy}
                      />
                    )}
                    {!!lead && <HanetButton label={t('organize.quitarElCargo')} variant="surface" onPress={() => void choose(course.id, null)} disabled={busy} />}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}

      {Platform.OS !== 'ios' && (
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <ThemedText style={styles.cancelText}>{t('common.cerrar')}</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  group: { borderRadius: AppRadii.md, borderCurve: 'continuous', backgroundColor: AppColors.canvas, overflow: 'hidden' },
  item: {},
  itemLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, paddingHorizontal: AppSpacing.lg },
  course: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  lead: { flex: 1, ...AppType.callout, textAlign: 'right', color: AppColors.textPrimary },
  none: { color: AppColors.textSecondary },
  edit: { gap: AppSpacing.sm, paddingHorizontal: AppSpacing.lg, paddingBottom: AppSpacing.lg },
});

export default withSheetFrame(LeadsScreen, AppColors.surface);
