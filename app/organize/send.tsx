import { hallFormStyles as styles } from '@/components/classhall/hall-form';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChoice, HanetSelect } from '@/components/ui/hanet-select';
import { withSheetFrame } from '@/components/ui/sheet-frame';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { getLoadedEvent } from '@/services/events-service';
import { listCoursePeople, listEventCourses, peekOrganizedEvents } from '@/services/organize-service';
import type { EventCourse, EventPerson } from '@/services/organize-service';
import { issueTickets } from '@/services/ticket-admin-service';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// One ticket at a time: to someone of the institution (it shows up in their
// Entradas) or, if the event allows it, a one-use link for a guest without
// HaNet.

type Mode = 'school' | 'guest';

function SendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = peekOrganizedEvents()?.events.find(item => item.id === id) ?? getLoadedEvent(id);
  const guestsAllowed = event?.tickets?.guestLinks !== false;
  const [mode, setMode] = useState<Mode>('school');
  const [courses, setCourses] = useState<EventCourse[] | null>(null);
  const [course, setCourse] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ course: string; people: EventPerson[] } | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ name: string; url?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    listEventCourses()
      .then(list => { if (live) setCourses(list); })
      .catch(err => { if (live) setError(describeAuthError(err, t('organize.noPudimosCargarLosCursos'))); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!course) return;
    let live = true;
    listCoursePeople(course)
      .then(list => { if (live) setLoaded({ course, people: list }); })
      .catch(err => { if (live) setError(describeAuthError(err, t('organize.noPudimosCargarElCurso'))); });
    return () => { live = false; };
  }, [course]);

  const people = loaded && loaded.course === course ? loaded.people : null;
  const ready = mode === 'school' ? !!person : guestName.trim().length > 0;

  const send = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'school' && person) {
        await issueTickets({ eventId: id, mode: 'single', uid: person, count: 1 });
        setSent({ name: people?.find(item => item.uid === person)?.name ?? '' });
      } else {
        const result = await issueTickets({ eventId: id, mode: 'guest', guestName: guestName.trim() });
        setSent({ name: guestName.trim(), url: result.link?.url });
      }
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(describeAuthError(err, t('organize.noPudimosEnviarLaEntrada')));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };
  const share = (url: string) => {
    const message = t('organize.tuEntradaParaTitle', { title: event?.title ?? '' });
    void Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` }).catch(() => undefined);
  };
  const again = () => {
    setSent(null);
    setPerson(null);
    setGuestName('');
    setCopied(false);
  };

  return (
    <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: AppSpacing.xxl, paddingBottom: insets.bottom + AppSpacing.xl }]}>
      <View>
        <ThemedText accessibilityRole="header" style={styles.title}>{t('organize.enviarUnaEntrada')}</ThemedText>
        {!!event && <ThemedText style={local.event}>{event.title}</ThemedText>}
      </View>

      {sent ? (
        <View style={local.done}>
          <ThemedText accessibilityLiveRegion="polite" style={local.doneTitle}>
            {sent.url ? t('organize.linkListoParaName', { name: sent.name }) : t('organize.entradaEnviadaAName', { name: sent.name })}
          </ThemedText>
          <ThemedText style={local.doneText}>{sent.url ? t('organize.elLinkSirveUnaVez') : t('organize.yaEstaEnSusEntradas')}</ThemedText>
          {!!sent.url && (
            <>
              <ThemedText selectable numberOfLines={2} style={local.url}>{sent.url}</ThemedText>
              <View style={local.row}>
                <HanetButton label={copied ? t('organize.copiado') : t('organize.copiarLink')} variant="surface" onPress={() => void copy(sent.url!)} style={local.half} />
                {Platform.OS !== 'web' && <HanetButton label={t('organize.compartir')} variant="accent" onPress={() => share(sent.url!)} style={local.half} />}
              </View>
            </>
          )}
          <HanetButton label={t('organize.enviarOtra')} variant="surface" onPress={again} />
        </View>
      ) : (
        <>
          {guestsAllowed && (
            <HanetChoice
              label={t('organize.aQuien')}
              options={[{ value: 'school', label: t('organize.alguienDelLiceo') }, { value: 'guest', label: t('organize.unInvitadoConLink') }]}
              value={mode}
              onChange={value => { setMode(value as Mode); setError(''); }}
            />
          )}

          {mode === 'school' ? (
            <>
              <View style={styles.field}>
                <ThemedText style={styles.label}>{t('organize.curso')}</ThemedText>
                {!courses ? <ActivityIndicator color={AppColors.textSecondary} /> : (
                  <HanetSelect label={t('organize.curso')} options={courses.map(item => ({ value: item.id, label: item.id }))} value={course} onChange={value => { setCourse(value); setPerson(null); }} style={local.select} />
                )}
              </View>
              {!!course && (
                <View style={styles.field}>
                  <ThemedText style={styles.label}>{t('organize.persona')}</ThemedText>
                  {!people ? <ActivityIndicator color={AppColors.textSecondary} /> : (
                    <HanetSelect label={t('organize.persona')} options={people.map(item => ({ value: item.uid, label: item.name }))} value={person} onChange={setPerson} style={local.select} />
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('organize.nombreDeLaPersonaInvitada')}</ThemedText>
              <TextInput
                value={guestName}
                onChangeText={setGuestName}
                placeholder={t('organize.comoApareceEnLaEntrada')}
                placeholderTextColor={AppColors.textSecondary}
                maxLength={80}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={() => void send()}
                style={styles.input}
              />
              <ThemedText style={styles.hint}>{t('organize.recibeUnLinkQueSirve')}</ThemedText>
            </View>
          )}

          {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
          <Pressable
            accessibilityRole="button"
            disabled={!ready || busy}
            onPress={() => void send()}
            style={({ pressed }) => [styles.submit, local.submit, (!ready || busy) && styles.submitDisabled, pressed && styles.pressed]}
          >
            <ThemedText style={styles.submitText}>{busy ? t('organize.enviando') : mode === 'guest' ? t('organize.crearElLink') : t('organize.enviarLaEntrada')}</ThemedText>
          </Pressable>
        </>
      )}

      {Platform.OS !== 'ios' && (
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <ThemedText style={styles.cancelText}>{sent ? t('common.cerrar') : t('common.cancelar')}</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  event: { ...AppType.callout, color: AppColors.textSecondary, marginTop: 4 },
  select: { backgroundColor: AppColors.canvas },
  submit: { backgroundColor: AppColors.accent },
  done: { gap: AppSpacing.md, padding: AppSpacing.lg, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.canvas },
  doneTitle: { ...AppType.title3, color: AppColors.textPrimary },
  doneText: { ...AppType.footnote, color: AppColors.textSecondary },
  url: { ...AppType.footnote, color: AppColors.textPrimary, padding: AppSpacing.md, borderRadius: AppRadii.md, backgroundColor: AppColors.surface },
  row: { flexDirection: 'row', gap: AppSpacing.sm },
  half: { flex: 1 },
});

export default withSheetFrame(SendScreen, AppColors.surface);
