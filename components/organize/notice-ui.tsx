import { ThemedText } from '@/components/themed-text';
import { AppColors, AppRadii, AppRowPressed, AppSpacing, AppType } from '@/constants/design-tokens';
import { t } from '@/i18n';
import { describeAuthError } from '@/services/auth-service';
import { notificationAge } from '@/services/notifications-service';
import type { GroupMember, SentNotice } from '@/services/notices-service';
import { listCoursePeople, listEventCourses } from '@/services/organize-service';
import type { EventCourse, EventPerson } from '@/services/organize-service';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

// Organizar's notifications: how one looks on the phone before it goes out,
// a notice already sent, and the picker of students by course (for "Algunos
// estudiantes" and the saved groups).

const APP_ICON = require('@/assets/images/icon.png');

/** The notification as it will show on a phone's lock screen. */
export function NoticePreview({ from, body }: { from: string; body: string }) {
  return (
    <View accessible accessibilityLabel={`${from}. ${body}`} style={styles.preview}>
      <Image source={APP_ICON} style={styles.previewIcon} contentFit="cover" />
      <View style={styles.previewText}>
        <View style={styles.previewTop}>
          <ThemedText numberOfLines={1} style={styles.previewFrom}>{from}</ThemedText>
          <ThemedText style={styles.previewNow}>{t('components.organize.noticeUi.ahora')}</ThemedText>
        </View>
        <ThemedText numberOfLines={4} style={[styles.previewBody, !body && styles.placeholder]}>
          {body || 'Tu mensaje aparece aquí.'}
        </ThemedText>
      </View>
    </View>
  );
}

