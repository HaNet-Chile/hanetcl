import { ThemedText } from '@/components/themed-text';
import { organizeCenter } from '@/components/organize/organize-bar';
import { OrganizedEventRow, TodayEventCard } from '@/components/organize/organize-ui';
import { SettingsGroup, SettingsLinkRow } from '@/components/settings/settings-list';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { HanetButton } from '@/components/ui/hanet-button';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { WideColumns, useWide, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { useAnniversaryState } from '@/services/anniversary-service';
import { describeAuthError, useRole } from '@/services/auth-service';
import { DAY_CHANGE_ROLES, WEB_PANEL_URL, eventsToday, listOrganizedEvents, openWebPanel, peekOrganizedEvents } from '@/services/organize-service';
import type { OrganizedEvents } from '@/services/organize-service';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Organizar: what Admin, CEE and HNT run from the phone, in one place. The
// event whose door is open comes first; then publishing, the events and
// their tickets, the school day and the Aniversario. Bulk work (exports,
// rosters) stays for the web panel.

const UPCOMING = 4;

export default function OrganizeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const role = useRole();
  const wide = useWide();
  const anniversary = useAnniversaryState();
  const [list, setList] = useState<OrganizedEvents | null | undefined>(() => peekOrganizedEvents());
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let live = true;
    setError('');
    listOrganizedEvents()
      .then(data => {
        if (!live) return;
        setList(data);
        const today = eventsToday(data)[0];
        organizeCenter.setScan(today?.id ?? null, today?.signupMode === 'tickets');
      })
      .catch(loadError => {
        if (!live) return;
        setList(current => current ?? null);
        setError(describeAuthError(loadError, t('organize.noPudimosCargarTusEventos')));
      });
    return () => { live = false; };
  }, []);

  // Read again each time it comes back into view (after creating or editing an event).
  useFocusEffect(useCallback(() => {
    const kept = peekOrganizedEvents();
    const today = eventsToday(kept)[0];
    organizeCenter.setScan(today?.id ?? null, today?.signupMode === 'tickets');
    const stop = load();
    return () => {
      stop();
      organizeCenter.closeMenu();
    };
  }, [load]));

  const today = eventsToday(list);
  const upcoming = (list?.events ?? []).filter(event => !event.canCheckIn).slice(0, UPCOMING);
  const canDayChange = !!role && DAY_CHANGE_ROLES.includes(role);
  const space = role === 'CEE' ? t('organize.enElEspacioDelCee') : role === 'HNT' ? t('organize.enElEspacioQueElijas') : t('organize.enComunidadDeTuInstitucion');
  const openEvent = (id: string) => router.push({ pathname: '/organize/event', params: { id } });

  const todaySection = today.length > 0 && (
    <View style={styles.section}>
      <ThemedText accessibilityRole="header" style={styles.sectionTitle}>{t('organize.hoy')}</ThemedText>
      {today.map(event => (
        <View key={event.id} style={styles.todayBlock}>
          <TodayEventCard event={event} />
          {event.signupMode === 'tickets' && (
            <View style={styles.todayActions}>
              <HanetButton label={t('organize.enviarUnaEntrada')} variant="surface" onPress={() => router.push({ pathname: '/organize/send', params: { id: event.id } })} style={styles.half} />
              <HanetButton label={t('organize.verLaLista')} variant="surface" onPress={() => router.push({ pathname: '/organize/tickets', params: { id: event.id } })} style={styles.half} />
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const eventsSection = (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText accessibilityRole="header" style={styles.sectionTitle}>{t('organize.eventosYEntradas')}</ThemedText>
        {!!list?.events.length && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/organize/events')} hitSlop={8} style={styles.seeAll}>
            <ThemedText style={styles.seeAllText}>{t('organize.verTodos')}</ThemedText>
          </Pressable>
        )}
      </View>
      {list === undefined && <ActivityIndicator color={AppColors.textSecondary} style={styles.loading} />}
      {!!error && <MessageCard message={error} onRetry={load} live />}
      <View style={styles.group}>
        {upcoming.map((event, index) => (
          <View key={event.id}>
            {index > 0 && <View style={styles.divider} />}
            <OrganizedEventRow event={event} onPress={() => openEvent(event.id)} />
          </View>
        ))}
        {upcoming.length > 0 && <View style={styles.divider} />}
        <SettingsLinkRow icon="add-circle-outline" label={t('organize.crearUnEvento')} onPress={() => router.push('/organize/new')} />
      </View>
      {list && !list.events.length && <ThemedText style={styles.note}>{t('organize.todaviaNoHayEventosQue')}</ThemedText>}
    </View>
  );

  const publishSection = (
    <SettingsGroup title={t('organize.publicar')}>
      <SettingsLinkRow icon="megaphone-outline" label={t('organize.publicarUnAviso')} detail={space} onPress={() => router.push('/feed-post')} />
      <SettingsLinkRow icon="stats-chart-outline" label={t('organize.crearUnaVotacion')} detail={t('organize.siempreAnonima')} onPress={() => router.push({ pathname: '/feed-post', params: { poll: '1' } })} />
    </SettingsGroup>
  );

  const extras = (
    <>
      <SettingsGroup title={t('organize.cursosYClases')}>
        <SettingsLinkRow icon="ribbon-outline" label={t('organize.presidentesDeCurso')} detail={t('organize.recibenLasEntradasDelCurso')} onPress={() => router.push('/organize/leads')} />
        {canDayChange && <SettingsLinkRow icon="ban-outline" label={t('organize.suspenderClasesOSalida')} onPress={() => router.push('/day-change')} />}
      </SettingsGroup>
      {!!anniversary?.anniversary && anniversary.canOrganize && (
        <SettingsGroup title={t('organize.aniversario')}>
          <SettingsLinkRow icon="trophy-outline" label={anniversary.anniversary.title || t('organize.aniversario')} onPress={() => router.push('/anniversary')} />
        </SettingsGroup>
      )}
      {!!WEB_PANEL_URL && (
        <View style={styles.panel}>
          <ThemedText style={styles.note}>{t('organize.exportarListasYLasCargas')}</ThemedText>
          <HanetButton label={t('organize.abrirElPanelWeb')} variant="surface" onPress={openWebPanel} style={styles.panelButton} />
        </View>
      )}
    </>
  );

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView contentContainerStyle={withTopInset([styles.page, widePageStyle(wide)], insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow={role ?? undefined} title={t('organize.organizar')} intro={t('organize.eventosEntradasAvisosYVotaciones')} />
        {wide ? (
          <WideColumns
            main={<View style={styles.stack}>{todaySection}{eventsSection}</View>}
            aside={<View style={styles.stack}>{publishSection}{extras}</View>}
          />
        ) : (
          <>
            {todaySection}
            {publishSection}
            {eventsSection}
            {extras}
          </>
        )}
      </ScrollView>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.xl },
  stack: { gap: AppSpacing.xl },
  section: { gap: AppSpacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...AppType.footnote, fontFamily: 'DMSans_700Bold', color: AppColors.textSecondary, paddingHorizontal: AppSpacing.sm },
  seeAll: { minHeight: 32, justifyContent: 'center', paddingHorizontal: AppSpacing.sm },
  seeAllText: { ...AppType.callout, color: AppColors.textSecondary },
  todayBlock: { gap: AppSpacing.sm },
  todayActions: { flexDirection: 'row', gap: AppSpacing.sm },
  half: { flex: 1 },
  loading: { marginVertical: AppSpacing.lg },
  group: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 78, backgroundColor: AppColors.separator },
  note: { ...AppType.footnote, color: AppColors.textSecondary, paddingHorizontal: AppSpacing.sm },
  panel: { gap: AppSpacing.md, padding: 18, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  panelButton: { alignSelf: 'flex-start' },
});
