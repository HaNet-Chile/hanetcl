import { ThemedText } from '@/components/themed-text';
import { TicketPile, upcomingTickets } from '@/components/tickets/profile-tickets';
import { TicketView } from '@/components/tickets/ticket';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { useWide, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { useMyTickets } from '@/hooks/use-my-tickets';
import { unseenTickets } from '@/services/tickets-service';
import type { Ticket } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Entradas: the account's tickets. The ones still ahead first, one pile per
// event; the used ones and those of past events wait closed in "Usadas"
// (a folder of glass, from muxp's Flight Log reference).

function byEvent(tickets: Ticket[]) {
  const groups = new Map<string, Ticket[]>();
  for (const ticket of tickets) groups.set(ticket.eventId, [...(groups.get(ticket.eventId) ?? []), ticket]);
  return [...groups.values()];
}

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wide = useWide();
  const reducedMotion = useReducedMotion();
  const { tickets, failed, reload } = useMyTickets();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);

  const upcoming = upcomingTickets(tickets ?? []);
  const upcomingIds = new Set(upcoming.map(ticket => ticket.id));
  const done = (tickets ?? [])
    .filter(ticket => !upcomingIds.has(ticket.id) && ticket.status !== 'voided')
    .sort((a, b) => (b.event.startsAt ?? 0) - (a.event.startsAt ?? 0));
  // New tickets arrive with their own moment, once per phone.
  const arrivalShown = useRef(false);
  useEffect(() => {
    if (!tickets?.length || arrivalShown.current) return;
    let active = true;
    void unseenTickets(upcomingTickets(tickets)).then(fresh => {
      if (!active || !fresh.length || arrivalShown.current) return;
      arrivalShown.current = true;
      router.push({ pathname: '/tickets/arrival', params: { ids: fresh.map(ticket => ticket.id).join(',') } });
    });
    return () => { active = false; };
  }, [router, tickets]);

  const open = (ticket: Ticket) => router.push({ pathname: '/tickets/detail', params: { id: ticket.id } });

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView contentContainerStyle={withTopInset([styles.page, widePageStyle(wide)], insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow={t('layout.perfil')} title={t('common.entradas')} intro={t('tickets.tusEntradasAEventosDe')} />

        {tickets === undefined && !failed && <ActivityIndicator color={AppColors.textSecondary} style={styles.loading} />}
        {tickets === undefined && failed && <MessageCard message={t('tickets.noPudimosCargarTusEntradas')} onRetry={reload} />}
        {tickets !== undefined && !upcoming.length && !done.length && (
          <MessageCard message={t('tickets.todaviaNoTienesEntradasCuando')} />
        )}

        {byEvent(upcoming).map(group => {
          const top = group.find(ticket => ticket.status === 'active') ?? group[0];
          const expanded = group.length > 1 && openGroup === top.eventId;
          return (
            <Animated.View key={top.eventId} layout={reducedMotion ? undefined : LinearTransition.duration(220)} style={styles.group}>
              {expanded ? (
                <>
                  <Pressable accessibilityRole="button" onPress={() => setOpenGroup(null)} style={({ pressed }) => [styles.groupHead, pressed && AppPressed]}>
                    <ThemedText numberOfLines={1} style={styles.groupTitle}>{top.event.title}</ThemedText>
                    <ThemedText style={styles.groupAction}>{t('tickets.juntar')}</ThemedText>
                  </Pressable>
                  {group.map((ticket, index) => (
                    <Animated.View key={ticket.id} entering={reducedMotion ? undefined : FadeIn.delay(index * 40).duration(180)} exiting={reducedMotion ? undefined : FadeOut.duration(120)}>
                      <Pressable accessibilityRole="button" accessibilityLabel={t('tickets.entradaNumberParaTitle', { number: ticket.number ?? '', title: ticket.event.title })} onPress={() => open(ticket)} style={({ pressed }) => pressed && AppPressed}>
                        <TicketView event={ticket.event} status={ticket.status} number={ticket.number} cap={ticket.event.cap} />
                      </Pressable>
                    </Animated.View>
                  ))}
                </>
              ) : (
                <TicketPile tickets={group} top={top} onPress={() => (group.length > 1 ? setOpenGroup(top.eventId) : open(top))} />
              )}
            </Animated.View>
          );
        })}

        {done.length > 0 && (
          <View style={styles.folder}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: folderOpen }}
              onPress={() => setFolderOpen(value => !value)}
              style={({ pressed }) => [styles.folderHead, pressed && AppPressed]}
            >
              <View style={styles.folderIcon}><Ionicons name="folder-open-outline" size={20} color={AppColors.textPrimary} /></View>
              <View style={styles.folderCopy}>
                <ThemedText style={styles.folderTitle}>{t('tickets.usadas')}</ThemedText>
                <ThemedText style={styles.folderText}>{t('tickets.countEntradas', { count: done.length })}</ThemedText>
              </View>
              <Ionicons name={folderOpen ? 'chevron-up' : 'chevron-down'} size={18} color={AppColors.textSecondary} />
            </Pressable>
            {folderOpen && done.map((ticket, index) => (
              <Animated.View key={ticket.id} entering={reducedMotion ? undefined : FadeIn.delay(index * 30).duration(160)} style={styles.folderItem}>
                <Pressable accessibilityRole="button" onPress={() => open(ticket)} style={({ pressed }) => pressed && AppPressed}>
                  <TicketView event={ticket.event} status={ticket.status} number={ticket.number} cap={ticket.event.cap} width={326} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.lg },
  loading: { marginTop: AppSpacing.xxl },
  group: { gap: AppSpacing.md, alignItems: 'center' },
  groupHead: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: AppSpacing.md, minHeight: 36 },
  groupTitle: { ...AppType.headline, color: AppColors.textPrimary, flex: 1 },
  groupAction: { ...AppType.callout, color: AppColors.textSecondary },
  folder: {
    marginTop: AppSpacing.md,
    padding: AppSpacing.md,
    gap: AppSpacing.md,
    borderRadius: AppRadii.lg,
    borderCurve: 'continuous',
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.hairline,
  },
  folderHead: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, minHeight: 44 },
  folderIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.surfaceMuted },
  folderCopy: { flex: 1 },
  folderTitle: { ...AppType.headline, color: AppColors.textPrimary },
  folderText: { ...AppType.footnote, color: AppColors.textSecondary },
  folderItem: { alignItems: 'center' },
});