/** One notice of "Enviadas": what it said, to whom, how many and when. */
export function SentNoticeRow({ notice, now }: { notice: SentNotice; now: number }) {
  const meta = [
    notice.label,
    t('components.organize.noticeUi.countPersonas', { count: notice.reached }),
    notificationAge(notice.at, now),
  ].join(' · ');
  return (
    <View style={styles.sent}>
      <View style={styles.sentIcon}><Ionicons name="notifications-outline" size={20} color={AppColors.textPrimary} /></View>
      <View style={styles.sentText}>
        <ThemedText numberOfLines={3} style={styles.sentBody}>{notice.body}</ThemedText>
        <ThemedText style={styles.sentMeta}>{meta}</ThemedText>
        {!!notice.senderName && (
          <ThemedText style={styles.sentMeta}>
            {t('components.organize.noticeUi.fromEnviadaPorSendername', { from: notice.from, senderName: notice.senderName })}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

type PickerProps = {
  /** The students picked so far, by uid. */
  selected: Record<string, GroupMember>;
  onChange: (next: Record<string, GroupMember>) => void;
  /** Darker rows, for a sheet drawn on `surface`. */
  onSurface?: boolean;
};

/**
 * Students picked one by one: the institution's courses, each opening into
 * its students with a check. A course row says how many of it are picked.
 */
export function StudentPicker({ selected, onChange, onSurface = true }: PickerProps) {
  const [courses, setCourses] = useState<EventCourse[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [people, setPeople] = useState<Record<string, EventPerson[]>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    listEventCourses()
      .then(list => { if (live) setCourses(list); })
      .catch(err => { if (live) setError(describeAuthError(err, t('organize.noPudimosCargarLosCursos'))); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!open || people[open]) return;
    let live = true;
    listCoursePeople(open)
      .then(list => { if (live) setPeople(current => ({ ...current, [open]: list })); })
      .catch(err => { if (live) setError(describeAuthError(err, t('organize.noPudimosCargarElCurso'))); });
    return () => { live = false; };
  }, [open, people]);

  const count = Object.keys(selected).length;
  const inCourse = (courseId: string) => Object.values(selected).filter(member => member.courseId === courseId).length;

  const toggle = (person: EventPerson, courseId: string) => {
    const next = { ...selected };
    if (next[person.uid]) delete next[person.uid];
    else next[person.uid] = { uid: person.uid, name: person.name, courseId };
    onChange(next);
  };

  const toggleCourse = (courseId: string, list: EventPerson[]) => {
    const all = list.every(person => selected[person.uid]);
    const next = { ...selected };
    for (const person of list) {
      if (all) delete next[person.uid];
      else next[person.uid] = { uid: person.uid, name: person.name, courseId };
    }
    onChange(next);
  };

  const base = onSurface ? styles.groupOnSurface : styles.groupOnCanvas;

  return (
    <View style={styles.picker}>
      <View style={styles.pickerHead}>
        <ThemedText accessibilityLiveRegion="polite" style={styles.pickerCount}>
          {count === 0 ? t('components.organize.noticeUi.nadieElegidoTodavia') : t('components.organize.noticeUi.countEstudiantesElegidos', { count })}
        </ThemedText>
        {count > 0 && (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onChange({})} style={({ pressed }) => pressed && styles.dim}>
            <ThemedText style={styles.link}>{t('components.organize.noticeUi.quitarTodos')}</ThemedText>
          </Pressable>
        )}
      </View>
      {!courses && !error && <ActivityIndicator color={AppColors.textSecondary} />}
      {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
      {!!courses && (
        <View style={[styles.group, base]}>
          {courses.map((course, index) => {
            const expanded = open === course.id;
            const picked = inCourse(course.id);
            const list = people[course.id];
            return (
              <View key={course.id} style={index > 0 && styles.line}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={picked ? t('components.organize.noticeUi.idPickedElegidos', { id: course.id, picked }) : course.id}
                  onPress={() => setOpen(expanded ? null : course.id)}
                  style={({ pressed }) => [styles.courseRow, pressed && AppRowPressed]}
                >
                  <ThemedText style={styles.course}>{course.id}</ThemedText>
                  {picked > 0 && <View style={styles.badge}><ThemedText style={styles.badgeText}>{picked}</ThemedText></View>}
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={AppColors.textSecondary} />
                </Pressable>
                {expanded && (
                  <View style={styles.people}>
                    {!list ? <ActivityIndicator color={AppColors.textSecondary} style={styles.loading} /> : (
                      <>
                        {list.length > 0 && (
                          <Pressable accessibilityRole="button" onPress={() => toggleCourse(course.id, list)} style={({ pressed }) => [styles.personRow, pressed && AppRowPressed]}>
                            <ThemedText style={styles.link}>
                              {list.every(person => selected[person.uid]) ? t('components.organize.noticeUi.quitarATodoElCurso') : t('components.organize.noticeUi.elegirATodoElCurso')}
                            </ThemedText>
                          </Pressable>
                        )}
                        {list.map(person => {
                          const on = !!selected[person.uid];
                          return (
                            <Pressable
                              key={person.uid}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: on }}
                              onPress={() => toggle(person, course.id)}
                              style={({ pressed }) => [styles.personRow, pressed && AppRowPressed]}
                            >
                              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? AppColors.accent : AppColors.textSecondary} />
                              <ThemedText numberOfLines={1} style={styles.person}>{person.name}</ThemedText>
                            </Pressable>
                          );
                        })}
                        {list.length === 0 && <ThemedText style={styles.empty}>{t('components.organize.noticeUi.esteCursoNoTieneEstudiantes')}</ThemedText>}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    gap: AppSpacing.md,
    padding: AppSpacing.md,
    borderRadius: AppRadii.lg,
    borderCurve: 'continuous',
    backgroundColor: AppColors.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.hairline,
  },
  previewIcon: { width: 38, height: 38, borderRadius: 9 },
  previewText: { flex: 1, gap: 2 },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  previewFrom: { flex: 1, ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  previewNow: { ...AppType.caption, color: AppColors.textSecondary },
  previewBody: { ...AppType.callout, color: AppColors.textPrimary },
  placeholder: { color: AppColors.textSecondary },
  sent: { flexDirection: 'row', gap: AppSpacing.md, paddingVertical: 14, paddingHorizontal: AppSpacing.lg },
  sentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceMuted,
  },
  sentText: { flex: 1, gap: 4 },
  sentBody: { ...AppType.callout, color: AppColors.textPrimary },
  sentMeta: { ...AppType.footnote, color: AppColors.textSecondary },
  picker: { gap: AppSpacing.sm },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  pickerCount: { ...AppType.footnote, color: AppColors.textSecondary },
  link: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  dim: { opacity: 0.6 },
  error: { ...AppType.footnote, fontFamily: 'DMSans_700Bold', color: AppColors.errorText },
  group: { borderRadius: AppRadii.md, borderCurve: 'continuous', overflow: 'hidden' },
  groupOnSurface: { backgroundColor: AppColors.canvas },
  groupOnCanvas: { backgroundColor: AppColors.surface },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  courseRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, paddingHorizontal: AppSpacing.lg },
  course: { flex: 1, ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  badge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: AppRadii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.accent,
  },
  badgeText: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  people: { paddingBottom: AppSpacing.sm },
  personRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, paddingHorizontal: AppSpacing.lg },
  person: { flex: 1, ...AppType.callout, color: AppColors.textPrimary },
  empty: { ...AppType.footnote, color: AppColors.textSecondary, paddingHorizontal: AppSpacing.lg, paddingVertical: AppSpacing.sm },
  loading: { marginVertical: AppSpacing.md },
});
