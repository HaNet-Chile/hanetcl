import { demoCount, demoTickets } from '@/components/showcase/ticket-demo';
import { ThemedText } from '@/components/themed-text';
import { TicketView } from '@/components/tickets/ticket';
import { LINEAR, track } from '@/components/tickets/timeline';
import type { Ease } from '@/components/tickets/timeline';
import { HanetButton } from '@/components/ui/hanet-button';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import { useMyTickets } from '@/hooks/use-my-tickets';
import { t } from '@/i18n';
import { markTicketsSeen } from '@/services/tickets-service';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

// Llegada (canvas Entradas HaNet, board Llegada): the first time this phone
// sees new tickets they arrive thrown from below, overshoot a little and
// settle like a spring, one after another, into a fan (5 for a Presidente de
// curso, one for most). The ×N pops in when the last one lands, with one
// success vibration, and the cover's light comes up behind. Plays once per
// ticket. Copied from the canvas keyframes.

/** Back to front: where each ticket of the fan ends, and its little kick. */
const SLOTS = [
  { x: -6, y: -40, rotate: -7, scale: 0.9, kick: -2.5 },
  { x: 6, y: -30, rotate: 5, scale: 0.93, kick: 2 },
  { x: -4, y: -20, rotate: -3.5, scale: 0.96, kick: -1.5 },
  { x: 3, y: -10, rotate: 2, scale: 0.98, kick: 1.5 },
  { x: 0, y: 0, rotate: 0, scale: 1, kick: -1 },
];
const LAND = 860;
const STEP = 90;
const THROW: Ease = [0.15, 0.75, 0.35, 1];
const SETTLE: Ease = [0.4, 0, 0.4, 1];
const POP: Ease = [0.3, 1.6, 0.5, 1];

function FanTicket({ clock, slot, delay, rise, children }: { clock: SharedValue<number>; slot: (typeof SLOTS)[number]; delay: number; rise: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const time = clock.get() - delay;
    const times = [0, LAND * 0.52, LAND * 0.74, LAND];
    const eases: Ease[] = [THROW, SETTLE, LINEAR];
    return {
      opacity: track(time, [0, LAND * 0.18], [0, 1], [THROW]),
      transform: [
        { translateX: track(time, times, [0, slot.x, slot.x, slot.x], eases) },
        { translateY: track(time, times, [rise, slot.y - 18, slot.y + 5, slot.y], eases) },
        { rotate: `${track(time, times, [slot.kick * -6, slot.rotate + slot.kick, slot.rotate + slot.kick * -0.4, slot.rotate], eases)}deg` },
        { scale: track(time, times, [0.88, slot.scale, slot.scale, slot.scale], eases) },
      ],
    };
  });
  return <Animated.View style={[styles.fanItem, style]}>{children}</Animated.View>;
}

