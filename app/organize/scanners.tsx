import { hallFormStyles as styles } from '@/components/classhall/hall-form';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetSelect } from '@/components/ui/hanet-select';
import { withSheetFrame } from '@/components/ui/sheet-frame';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { listTeachers } from '@/services/organize-service';
import type { EventPerson } from '@/services/organize-service';
import { listEventTickets, setTicketScanner } from '@/services/ticket-admin-service';
import type { TicketScanner } from '@/services/ticket-admin-service';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Docentes who may scan at this event's door without organizing it (up to
// 20). Who organizes always can. They see "Escanear" on their Inicio.

const MAX_SCANNERS = 20;

function ScannersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scanners, setScanners] = useState<TicketScanner[] | null>(null);
  const [teachers, setTeachers] = useState<EventPerson[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let live = true;
    Promise.all([listEventTickets(id), listTeachers()])
      .then(([list, people]) => { if (live) { setScanners(list.scanners ?? []); setTeachers(people); } })
      .catch(err => { if (live) setError(describeAuthError(err, t('organize.noPudimosCargarLosDocentes'))); });
    return () => { live = false; };
  }, [id]);
  useEffect(load, [load]);

  const change = async (person: EventPerson, on: boolean) => {
    if (busy) return;
    setBusy(person.uid);
    setError('');
    try {
      await setTicketScanner(id, person.uid, on);
      setScanners(list => on ? [...(list ?? []), person] : (list ?? []).filter(item => item.uid !== person.uid));
    } catch (err) {
      setError(describeAuthError(err, t('organize.noPudimosCambiarElAcceso')));
    } finally {
      setBusy(null);
    }
  };

  const options = (teachers ?? []).filter(person => !scanners?.some(item => item.uid === person.uid)).map(person => ({ value: person.uid, label: person.name }));

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={[styles.content, { paddingTop: AppSpacing.xxl, paddingBottom: insets.bottom + AppSpacing.xl }]}>
      <ThemedText accessibilityRole="header" style={styles.title}>{t('organize.docentesQueEscanean')}</ThemedText>
      <ThemedText style={styles.lead}>{t('organize.ademasDeQuienOrganizaEstos')}</ThemedText>

      {!scanners && !error && <ActivityIndicator color={AppColors.textSecondary} />}
      {!!scanners && (
        <>
          {scanners.length > 0 && (
            <View style={local.group}>
              {scanners.map((person, index) => (
                <View key={person.uid} style={[local.row, index > 0 && local.rowLine]}>
                  <ThemedText numberOfLines={1} style={local.name}>{person.name}</ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('organize.quitarAName', { name: person.name })}
                    disabled={!!busy}
                    onPress={() => void change(person, false)}
                    style={({ pressed }) => [local.remove, pressed && styles.pressed]}
                  >
                    <ThemedText style={local.removeText}>{busy === person.uid ? '…' : t('common.quitar')}</ThemedText>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {scanners.length < MAX_SCANNERS && (
            <View style={styles.field}>
              <ThemedText style={styles.label}>{t('organize.agregarUnDocente')}</ThemedText>
              {options.length > 0
                ? <HanetSelect label={t('organize.agregarUnDocente')} options={options} value={null} onChange={uid => { const person = teachers?.find(item => item.uid === uid); if (person) void change(person, true); }} disabled={!!busy} />
                : <ThemedText style={styles.hint}>{t('organize.noHayOtrosDocentesEn')}</ThemedText>}
            </View>
          )}
        </>
      )}
      {!!error && (
        <View style={styles.field}>
          <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>
          {!scanners && <HanetButton label={t('calendar.intentarDeNuevo')} variant="surface" onPress={() => { setError(''); load(); }} />}
        </View>
      )}

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
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, paddingHorizontal: AppSpacing.lg },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  name: { flex: 1, ...AppType.callout, color: AppColors.textPrimary },
  remove: { minHeight: 32, justifyContent: 'center', paddingHorizontal: AppSpacing.md, borderRadius: AppRadii.pill, backgroundColor: AppColors.surfaceMuted },
  removeText: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
});

export default withSheetFrame(ScannersScreen, AppColors.surface);
