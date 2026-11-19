import { ThemedText } from '@/components/themed-text';
import { TicketView } from '@/components/tickets/ticket';
import { HanetButton } from '@/components/ui/hanet-button';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import { useMyTickets } from '@/hooks/use-my-tickets';
import { markTicketsSeen } from '@/services/tickets-service';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Llegada (canvas, board Llegada): the first time this phone sees new
// tickets, they arrive from below and open like a fan (5 for a presidente de
// curso, one for most). Plays once per ticket.

const MAX_FAN = 5;

function FanTicket({ index, count, children }: { index: number; count: number; children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const middle = (count - 1) / 2;
  const angle = (index - middle) * 7;
  const lift = Math.abs(index - middle) * 10;

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(160 + index * 90, withSpring(1, { stiffness: 210, damping: 17 }));
  }, [index, progress, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 2),
    transform: [
      { translateY: (1 - progress.value) * height * 0.6 + lift },
      { rotate: `${angle * progress.value}deg` },
    ],
  }));
  return <Animated.View style={[styles.fanItem, { zIndex: index }, style]}>{children}</Animated.View>;
}

export default function TicketArrivalScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { tickets } = useMyTickets();
  const wanted = new Set((ids ?? '').split(',').filter(Boolean));
  const arrived = (tickets ?? []).filter(ticket => wanted.has(ticket.id));
  const shown = arrived.slice(0, MAX_FAN);
  const first = arrived[0];
  const copy = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    void markTicketsSeen([...wanted]);
    if (Platform.OS !== 'web') {
      const timer = setTimeout(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined), 420);
      copy.value = withDelay(700, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
      return () => clearTimeout(timer);
    }
    copy.value = withDelay(700, withTiming(1, { duration: 320 }));
    // Only once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyStyle = useAnimatedStyle(() => ({ opacity: copy.value, transform: [{ translateY: (1 - copy.value) * 10 }] }));
  const close = () => router.replace('/tickets');
  const title = t('tickets.arrival.recibisteCountEntradas', { count: arrived.length });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Animated.View style={[styles.copy, copyStyle]}>
        <ThemedText accessibilityRole="header" style={styles.title}>{first ? title : t('common.entradas')}</ThemedText>
        {!!first && <ThemedText style={styles.text}>{t('tickets.arrival.paraTitleYaEstanEn', { title: first.event.title })}</ThemedText>}
      </Animated.View>
      <View style={styles.fan}>
        {shown.map((ticket, index) => (
          <FanTicket key={ticket.id} index={index} count={shown.length}>
            <TicketView event={ticket.event} status={ticket.status} number={ticket.number} cap={ticket.event.cap} />
          </FanTicket>
        ))}
        {arrived.length > MAX_FAN && (
          <Animated.View entering={FadeIn.delay(900)} style={styles.more}>
            <ThemedText style={styles.moreText}>{`×${arrived.length}`}</ThemedText>
          </Animated.View>
        )}
      </View>
      <Animated.View style={[styles.bottom, copyStyle]}>
        <HanetButton label={t('tickets.arrival.verMisEntradas')} variant="accent" onPress={close} />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas, justifyContent: 'space-between' },
  copy: { paddingTop: AppSpacing.xxl, paddingHorizontal: AppSpacing.xl, alignItems: 'center', gap: AppSpacing.sm },
  title: { ...AppType.title1, color: AppColors.textPrimary, textAlign: 'center' },
  text: { ...AppType.callout, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary, textAlign: 'center' },
  fan: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fanItem: { position: 'absolute' },
  more: { position: 'absolute', bottom: '18%', paddingHorizontal: 12, height: 30, borderRadius: 999, justifyContent: 'center', backgroundColor: AppColors.accent },
  moreText: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 14, lineHeight: 18 },
  bottom: { paddingHorizontal: AppSpacing.lg, paddingBottom: AppSpacing.lg },
});
