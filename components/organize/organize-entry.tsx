import { TodayEventCard } from '@/components/organize/organize-ui';
import { AppColors, AppPressed } from '@/constants/design-tokens';
import { useRole } from '@/services/auth-service';
import type { HnEvent } from '@/services/events-service';
import { canOrganize, doorOpen, eventsToday, listMyDoorEvents, listOrganizedEvents, openWebPanel, opensWebPanel, peekOrganizedEvents } from '@/services/organize-service';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { t } from '@/i18n';

// How Organizar shows up outside itself: a button in the Home's header (with
// a dot while one of the events has its door open) and "Hoy organizas".

type Today = { events: HnEvent[]; door: boolean };

/**
 * The events whose door is open now for this account: the ones it organizes
 * (Admin, CEE, HNT) or, for a docente, the ones it may scan.
 */
export function useOrganizeToday(): Today {
  const role = useRole();
  const organizer = canOrganize(role);
  const [today, setToday] = useState<Today>(() => ({ events: eventsToday(peekOrganizedEvents()), door: false }));

  useFocusEffect(useCallback(() => {
    let live = true;
    if (organizer) {
      listOrganizedEvents().then(list => { if (live) setToday({ events: eventsToday(list), door: false }); }).catch(() => undefined);
    } else if (role === 'Profesor') {
      listMyDoorEvents()
        .then(list => {
          if (!live) return;
          const events = list.filter(event => doorOpen(event)).map(event => ({ ...event, signupMode: 'tickets', kind: 'institution' }) as unknown as HnEvent);
          setToday({ events, door: true });
        })
        .catch(() => undefined);
    } else {
      setToday({ events: [], door: false });
    }
    return () => { live = false; };
  }, [organizer, role]));

  return today;
}

/** Organizar's button in the Home's header, for who organizes. */
export function OrganizeHeaderButton({ live, style }: { live: boolean; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const role = useRole();
  if (!canOrganize(role)) return null;
  const web = opensWebPanel();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={live ? t('organize.organizarHoyTienesUnEvento') : t('organize.organizar')}
      accessibilityHint={web ? t('organize.abreElPanelWebEn') : undefined}
      hitSlop={4}
      onPress={() => (web ? openWebPanel() : router.push('/organize'))}
      style={({ pressed }) => [styles.button, pressed && AppPressed, style]}
    >
      <Ionicons name="grid-outline" size={20} color={AppColors.textPrimary} />
      {live && <View style={styles.dot} />}
    </Pressable>
  );
}

/** "Hoy organizas" on the Home: the event on now, its arrivals and Escanear. */
export function HomeOrganizeToday({ today, style }: { today: Today; style?: StyleProp<ViewStyle> }) {
  if (!today.events.length) return null;
  return (
    <View style={[styles.today, style]}>
      {today.events.slice(0, 2).map(event => <TodayEventCard key={event.id} event={event} compact door={today.door} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surface,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: AppColors.surface,
    backgroundColor: AppColors.accent,
  },
  today: { gap: 8 },
});