export default function TicketArrivalScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { ids, demo } = useLocalSearchParams<{ ids?: string; demo?: string }>();
  const { tickets } = useMyTickets();
  // Sistema HaNet UI opens it with ?demo=N, with N made-up tickets.
  const demoArrived = demoCount(demo);
  const wanted = new Set((ids ?? '').split(',').filter(Boolean));
  const arrived = demoArrived ? demoTickets(demoArrived) : (tickets ?? []).filter(ticket => wanted.has(ticket.id));
  const shown = arrived.slice(0, SLOTS.length);
  const slots = SLOTS.slice(SLOTS.length - shown.length);
  const first = arrived[0];
  const settled = (shown.length - 1) * STEP + LAND;
  const total = settled + 1000;
  const clock = useSharedValue(reducedMotion ? total : 0);
  const light = first?.event.palette[0] ?? AppColors.accent;

  useEffect(() => {
    if (!demoArrived) void markTicketsSeen([...wanted]);
    if (!reducedMotion) clock.set(withTiming(total, { duration: total, easing: Easing.linear }));
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined), reducedMotion ? 0 : Math.max(settled, 1000) - 60);
    return () => clearTimeout(timer);
    // Only once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lightStyle = useAnimatedStyle(() => {
    const time = clock.get();
    return { opacity: track(time, [0, 900], [0, 1]), transform: [{ scale: track(time, [0, 900], [0.8, 1]) }] };
  });
  const countStyle = useAnimatedStyle(() => {
    const time = clock.get() - Math.max(settled, 1000);
    return { opacity: track(time, [0, 420], [0, 1], [POP]), transform: [{ scale: track(time, [0, 420], [0, 1], [POP]) }] };
  });
  const copyStyle = useAnimatedStyle(() => {
    const time = clock.get() - 760;
    return { opacity: track(time, [0, 480], [0, 1]), transform: [{ translateY: track(time, [0, 480], [14, 0]) }] };
  });
  const buttonStyle = useAnimatedStyle(() => {
    const time = clock.get() - 980;
    return { opacity: track(time, [0, 480], [0, 1]), transform: [{ translateY: track(time, [0, 480], [14, 0]) }] };
  });

  const close = () => (demoArrived ? router.back() : router.replace('/tickets'));
  const rise = 620 * (screenHeight / 844);
  const ticketWidth = Math.min(358, screenWidth - 32);

  return (
    <View style={styles.screen}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, lightStyle]}>
        <Svg width={screenWidth} height={screenHeight}>
          <Defs>
            <RadialGradient id="arrivalLight" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="0" stopColor={light} stopOpacity={0.45} />
              <Stop offset="1" stopColor={light} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={screenWidth / 2} cy={screenHeight * 0.45} rx={screenWidth * 0.85} ry={screenHeight * 0.36} fill="url(#arrivalLight)" />
        </Svg>
      </Animated.View>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.fan}>
          {shown.map((ticket, index) => {
            const front = index === shown.length - 1;
            return (
              <FanTicket key={ticket.id} clock={clock} slot={slots[index]} delay={index * STEP} rise={rise}>
                <TicketView event={ticket.event} status={ticket.status} number={ticket.number} cap={ticket.event.cap} bare={!front} width={ticketWidth} />
                {front && arrived.length > 1 && (
                  <Animated.View style={[styles.count, countStyle]}>
                    <ThemedText style={styles.countText}>{`×${arrived.length}`}</ThemedText>
                  </Animated.View>
                )}
              </FanTicket>
            );
          })}
        </View>

        <Animated.View style={[styles.copy, copyStyle]}>
          {!!first?.event.authorName && <ThemedText style={styles.kicker}>{first.event.authorName}</ThemedText>}
          <ThemedText accessibilityRole="header" style={styles.title}>{first ? t('tickets.arrival.recibisteCountEntradas', { count: arrived.length }) : t('common.entradas')}</ThemedText>
          {!!first && <ThemedText style={styles.text}>{t('tickets.arrival.paraTitleYaEstanEn', { title: first.event.title })}</ThemedText>}
        </Animated.View>

        <Animated.View style={[styles.bottom, buttonStyle]}>
          <HanetButton label={t('tickets.arrival.verMisEntradas')} variant="accent" onPress={close} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas, overflow: 'hidden' },
  safe: { flex: 1, justifyContent: 'space-between' },
  fan: { height: 250, marginTop: 72, alignItems: 'center' },
  fanItem: { position: 'absolute', top: 56 },
  count: { position: 'absolute', top: 12, right: 144, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: AppColors.accent },
  countText: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 12, lineHeight: 16 },
  copy: { alignItems: 'center', gap: 10, paddingHorizontal: AppSpacing.xl },
  kicker: { fontFamily: 'DMSans_500Medium', fontSize: 14, lineHeight: 20, color: AppColors.textSecondary, textAlign: 'center' },
  title: { ...AppType.title1, color: AppColors.textPrimary, textAlign: 'center' },
  text: { ...AppType.callout, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary, textAlign: 'center' },
  bottom: { paddingHorizontal: AppSpacing.lg, paddingBottom: AppSpacing.lg },
});
