import { ThemedText } from '@/components/themed-text';
import { scanHref } from '@/components/organize/organize-bar';
import { CustomIcon } from '@/components/ui/custom-icon';
import { AppColors, AppPressed, AppRadii, AppRowPressed, AppSpacing, AppType } from '@/constants/design-tokens';
import { eventWhen } from '@/services/events-service';
import type { HnEvent } from '@/services/events-service';
import { eventFilter } from '@/services/organize-service';
import { arrivals, listEventTickets } from '@/services/ticket-admin-service';
import type { TicketTotals } from '@/services/ticket-admin-service';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { t } from '@/i18n';

// Pieces of Organizar (app/organize) that more than one screen shows.

/** "Llegaron 212 de 300" with its bar. `size` "large" is the event's page. */
export function ArrivalCounter({ arrived, of, size = 'medium' }: { arrived: number; of: number; size?: 'medium' | 'large' }) {
  const share = of > 0 ? Math.min(1, arrived / of) : 0;
  return (
    <View
      accessible
      accessibilityLabel={t('organize.llegaronArrivedDeOf', { arrived, of })}
      style={styles.counter}
    >
      <View style={styles.counterLine}>
        <ThemedText style={styles.counterLabel}>{t('organize.llegaron')}</ThemedText>
        <ThemedText style={[styles.counterNumber, size === 'large' && styles.counterNumberLarge]}>{arrived}</ThemedText>
        <ThemedText style={styles.counterLabel}>{t('organize.deOf', { of })}</ThemedText>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
      </View>
    </View>
  );
}

/** A ticketed event's totals, read again each time the screen asks. */
export function useTicketTotals(event: HnEvent | null | undefined, refresh = 0) {
  const ticketed = event?.signupMode === 'tickets';
  const [totals, setTotals] = useState<TicketTotals | undefined>(undefined);
  useEffect(() => {
    if (!event || !ticketed) return;
    let live = true;
    listEventTickets(event.id).then(list => { if (live) setTotals(list.totals); }).catch(() => undefined);
    return () => { live = false; };
  }, [event, ticketed, refresh]);
  return totals;
}

/** What an event's arrivals are, for tickets or for the HN-QR list. */
export function eventArrivals(event: HnEvent, totals: TicketTotals | undefined) {
  if (event.signupMode === 'tickets') return arrivals(totals);
  return { arrived: event.checkinCount ?? 0, of: event.signupCount ?? event.capacity ?? 0 };
}

/**
 * The event whose door is open now: where it is, who has arrived and the
 * scanner. On the Home ("Hoy organizas") and at the top of Organizar.
 */
export function TodayEventCard({ event, compact, door, style }: { event: HnEvent; compact?: boolean; door?: boolean; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  // `door`: a docente who only scans (setTicketScanner) sees no counts.
  const totals = useTicketTotals(door ? null : event);
  const ticketed = event.signupMode === 'tickets';
  const { arrived, of } = eventArrivals(event, totals);
  const [now] = useState(() => Date.now());
  const started = event.startsAt <= now;
  const open = () => router.push(door ? scanHref(event.id, ticketed) : { pathname: '/organize/event', params: { id: event.id } });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('organize.abrirTitle', { title: event.title })}
      onPress={open}
      style={({ pressed }) => [styles.today, compact && styles.todayCompact, pressed && AppPressed, style]}
    >
      <View style={styles.todayTop}>
        <View style={styles.todayText}>
          <View style={styles.kicker}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.kickerText} numberOfLines={1}>
              {compact
                ? t(door ? 'organize.hoyEscaneasWhen' : 'organize.hoyOrganizasWhen', { when: eventWhen(event).split(' ').pop() })
                : started ? t('organize.enCursoVenue', { venue: event.venueName || eventWhen(event) }) : eventWhen(event)}
            </ThemedText>
          </View>
          <ThemedText style={compact ? styles.todayTitleCompact : styles.todayTitle} numberOfLines={2}>{event.title}</ThemedText>
          {compact && !door && (ticketed || of > 0 || arrived > 0) && (
            <ThemedText style={styles.todayMeta}>{of > 0 ? t('organize.llegaronArrivedDeOf', { arrived, of }) : t('organize.llegaronArrived', { arrived })}</ThemedText>
          )}
        </View>
        {compact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('organize.escanear')}
            onPress={() => router.push(scanHref(event.id, ticketed))}
            style={({ pressed }) => [styles.scanButton, pressed && AppPressed]}
          >
            <Ionicons name="scan-outline" size={18} color={AppColors.textPrimary} />
            <ThemedText style={styles.scanText}>{t('organize.escanear')}</ThemedText>
          </Pressable>
        ) : (
          <CustomIcon name="chevron-right" size={20} color={AppColors.textSecondary} />
        )}
      </View>
      {!compact && (of > 0 || arrived > 0) && <ArrivalCounter arrived={arrived} of={of} />}
    </Pressable>
  );
}

