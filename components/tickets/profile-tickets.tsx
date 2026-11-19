import { ThemedText } from '@/components/themed-text';
import { TicketView } from '@/components/tickets/ticket';
import { AppColors, AppPressed, AppSpacing, AppType } from '@/constants/design-tokens';
import type { Ticket } from '@/services/tickets-service';
import { isPast } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '@/i18n';

/** The tickets still ahead, the next event first. */
export function upcomingTickets(tickets: Ticket[], now = Date.now()) {
  return tickets
    .filter(ticket => ticket.status !== 'voided' && ticket.status !== 'used' && !isPast(ticket.event, now))
    .sort((a, b) => (a.event.startsAt ?? 0) - (b.event.startsAt ?? 0) || (a.number ?? 0) - (b.number ?? 0));
}

/** What the small line of a pile says: how many are in the account and how many left it. */
export function pileKicker(tickets: Ticket[]) {
  const mine = tickets.filter(ticket => ticket.status === 'active').length;
  const out = tickets.length - mine;
  if (tickets.length <= 1) return undefined;
  return out > 0 ? t('components.tickets.profileTickets.mineEnTuCuentaOut', { mine, out }) : t('components.tickets.profileTickets.mineEnTuCuenta', { mine });
}

/**
 * Entradas in Perfil: appears only when the account has tickets for an event
 * still ahead. The next event's ticket, as a pile when there are several.
 */
export function ProfileTickets({ tickets }: { tickets: Ticket[] | undefined }) {
  const router = useRouter();
  const upcoming = upcomingTickets(tickets ?? []);
  if (!upcoming.length) return null;
  const next = upcoming[0];
  const sameEvent = upcoming.filter(ticket => ticket.eventId === next.eventId);
  const shown = sameEvent.find(ticket => ticket.status === 'active') ?? next;
  const otherEvents = new Set(upcoming.map(ticket => ticket.eventId)).size - 1;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <ThemedText accessibilityRole="header" style={styles.title}>{t('common.entradas')}</ThemedText>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push('/tickets')} style={({ pressed }) => [styles.all, pressed && AppPressed]}>
          <ThemedText style={styles.allText}>{otherEvents > 0 ? t('components.tickets.profileTickets.verTodasUpcomingcount', { upcomingCount: upcoming.length }) : t('components.tickets.profileTickets.verTodas')}</ThemedText>
          <Ionicons name="chevron-forward" size={16} color={AppColors.textSecondary} />
        </Pressable>
      </View>
      <TicketPile
        tickets={sameEvent}
        top={shown}
        onPress={() => router.push({ pathname: '/tickets/detail', params: { id: shown.id } })}
      />
    </View>
  );
}

/** One ticket, with the edges of the others peeking out below and "×N". */
export function TicketPile({ tickets, top, onPress }: { tickets: Ticket[]; top: Ticket; onPress: () => void }) {
  const count = tickets.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 1 ? t('components.tickets.profileTickets.titleCountvalueEntradas', { title: top.event.title, countValue: count }) : t('components.tickets.profileTickets.entradaParaTitle', { title: top.event.title })}
      onPress={onPress}
      style={({ pressed }) => [styles.pile, count > 1 && styles.pileStacked, pressed && AppPressed]}
    >
      {count > 2 && <View style={[styles.layer, styles.layer2]} />}
      {count > 1 && <View style={[styles.layer, styles.layer1]} />}
      <TicketView event={top.event} status={top.status} number={top.number} cap={top.event.cap} kicker={pileKicker(tickets)} />
      {count > 1 && (
        <View style={styles.count}>
          <ThemedText style={styles.countText}>{`×${count}`}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: AppSpacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...AppType.title3, color: AppColors.textPrimary },
  all: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  allText: { ...AppType.callout, color: AppColors.textSecondary },
  pile: { alignSelf: 'center' },
  pileStacked: { paddingBottom: 16 },
  layer: { position: 'absolute', height: 40, bottom: 0, borderRadius: 18, borderCurve: 'continuous' },
  layer1: { left: 9, right: 9, bottom: 8, backgroundColor: '#454448' },
  layer2: { left: 18, right: 18, bottom: 0, backgroundColor: '#3A393C' },
  count: {
    position: 'absolute',
    top: -8,
    right: -6,
    minWidth: 34,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.accent,
  },
  countText: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 13, lineHeight: 16 },
});
