import { ThemedText } from '@/components/themed-text';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { HanetDialog } from '@/components/ui/hanet-dialog';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { useWide, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppRadii, AppRowPressed, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { getLoadedEvent } from '@/services/events-service';
import { peekOrganizedEvents } from '@/services/organize-service';
import { listEventTickets, resendTicketLink, ticketHolder, voidTicket } from '@/services/ticket-admin-service';
import type { EventTicketList, TicketRow, TicketStatus } from '@/services/ticket-admin-service';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Every ticket of an event: who has it, whether they arrived, and what to do
// with one (send the link again, void it and send another, or void it).

type Filter = 'all' | 'waiting' | 'arrived' | 'guests' | 'voided';

const WAITING: TicketStatus[] = ['active', 'link', 'shared', 'printed'];

function statusLabel(status: TicketStatus) {
  switch (status) {
    case 'used': return t('organize.llego');
    case 'link': return t('organize.linkSinAbrir');
    case 'shared': return t('organize.compartida');
    case 'printed': return t('organize.impresa');
    case 'voided': return t('organize.anulada');
    default: return t('organize.porLlegar');
  }
}

export default function EventTicketsScreen() {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = peekOrganizedEvents()?.events.find(item => item.id === id) ?? getLoadedEvent(id);
  const [list, setList] = useState<EventTicketList | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<TicketRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);

  const load = useCallback(() => {
    let live = true;
    setError('');
    listEventTickets(id)
      .then(data => { if (live) setList(data); })
      .catch(err => {
        if (!live) return;
        setList(current => current ?? null);
        setError(describeAuthError(err, t('organize.noPudimosCargarLaLista')));
      });
    return () => { live = false; };
  }, [id]);
  useFocusEffect(load);

  const needle = query.trim().toLocaleLowerCase('es');
  const rows = (list?.rows ?? []).filter(row => {
    if (filter === 'waiting' && !WAITING.includes(row.status)) return false;
    if (filter === 'arrived' && row.status !== 'used') return false;
    if (filter === 'guests' && !row.guestName) return false;
    if (filter === 'voided' ? row.status !== 'voided' : filter === 'all' ? false : row.status === 'voided') return false;
    if (!needle) return true;
    return [ticketHolder(row), row.courseId, row.giftedToName, String(row.number)].some(value => value?.toLocaleLowerCase('es').includes(needle));
  });

  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: t('organize.todas') },
    { value: 'waiting', label: t('organize.porLlegar') },
    { value: 'arrived', label: t('organize.llegaron') },
    { value: 'guests', label: t('organize.invitados') },
    { value: 'voided', label: t('organize.anuladas') },
  ];

  const act = async (action: 'resend' | 'replace' | 'void') => {
    if (!picked || busy) return;
    setBusy(true);
    setActionError('');
    try {
      const name = ticketHolder(picked);
      if (action === 'resend') {
        setLink({ name, url: await resendTicketLink(id, picked.ticketId) });
      } else {
        const result = await voidTicket(id, picked.ticketId, action === 'replace');
        if (result.replacement?.url) setLink({ name, url: result.replacement.url });
      }
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPicked(null);
      load();
    } catch (err) {
      setActionError(describeAuthError(err, t('organize.noPudimosCambiarLaEntrada')));
    } finally {
      setBusy(false);
    }
  };

  const share = (url: string) => {
    const message = t('organize.tuEntradaParaTitle', { title: event?.title ?? '' });
    void Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` }).catch(() => undefined);
  };

  const canAct = picked && picked.status !== 'voided' && picked.status !== 'used';

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={withTopInset([styles.page, widePageStyle(wide, 'reading')], insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow={event?.title} title={t('organize.entradas')} intro={list ? t('organize.issuedEmitidasUsedLlegaron', { issued: list.totals.issued, used: list.totals.used }) : undefined} />
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={AppColors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('organize.buscarPorNombreCursoO')}
            placeholderTextColor={AppColors.textSecondary}
            style={styles.searchInput}
            accessibilityLabel={t('organize.buscarEnLaLista')}
            returnKeyType="search"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map(option => <HanetChip key={option.value} label={option.label} compact selected={filter === option.value} onPress={() => setFilter(option.value)} />)}
        </ScrollView>
        {list === undefined && <ActivityIndicator color={AppColors.textSecondary} style={styles.loading} />}
        {!!error && <MessageCard message={error} onRetry={load} live />}
        {rows.length > 0 && (
          <View style={styles.group}>
            {rows.map((row, index) => (
              <Pressable
                key={row.ticketId}
                accessibilityRole="button"
                accessibilityLabel={[`N° ${row.number}`, ticketHolder(row), row.courseId, statusLabel(row.status)].filter(Boolean).join(', ')}
                onPress={() => { setActionError(''); setPicked(row); }}
                style={({ pressed }) => [styles.row, index > 0 && styles.rowLine, pressed && AppRowPressed]}
              >
                <ThemedText style={styles.number}>{row.number}</ThemedText>
                <View style={styles.rowText}>
                  <ThemedText numberOfLines={1} style={[styles.name, row.status === 'voided' && styles.voided]}>{ticketHolder(row) || t('organize.sinNombre')}</ThemedText>
                  <ThemedText numberOfLines={1} style={styles.meta}>
                    {[row.guestName ? t('organize.invitado') : row.courseId, row.giftedToName && t('organize.regaladaAName', { name: row.giftedToName })].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                <View style={[styles.status, row.status === 'used' && styles.statusOn]}>
                  <ThemedText style={styles.statusText}>{statusLabel(row.status)}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {!!list && rows.length === 0 && <ThemedText style={styles.empty}>{list.rows.length ? t('organize.ningunaEntradaCoincide') : t('organize.todaviaNoHayEntradas')}</ThemedText>}
      </ScrollView>

      <HanetDialog
        visible={!!picked}
        onRequestClose={() => { if (!busy) setPicked(null); }}
        dismissOnBackdrop={!busy}
        title={picked ? `N° ${picked.number} · ${ticketHolder(picked) || t('organize.sinNombre')}` : undefined}
        body={picked ? (canAct ? statusLabel(picked.status) : picked.status === 'used' ? t('organize.estaEntradaYaSeUso') : t('organize.estaEntradaEstaAnulada')) : undefined}
      >
        <View style={styles.actions}>
          {picked?.status === 'link' && <HanetButton label={t('organize.reenviarLink')} variant="surface" onPress={() => void act('resend')} disabled={busy} />}
          {canAct && <HanetButton label={t('organize.anularYEnviarOtra')} variant="surface" onPress={() => void act('replace')} disabled={busy} />}
          {canAct && <HanetButton label={t('organize.anular')} variant="accent" onPress={() => void act('void')} disabled={busy} />}
          {!!actionError && <ThemedText accessibilityLiveRegion="assertive" style={styles.actionError}>{actionError}</ThemedText>}
          <HanetButton label={t('common.cerrar')} variant="surface" onPress={() => setPicked(null)} disabled={busy} />
        </View>
      </HanetDialog>

      <HanetDialog
        visible={!!link}
        onRequestClose={() => setLink(null)}
        dismissOnBackdrop
        title={t('organize.linkNuevoParaName', { name: link?.name ?? '' })}
        body={t('organize.elAnteriorYaNoSirve')}
      >
        <View style={styles.actions}>
          <ThemedText selectable numberOfLines={2} style={styles.url}>{link?.url}</ThemedText>
          <HanetButton label={t('organize.copiarLink')} variant="surface" onPress={() => { if (link) void Clipboard.setStringAsync(link.url); }} />
          {Platform.OS !== 'web' && <HanetButton label={t('organize.compartir')} variant="accent" onPress={() => { if (link) share(link.url); }} />}
          <HanetButton label={t('common.cerrar')} variant="surface" onPress={() => setLink(null)} />
        </View>
      </HanetDialog>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.lg },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm, paddingHorizontal: AppSpacing.lg, borderRadius: AppRadii.pill, backgroundColor: AppColors.surface },
  searchInput: { flex: 1, minHeight: 48, ...AppType.body, color: AppColors.textPrimary, outlineStyle: 'none' as never },
  filters: { gap: AppSpacing.sm },
  loading: { marginVertical: AppSpacing.lg },
  group: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, overflow: 'hidden' },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, paddingHorizontal: AppSpacing.lg, paddingVertical: AppSpacing.sm },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  number: { ...AppType.caption, minWidth: 30, color: AppColors.textSecondary, fontVariant: ['tabular-nums'] },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...AppType.callout, fontFamily: 'DMSans_600SemiBold', color: AppColors.textPrimary },
  voided: { textDecorationLine: 'line-through', color: AppColors.textSecondary },
  meta: { ...AppType.caption, color: AppColors.textSecondary },
  status: { height: 24, justifyContent: 'center', paddingHorizontal: 10, borderRadius: AppRadii.pill, backgroundColor: AppColors.surfaceMuted },
  statusOn: { backgroundColor: AppColors.accent },
  statusText: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  empty: { ...AppType.footnote, color: AppColors.textSecondary, textAlign: 'center', paddingVertical: AppSpacing.xl },
  actions: { gap: AppSpacing.sm, marginTop: AppSpacing.md },
  actionError: { ...AppType.footnote, fontFamily: 'DMSans_700Bold', color: AppColors.errorText },
  url: { ...AppType.footnote, color: AppColors.textPrimary, padding: AppSpacing.md, borderRadius: AppRadii.md, backgroundColor: AppColors.canvas },
});
