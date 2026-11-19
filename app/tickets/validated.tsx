import { ThemedText } from '@/components/themed-text';
import { TicketView } from '@/components/tickets/ticket';
import { HanetButton } from '@/components/ui/hanet-button';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import { demoCount, demoTickets } from '@/components/showcase/ticket-demo';
import { useMyTickets } from '@/hooks/use-my-tickets';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// "Entrada válida" (canvas, board Validada; muxp 2026-11-19): 3 s on the
// holder's phone the moment the ticket is read at the door, like Apple Pay.
//   0.0 s  the phone vibrates and the ticket waits: it presses in and a light
//          runs across it.
//   0.5 s  a small shake, the stub tears off along the perforation and falls
//          with gravity and a spin; the info half recoils and springs up.
//   1.6 s  the check materializes from a blur with two ripples, a soft green
//          wash rises from below and the phone gives a success vibration.
// The green is only for this moment: HaNet has no green token.

const VALID = '#30D158';
const BASE_WIDTH = 358;

export default function TicketValidatedScreen() {
  const router = useRouter();
  const { id, demo } = useLocalSearchParams<{ id?: string; demo?: string }>();
  const { tickets } = useMyTickets();
  // Sistema HaNet UI opens it with ?demo=1, with a made-up ticket.
  const ticket = demoCount(demo) ? demoTickets(1)[0] : tickets?.find(item => item.id === id) ?? null;
  const reducedMotion = useReducedMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const width = Math.min(BASE_WIDTH, screenWidth - 32);
  const cut = Math.round(196 * (width / BASE_WIDTH));

  const press = useSharedValue(1);
  const sheen = useSharedValue(0);
  const shake = useSharedValue(0);
  const stubFall = useSharedValue(0);
  const halfLift = useSharedValue(0);
  const check = useSharedValue(0);
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const wash = useSharedValue(0);
  const copy = useSharedValue(0);

  useEffect(() => {
    const haptic = (run: () => Promise<void>) => { if (Platform.OS !== 'web') void run().catch(() => undefined); };
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    if (reducedMotion) {
      check.value = withTiming(1, { duration: 200 });
      copy.value = withTiming(1, { duration: 200 });
      wash.value = withTiming(1, { duration: 300 });
      halfLift.value = 1;
      stubFall.value = 1;
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      return;
    }
    const timers = [
      setTimeout(() => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)), 620),
      setTimeout(() => haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 1600),
    ];
    // Waiting: press in, the light runs across.
    press.value = withSequence(withTiming(0.96, { duration: 120 }), withDelay(260, withSpring(1, { stiffness: 380, damping: 18 })));
    sheen.value = withTiming(1, { duration: 480, easing: Easing.inOut(Easing.cubic) });
    // Anticipation, then the tear.
    shake.value = withDelay(500, withSequence(
      withTiming(-1, { duration: 40 }), withTiming(1, { duration: 50 }), withTiming(-0.6, { duration: 40 }), withTiming(0, { duration: 40 }),
    ));
    stubFall.value = withDelay(620, withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) }));
    halfLift.value = withDelay(620, withSequence(
      withTiming(-0.15, { duration: 120, easing: Easing.out(Easing.quad) }),
      withSpring(1, { stiffness: 220, damping: 14 }),
    ));
    // The check and its ripples, the wash and the words.
    check.value = withDelay(1600, withSpring(1, { stiffness: 260, damping: 15 }));
    ripple1.value = withDelay(1650, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    ripple2.value = withDelay(1850, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    wash.value = withDelay(1500, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    copy.value = withDelay(1900, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    return () => timers.forEach(clearTimeout);
  }, [check, copy, halfLift, press, reducedMotion, ripple1, ripple2, shake, sheen, stubFall, wash]);

  const ticketStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }, { rotate: `${shake.value * 2}deg` }],
  }));
  const halfStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(halfLift.value, [-0.15, 0, 1], [10, 0, -screenHeight * 0.16]) },
      { scale: interpolate(halfLift.value, [0, 1], [1, 0.92]) },
    ],
    opacity: interpolate(halfLift.value, [0, 0.6, 1], [1, 1, 0.9]),
  }));
  const stubStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: stubFall.value * screenHeight * 0.7 },
      { translateX: stubFall.value * 40 },
      { rotate: `${stubFall.value * 38}deg` },
    ],
    opacity: interpolate(stubFall.value, [0, 0.7, 1], [1, 0.8, 0]),
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.15, 0.85, 1], [0, 0.55, 0.55, 0]),
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-120, width + 40]) }, { rotate: '18deg' }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(check.value, [0, 0.4, 1], [0, 1, 1]),
    transform: [{ scale: interpolate(check.value, [0, 1], [0.5, 1]) }],
  }));
  // Runs on the UI thread from the two styles below, so it has to be a worklet
  // (without it Reanimated stops the app: muxp, 2026-11-19).
  const rippleStyle = (value: typeof ripple1) => {
    'worklet';
    return {
      opacity: interpolate(value.value, [0, 0.1, 1], [0, 0.5, 0]),
      transform: [{ scale: interpolate(value.value, [0, 1], [1, 2.6]) }],
    };
  };
  const ripple1Style = useAnimatedStyle(() => rippleStyle(ripple1));
  const ripple2Style = useAnimatedStyle(() => rippleStyle(ripple2));
  const washStyle = useAnimatedStyle(() => ({
    opacity: wash.value * 0.32,
    transform: [{ translateY: interpolate(wash.value, [0, 1], [screenHeight * 0.3, 0]) }],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: copy.value,
    transform: [{ translateY: interpolate(copy.value, [0, 1], [12, 0]) }],
  }));

  const close = () => (router.canGoBack() ? router.back() : router.replace('/tickets'));
  const ticketHeight = Math.round(200 * Math.max(0.9, width / BASE_WIDTH));

  return (
    <View style={styles.screen}>
      <Animated.View pointerEvents="none" style={[styles.wash, washStyle]} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.stage}>
          {ticket && (
            <Animated.View style={[{ width, height: ticketHeight }, ticketStyle]}>
              {/* The info half stays; the stub is the same ticket seen through a window. */}
              <Animated.View style={[styles.part, { width: cut + 1, height: ticketHeight }, halfStyle]}>
                <TicketView event={ticket.event} status="active" qrValue={null} number={ticket.number} cap={ticket.event.cap} size="large" width={width} />
              </Animated.View>
              <Animated.View style={[styles.part, { left: cut, width: width - cut, height: ticketHeight }, stubStyle]}>
                <View style={{ marginLeft: -cut }}>
                  <TicketView event={ticket.event} status="active" qrValue="hanet://ticket/validada" number={ticket.number} cap={ticket.event.cap} size="large" width={width} />
                </View>
              </Animated.View>
              <View pointerEvents="none" style={[styles.part, { width, height: ticketHeight }]}>
                <Animated.View style={[styles.sheen, { height: ticketHeight * 1.6 }, sheenStyle]} />
              </View>
            </Animated.View>
          )}

          <View style={styles.checkArea}>
            <Animated.View style={[styles.ripple, ripple1Style]} />
            <Animated.View style={[styles.ripple, ripple2Style]} />
            <Animated.View style={[styles.check, checkStyle]}>
              <Ionicons name="checkmark" size={54} color={AppColors.textPrimary} />
            </Animated.View>
          </View>

          <Animated.View style={[styles.copy, copyStyle]} accessible accessibilityLiveRegion="assertive" accessibilityLabel={t('tickets.validated.entradaValidaTeDamosLa', { title: ticket?.event.title ?? 'tu evento' })}>
            <ThemedText style={styles.title}>{t('tickets.scan.entradaValida')}</ThemedText>
            <ThemedText style={styles.text}>{t('tickets.validated.teDamosLaBienvenidaA')}</ThemedText>
            <ThemedText style={styles.event}>{ticket?.event.title ?? ''}</ThemedText>
          </Animated.View>
        </View>
        <Animated.View style={[styles.bottom, copyStyle]}>
          <HanetButton label={t('common.listo')} variant="surface" onPress={close} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas, overflow: 'hidden' },
  wash: { position: 'absolute', left: -40, right: -40, bottom: -80, height: '70%', borderRadius: 400, backgroundColor: VALID },
  safe: { flex: 1, justifyContent: 'space-between' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: AppSpacing.xl },
  part: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  sheen: { position: 'absolute', top: -40, width: 70, backgroundColor: AppColors.textPrimary },
  checkArea: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 96, height: 96 },
  ripple: { position: 'absolute', width: 96, height: 96, borderRadius: 999, borderWidth: 2, borderColor: VALID },
  check: { width: 96, height: 96, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: VALID },
  copy: { position: 'absolute', bottom: '22%', alignItems: 'center', paddingHorizontal: AppSpacing.xl },
  title: { ...AppType.title1, color: AppColors.textPrimary, textAlign: 'center' },
  text: { ...AppType.callout, color: AppColors.textSecondary, textAlign: 'center', marginTop: AppSpacing.sm },
  event: { ...AppType.headline, color: AppColors.textPrimary, textAlign: 'center' },
  bottom: { paddingHorizontal: AppSpacing.lg, paddingBottom: AppSpacing.lg },
});