/** One event in Organizar's lists: cover, when and what kind, and its state. */
export function OrganizedEventRow({ event, onPress }: { event: HnEvent; onPress: () => void }) {
  const kind = eventFilter(event);
  const kindLabel = kind === 'regional' ? t('organize.hanetEventos') : kind === 'private' ? t('organize.privadoYFormal') : t('organize.institucion');
  const state = event.status === 'draft'
    ? t('organize.borrador')
    : event.signupMode === 'tickets'
      ? t('organize.conEntrada')
      : event.signupMode === 'list'
        ? t('organize.countInscritos', { count: event.signupCount ?? 0 })
        : event.signupMode === 'count'
          ? t('organize.countVan', { count: event.signupCount ?? 0 })
          : kind === 'regional' && event.coupon ? t('organize.conCuponHanet') : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[event.title, eventWhen(event), kindLabel, state].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && AppRowPressed]}
    >
      <View style={styles.cover}>
        {event.imageUrl
          ? <Image source={{ uri: event.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <Ionicons name={kind === 'private' ? 'lock-closed-outline' : 'calendar-outline'} size={20} color={AppColors.textSecondary} />}
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowMeta} numberOfLines={1}>{eventWhen(event)} · {kindLabel}</ThemedText>
        <ThemedText style={styles.rowTitle} numberOfLines={1}>{event.title}</ThemedText>
        {!!state && (
          <View style={styles.stateLine}>
            {event.canCheckIn && <View style={styles.liveDot} />}
            <ThemedText style={styles.rowState} numberOfLines={1}>{state}</ThemedText>
          </View>
        )}
      </View>
      <CustomIcon name="chevron-right" size={18} color={AppColors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  counter: { gap: AppSpacing.sm },
  counterLine: { flexDirection: 'row', alignItems: 'baseline', gap: AppSpacing.sm },
  counterLabel: { ...AppType.callout, color: AppColors.textSecondary },
  counterNumber: { fontFamily: 'DMSans_700Bold', fontSize: 40, lineHeight: 44, letterSpacing: -1.8, color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  counterNumberLarge: { fontSize: 56, lineHeight: 60, letterSpacing: -2.6 },
  track: { height: 8, borderRadius: AppRadii.pill, backgroundColor: AppColors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: AppRadii.pill, backgroundColor: AppColors.accent },
  today: {
    gap: AppSpacing.lg,
    padding: 20,
    borderRadius: AppRadii.lg,
    borderCurve: 'continuous',
    backgroundColor: AppColors.surface,
  },
  todayCompact: { padding: 16, paddingLeft: 18 },
  todayTop: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md },
  todayText: { flex: 1, minWidth: 0, gap: 4 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  kickerText: { ...AppType.caption, color: AppColors.textPrimary },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AppColors.accent },
  todayTitle: { ...AppType.title3, color: AppColors.textPrimary },
  todayTitleCompact: { ...AppType.headline, color: AppColors.textPrimary },
  todayMeta: { ...AppType.footnote, color: AppColors.textSecondary, fontVariant: ['tabular-nums'] },
  scanButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: AppRadii.pill,
    backgroundColor: AppColors.accent,
  },
  scanText: { fontFamily: 'DMSans_700Bold', fontSize: 14, lineHeight: 20, color: AppColors.textPrimary },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md + 2,
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.md,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceMuted,
  },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowMeta: { ...AppType.caption, color: AppColors.textSecondary },
  rowTitle: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, lineHeight: 21, letterSpacing: -0.2, color: AppColors.textPrimary },
  stateLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowState: { ...AppType.caption, color: AppColors.textPrimary },
});
