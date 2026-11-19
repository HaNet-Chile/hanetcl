import { ThemedText } from '@/components/themed-text';
import { organizeCenter, scanHref } from '@/components/organize/organize-bar';
import { ArrivalCounter, eventArrivals, useTicketTotals } from '@/components/organize/organize-ui';
import { SettingsGroup, SettingsLinkRow } from '@/components/settings/settings-list';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { HanetButton } from '@/components/ui/hanet-button';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { WideColumns, useWide, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { eventWhen, getEvent, getLoadedEvent } from '@/services/events-service';
import type { HnEvent } from '@/services/events-service';
import { listOrganizedEvents, peekOrganizedEvents } from '@/services/organize-service';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// One event as who organizes it sees it: who has arrived (live while the
// door is open), how its tickets are going and everything to do with it.

const LIVE_EVERY_MS = 15_000;

function findEvent(id: string) {
  return peekOrganizedEvents()?.events.find(event => event.id === id) ?? getLoadedEvent(id);
}

export default function OrganizedEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wide = useWide();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<HnEvent | null | undefined>(() => findEvent(id));
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [focused, setFocused] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setError('');
    listOrganizedEvents()
      .then(async data => {
        const found = data.events.find(item => item.id === id) ?? await getEvent(id);
        if (live) setEvent(found);
      })
      .catch(loadError => {
        if (!live) return;
        setEvent(current => current ?? null);
        setError(describeAuthError(loadError, t('organize.noPudimosCargarElEvento')));
      });
    return () => { live = false; };
  }, [id]);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    setTick(value => value + 1);
    const stop = load();
    return () => { stop(); setFocused(false); };
  }, [load]));

  // The bar's center scans this event while its door is open.
  useEffect(() => {
    if (focused && event?.canCheckIn) organizeCenter.setScan(event.id, event.signupMode === 'tickets');
    else if (focused) organizeCenter.setScan(null, false);
  }, [focused, event]);

  // Arrivals move every few seconds at the door: read them again meanwhile.
  useEffect(() => {
    if (!focused || !event?.canCheckIn) return;
    const timer = setInterval(() => {
      setTick(value => value + 1);
      if (event.signupMode !== 'tickets') load();
    }, LIVE_EVERY_MS);
    return () => clearInterval(timer);
  }, [focused, event?.canCheckIn, event?.signupMode, load]);

  const totals = useTicketTotals(event, tick);

  if (!event) {
    return (
      <FrostedScreen style={styles.screen}>
        <View style={withTopInset([styles.page, styles.center], insets.top)}>
          {event === undefined ? <ActivityIndicator color={AppColors.textSecondary} /> : <MessageCard message={error || t('organize.noEncontramosEseEvento')} onRetry={load} />}
        </View>
      </FrostedScreen>
    );
  }

  const ticketed = event.signupMode === 'tickets';
  const regional = event.kind === 'regional';
  const { arrived, of } = eventArrivals(event, totals);
  const open = (pathname: '/organize/issue' | '/organize/send' | '/organize/tickets' | '/organize/scanners') => router.push({ pathname, params: { id: event.id } });
  const edit = () => router.push({ pathname: '/event-form', params: { kind: event.kind, id: event.id } });
  const chips = [
    event.status === 'draft' && t('organize.borrador'),
    event.private && t('organize.privadoYFormal'),
    regional && t('organize.hanetEventos'),
  ].filter(Boolean) as string[];

  const stats = ticketed && totals ? [
    { label: t('organize.emitidas'), value: totals.cap ? t('organize.issuedDeCap', { issued: totals.issued, cap: totals.cap }) : String(totals.issued) },
    { label: t('organize.porLlegar'), value: String(Math.max(0, totals.issued - totals.used)) },
    { label: t('organize.invitados'), value: String(totals.link) },
    { label: t('organize.regaladas'), value: String(totals.gifted) },
    { label: t('organize.impresas'), value: String(totals.printed) },
    { label: t('organize.anuladas'), value: String(totals.voided) },
  ] : [];

  const summary = (
    <View style={styles.stack}>
      {(ticketed || event.canCheckIn || of > 0 || arrived > 0) && (
        <View style={styles.card}>
          {event.canCheckIn && (
            <View style={styles.liveLine}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveText}>{t('organize.laPuertaEstaAbierta')}</ThemedText>
            </View>
          )}
          <ArrivalCounter arrived={arrived} of={of} size="large" />
          {event.canCheckIn && (
            <HanetButton
              label={ticketed ? t('organize.escanearEntradas') : t('organize.pasarLista')}
              variant="accent"
              icon={<Ionicons name="scan-outline" size={20} color={AppColors.textPrimary} />}
              onPress={() => router.push(scanHref(event.id, ticketed))}
            />
          )}
        </View>
      )}
      {stats.length > 0 && (
        <View style={styles.stats}>
          {stats.map(stat => (
            <View key={stat.label} accessible accessibilityLabel={`${stat.label}: ${stat.value}`} style={styles.stat}>
              <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
              <ThemedText style={styles.statLabel}>{stat.label}</ThemedText>
            </View>
          ))}
        </View>
      )}
      {ticketed && !totals && <ActivityIndicator color={AppColors.textSecondary} />}
    </View>
  );

  const actions = (
    <View style={styles.stack}>
      {ticketed && (
        <SettingsGroup title={t('organize.entradas')}>
          <SettingsLinkRow icon="people-outline" label={t('organize.emitirPorCurso')} detail={t('organize.desdeLaNomina')} onPress={() => open('/organize/issue')} />
          <SettingsLinkRow icon="paper-plane-outline" label={t('organize.enviarUnaEntrada')} onPress={() => open('/organize/send')} />
          <SettingsLinkRow icon="list-outline" label={t('organize.verLaLista')} detail={totals ? String(totals.issued) : undefined} onPress={() => open('/organize/tickets')} />
          <SettingsLinkRow icon="scan-outline" label={t('organize.docentesQueEscanean')} onPress={() => open('/organize/scanners')} />
        </SettingsGroup>
      )}
      <SettingsGroup title={t('organize.evento')}>
        <SettingsLinkRow icon="create-outline" label={t('organize.editarElEvento')} onPress={edit} />
        {event.status !== 'draft' && (
          <SettingsLinkRow icon="eye-outline" label={t('organize.verComoLoVen')} onPress={() => router.push({ pathname: '/event-detail', params: { id: event.id } })} />
        )}
      </SettingsGroup>
      {ticketed && event.tickets.printable && (
        <ThemedText style={styles.note}>{t('organize.laEntradaImpresaSeDescarga')}</ThemedText>
      )}
    </View>
  );

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView contentContainerStyle={withTopInset([styles.page, widePageStyle(wide)], insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow={eventWhen(event)}
          title={event.title}
          intro={event.venueName || undefined}
          above={chips.length > 0 ? (
            <View style={styles.chips}>
              {chips.map(chip => <View key={chip} style={styles.chip}><ThemedText style={styles.chipText}>{chip}</ThemedText></View>)}
            </View>
          ) : undefined}
        />
        {!!error && <MessageCard message={error} onRetry={load} live />}
        {wide ? <WideColumns main={summary} aside={actions} /> : <>{summary}{actions}</>}
      </ScrollView>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.xl },
  center: { flex: 1, justifyContent: 'center' },
  stack: { gap: AppSpacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: AppSpacing.sm },
  chip: { height: 24, justifyContent: 'center', paddingHorizontal: 10, borderRadius: AppRadii.pill, backgroundColor: AppColors.surfaceMuted },
  chipText: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  card: { gap: AppSpacing.lg, padding: 20, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  liveLine: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AppColors.accent },
  liveText: { ...AppType.caption, color: AppColors.textPrimary },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  stat: { flexGrow: 1, flexBasis: '30%', gap: 2, padding: 14, borderRadius: AppRadii.md, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  statValue: { ...AppType.title3, color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { ...AppType.caption, color: AppColors.textSecondary },
  note: { ...AppType.footnote, color: AppColors.textSecondary, paddingHorizontal: AppSpacing.sm },
});
