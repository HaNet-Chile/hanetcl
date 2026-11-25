import { ThemedText } from '@/components/themed-text';
import { CustomIcon } from '@/components/ui/custom-icon';
import { AppColors, AppRadii, AppRowPressed, AppSpacing } from '@/constants/design-tokens';
import { SPRING_SMOOTH } from '@/constants/motion';
import { useRole } from '@/services/auth-service';
import { DAY_CHANGE_ROLES } from '@/services/organize-service';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import React, { useEffect, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { t } from '@/i18n';

// What Organizar shares with the global bar: its center is "Escanear" while
// one of its events has the door open, and "Crear" the rest of the time, a
// menu that grows out of the bar like the Calendar's views.

type State = { menuOpen: boolean; scanEventId: string | null; scanTicketed: boolean };

let state: State = { menuOpen: false, scanEventId: null, scanTicketed: false };
const listeners = new Set<() => void>();

function set(changes: Partial<State>) {
  state = { ...state, ...changes };
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOrganizeCenter() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const organizeCenter = {
  toggleMenu: () => set({ menuOpen: !state.menuOpen }),
  closeMenu: () => { if (state.menuOpen) set({ menuOpen: false }); },
  /** The event whose door is open now, if any; the screen says so as it loads. */
  setScan: (eventId: string | null, ticketed: boolean) => {
    if (eventId !== state.scanEventId || ticketed !== state.scanTicketed) set({ scanEventId: eventId, scanTicketed: ticketed });
  },
};

/** The scanner for an event: tickets at the door, or the HN-QR list ("Pasar lista"). */
export function scanHref(eventId: string, ticketed: boolean): Href {
  return ticketed
    ? { pathname: '/tickets/scan' as never, params: { eventId } }
    : { pathname: '/event-checkin', params: { id: eventId } };
}

const MAX_SCALE = 1.3;

const tick = () => {
  if (Platform.OS === 'ios') void Haptics.selectionAsync();
};

/** "Escanear": straight to the door of the event that is on now. */
export function ScanPill({ eventId, ticketed }: { eventId: string; ticketed: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('organize.escanear')}
      accessibilityHint={ticketed ? t('organize.abreElEscanerDeEntradas') : t('organize.abrePasarListaConHnqr')}
      onPress={() => {
        tick();
        router.push(scanHref(eventId, ticketed));
      }}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={styles.pill}>
        <Ionicons name="scan-outline" size={18} color={AppColors.textOnLight} />
        <ThemedText maxFontSizeMultiplier={MAX_SCALE} style={styles.pillText}>{t('organize.escanear')}</ThemedText>
      </View>
    </Pressable>
  );
}

/** "Crear", whose menu grows out of the bar. */
export function CreatePill({ open }: { open: boolean }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = reduceMotion ? withTiming(open ? 1 : 0, { duration: 100 }) : withSpring(open ? 1 : 0, SPRING_SMOOTH);
  }, [open, reduceMotion, turn]);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-90 + turn.value * 180}deg` }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('organize.crear')}
      accessibilityHint={open ? t('components.anniversary.organizeMenu.cierraElMenu') : t('organize.avisoEventoOVotacion')}
      accessibilityState={{ expanded: open }}
      onPress={() => {
        tick();
        organizeCenter.toggleMenu();
      }}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={styles.pill}>
        <CustomIcon name="plus" size={16} color={AppColors.textOnLight} />
        <ThemedText maxFontSizeMultiplier={MAX_SCALE} style={styles.pillText}>{t('organize.crear')}</ThemedText>
        <Animated.View style={chevronStyle}>
          <CustomIcon name="chevron-right" size={14} color={AppColors.textOnLight} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

type Item = { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; href: Href };

const ICON = AppColors.textSecondary;

/** What "Crear" offers: the aviso first, the most common. */
export function CreateMenu() {
  const router = useRouter();
  const role = useRole();
  const items: Item[] = [
    { key: 'notice', label: t('organize.publicarUnAviso'), icon: 'megaphone-outline', href: '/feed-post' },
    { key: 'notify', label: t('common.enviarUnaNotificacion'), icon: 'notifications-outline', href: '/organize/notify' },
    { key: 'event', label: t('organize.crearUnEvento'), icon: 'calendar-outline', href: '/organize/new' },
    { key: 'poll', label: t('organize.crearUnaVotacion'), icon: 'stats-chart-outline', href: { pathname: '/feed-post', params: { poll: '1' } } },
  ];
  const classes: Item[] = role && DAY_CHANGE_ROLES.includes(role)
    ? [{ key: 'day', label: t('organize.suspenderClasesOSalida'), icon: 'ban-outline', href: '/day-change' }]
    : [];

  const row = (item: Item) => (
    <Pressable
      key={item.key}
      accessibilityRole="menuitem"
      accessibilityLabel={item.label}
      onPress={() => {
        tick();
        organizeCenter.closeMenu();
        router.push(item.href);
      }}
      style={({ pressed }) => [styles.row, pressed && AppRowPressed]}
    >
      <View style={styles.icon}><Ionicons name={item.icon} size={22} color={ICON} /></View>
      <ThemedText maxFontSizeMultiplier={MAX_SCALE} style={styles.rowText}>{item.label}</ThemedText>
    </Pressable>
  );

  return (
    <View accessibilityRole="menu" style={styles.menu}>
      {items.map(row)}
      {classes.length > 0 && <View style={styles.separator} />}
      {classes.map(row)}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  pill: {
    height: 45,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: AppRadii.pill,
    backgroundColor: AppColors.controlActive,
  },
  pillText: {
    color: AppColors.textOnLight,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
  menu: {
    padding: AppSpacing.sm + 2,
    paddingBottom: AppSpacing.xs,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: AppSpacing.md + 2,
    paddingHorizontal: AppSpacing.md + 2,
    borderRadius: AppRadii.md,
  },
  icon: {
    width: 24,
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 17,
    lineHeight: 22,
    color: AppColors.textPrimary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: AppSpacing.xs,
    marginHorizontal: AppSpacing.md + 2,
    backgroundColor: AppColors.separator,
  },
});
