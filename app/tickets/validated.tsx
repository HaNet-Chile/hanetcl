import { demoCount, demoTickets } from '@/components/showcase/ticket-demo';
import { ThemedText } from '@/components/themed-text';
import { TicketView, ticketWhen } from '@/components/tickets/ticket';
import { TicketGlow } from '@/components/tickets/ticket-glow';
import { EASE_IN_OUT, EASE_OUT, LINEAR, track } from '@/components/tickets/timeline';
import type { Ease } from '@/components/tickets/timeline';
import { HanetButton } from '@/components/ui/hanet-button';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import { useMyTickets } from '@/hooks/use-my-tickets';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

// "Entrada válida" (canvas Entradas HaNet, board Validada; muxp 2026-11-19):
// 3 s on the holder's phone the moment the ticket is read at the door, copied
// from the canvas keyframes (times in ms = % of 3000).
//   0      vibration; the ticket presses in, a sheen crosses it and a light
//          runs around its edge.
//   500    the stub shakes on its perforation, tears off in a zigzag (700,
//          second vibration) and falls with gravity and a spin.
//   700    the information half recoils, then flies up to the middle and
//          settles with a small bounce.
//   1290   a soft green rises from below; the check materializes (1500,
//          success vibration), draws its tick and sends two ripples.
//   1680   the words; 2160 the button.
// The green is only for this moment: HaNet has no green token.

const VALID = '#30D158';
const DURATION = 3000;
/** The canvas is a 390 × 844 phone; distances scale with the screen. */
const CANVAS_HEIGHT = 844;
const RING = 104;
const STUB_FALL: Ease = [0.55, 0, 0.9, 0.45];
const TRACE: Ease = [0.4, 0, 0.3, 1];

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The ticket's outline, for the light that runs around it (ticketPath without the notch sizes). */
function outline(w: number, h: number, cut: number) {
  return `M22 0H${cut - 11}A11 11 0 0 0 ${cut + 11} 0H${w - 22}A22 22 0 0 1 ${w} 22V${h - 22}A22 22 0 0 1 ${w - 22} ${h}H${cut + 11}A11 11 0 0 0 ${cut - 11} ${h}H22A22 22 0 0 1 0 ${h - 22}V22A22 22 0 0 1 22 0Z`;
}

export default function TicketValidatedScreen() {
  const router = useRouter();
  const { id, demo } = useLocalSearchParams<{ id?: string; demo?: string }>();
  const { tickets } = useMyTickets();
  // Sistema HaNet UI opens it with ?demo=1, with a made-up ticket.
  const ticket = demoCount(demo) ? demoTickets(1)[0] : tickets?.find(item => item.id === id) ?? null;
  const reducedMotion = useReducedMotion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const width = Math.min(358, screenWidth - 32);
  const scale = width / 358;
  const height = Math.round(200 * Math.max(0.9, scale));
  const cut = Math.round(196 * scale);
  const k = screenHeight / CANVAS_HEIGHT;
  const top = screenHeight / 2 - height / 2;
  const perimeter = 2 * (width - 44 - 22) + 2 * (height - 44) + Math.PI * 44 + Math.PI * 22;
  const unit = perimeter / 125;
  const clock = useSharedValue(reducedMotion ? DURATION : 0);
  const when = ticketWhen(ticket?.event.startsAt ?? null);

  const [traced, setTraced] = useState(reducedMotion);
  useEffect(() => {
    const timer = setTimeout(() => setTraced(true), 650);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const haptic = (run: () => Promise<void>) => { if (Platform.OS !== 'web') void run().catch(() => undefined); };
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    if (reducedMotion) {
      haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      return;
    }
    clock.set(withTiming(DURATION, { duration: DURATION, easing: Easing.linear }));
    const timers = [
      setTimeout(() => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)), 700),
      setTimeout(() => haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [clock, reducedMotion]);

  // Waiting: it presses in and comes back.
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: track(clock.get(), [0, 90, 300, 450], [1, 0.93, 1.03, 1]) }],
  }));
  const sheenStyle = useAnimatedStyle(() => {
    const time = clock.get();
    return {
      opacity: track(time, [0, 60, 450, 480], [0, 1, 1, 0], [], EASE_IN_OUT),
      transform: [{ translateX: track(time, [0, 450], [-108, 234], [], EASE_IN_OUT) }, { skewX: '-18deg' }],
    };
  });
  const traceProps = (dash: number) => {
    'worklet';
    const time = clock.get();
    return {
      strokeDashoffset: track(time, [0, 570], [dash * unit, -(125 - dash) * unit], [], TRACE),
    };
  };
  // The light fades as a layer, and leaves once it has gone around: an
  // animated stroke opacity could stay on its first frame and leave a line on
  // the edge.
  const traceStyle = useAnimatedStyle(() => ({ opacity: track(clock.get(), [0, 45, 450, 570], [0, 1, 1, 0], [], TRACE) }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: track(clock.get(), [0, 600], [0, 1]) }));
  const trace1 = useAnimatedProps(() => traceProps(5));
  const trace1Glow = useAnimatedProps(() => traceProps(5));
  const trace2 = useAnimatedProps(() => traceProps(12));
  const trace3 = useAnimatedProps(() => traceProps(24));

  // The stub: a shake on its hinge, the tear, the fall.
  const stubStyle = useAnimatedStyle(() => {
    const time = clock.get();
    const times = [0, 500, 555, 600, 645, 700, 1350];
    const fall: Ease[] = [EASE_OUT, EASE_OUT, EASE_OUT, EASE_OUT, EASE_OUT, STUB_FALL];
    return {
      opacity: track(time, [0, 700, 1350], [1, 1, 0], [LINEAR, STUB_FALL]),
      transform: [
        { translateX: track(time, times, [0, 0, 0, 0, 0, 8, 70], fall) },
        { translateY: track(time, times, [0, 0, 0, 0, 0, 6, 640 * k], fall) },
        { rotate: `${track(time, times, [0, 0, -3.5, 3, -2, 5, 52], fall)}deg` },
      ],
    };
  });
  // The information half: recoils, flies up to the middle, settles.
  const halfStyle = useAnimatedStyle(() => {
    const time = clock.get();
    const times = [0, 700, 795, 900, 1380, 1560, 1710];
    const eases: Ease[] = [LINEAR, LINEAR, [0.3, 0, 0.2, 1], [0.2, 0.8, 0.3, 1], LINEAR, LINEAR];
    const centerX = (width - cut) / 2;
    return {
      transform: [
        { translateX: track(time, times, [0, 0, -14, -10, centerX, centerX, centerX], eases) },
        { translateY: track(time, times, [0, 0, 5, 3, -198 * k, -171 * k, -176 * k], eases) },
        { rotate: `${track(time, times, [0, 0, -3.5, -2, 1.2, -0.4, 0], eases)}deg` },
      ],
    };
  });

  const washStyle = useAnimatedStyle(() => ({ opacity: track(clock.get(), [0, 1290, 1650], [0, 0, 1]) }));
  const checkStyle = useAnimatedStyle(() => {
    const time = clock.get();
    return {
      opacity: track(time, [0, 1290, 1500], [0, 0, 1]),
      transform: [{ scale: track(time, [0, 1290, 1500, 1650, 1800, 1950], [0, 0, 1.2, 0.92, 1.04, 1]) }],
    };
  });
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: track(clock.get(), [0, 1410, 1680], [20, 20, 0]) }));
  const ripple1Style = useAnimatedStyle(() => {
    const time = clock.get();
    return {
      opacity: track(time, [0, 1500, 1560, 2460], [0, 0, 0.7, 0]),
      transform: [{ scale: track(time, [0, 1500, 2460], [0.9, 0.9, 2.4]) }],
    };
  });
  const ripple2Style = useAnimatedStyle(() => {
    const time = clock.get();
    return {
      opacity: track(time, [0, 1710, 1770, 2700], [0, 0, 0.45, 0]),
      transform: [{ scale: track(time, [0, 1710, 2700], [0.9, 0.9, 2.9]) }],
    };
  });
  const copyStyle = useAnimatedStyle(() => {
    const time = clock.get();
    return { opacity: track(time, [0, 1680, 2160], [0, 0, 1]), transform: [{ translateY: track(time, [0, 1680, 2160], [18, 18, 0]) }] };
  });
  const buttonStyle = useAnimatedStyle(() => {
    const time = clock.get();
    return { opacity: track(time, [0, 2160, 2580], [0, 0, 1]), transform: [{ translateY: track(time, [0, 2160, 2580], [12, 12, 0]) }] };
  });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/tickets'));
  const shape = outline(width, height, cut);

  return (
    <View style={styles.screen}>
      {/* The cover's light behind, and the green that rises from below. */}
      <TicketGlow id="valid" colors={ticket?.event.palette ?? []} x={0.3} y={screenHeight * 0.32} style={glowStyle} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, washStyle]}>
        <Svg width={screenWidth} height={screenHeight}>
          <Defs>
            <RadialGradient id="validWash" cx="50%" cy="100%" rx="70%" ry="45%" fx="50%" fy="100%">
              <Stop offset="0" stopColor={VALID} stopOpacity={0.22} />
              <Stop offset="1" stopColor={VALID} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={screenWidth} height={screenHeight} fill="url(#validWash)" />
        </Svg>
      </Animated.View>

      {ticket && (
        <Animated.View pointerEvents="none" style={[styles.tear, { top, left: (screenWidth - width) / 2, width, height }, pressStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [cut, 0, 0] }, stubStyle]}>
            <TicketView piece="stub" event={ticket.event} status="active" qrValue="hanet://ticket/validada" size="large" width={width} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, halfStyle]}>
            <TicketView piece="info" event={ticket.event} status="active" number={ticket.number} cap={ticket.event.cap} size="large" width={width} />
          </Animated.View>
          <View style={[StyleSheet.absoluteFill, styles.sheenClip]}>
            <Animated.View style={[styles.sheen, { height: height + 40 }, sheenStyle]}>
              <Svg width={90} height={height + 40}>
                <Defs>
                  <LinearGradient id="validSheen" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                    <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.28} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={90} height={height + 40} fill="url(#validSheen)" />
              </Svg>
            </Animated.View>
          </View>
          {!traced && (
            <Animated.View style={[styles.trace, { width: width + 8, height: height + 8 }, traceStyle]}>
              <Svg width={width + 8} height={height + 8} viewBox={`-4 -4 ${width + 8} ${height + 8}`}>
                <AnimatedPath d={shape} fill="none" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" strokeDasharray={[5 * unit, 120 * unit]} opacity={0.25} animatedProps={trace1Glow} />
                <AnimatedPath d={shape} fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[5 * unit, 120 * unit]} animatedProps={trace1} />
                <AnimatedPath d={shape} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeDasharray={[12 * unit, 113 * unit]} opacity={0.55} animatedProps={trace2} />
                <AnimatedPath d={shape} fill="none" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" strokeDasharray={[24 * unit, 101 * unit]} opacity={0.22} animatedProps={trace3} />
              </Svg>
            </Animated.View>
          )}
        </Animated.View>
      )}

      <View pointerEvents="none" style={[styles.ringArea, { top: screenHeight / 2 + 10 - RING / 2, left: screenWidth / 2 - RING / 2 }]}>
        <Animated.View style={[styles.ripple, styles.ripple1, ripple1Style]} />
        <Animated.View style={[styles.ripple, styles.ripple2, ripple2Style]} />
        <Animated.View style={[styles.check, checkStyle]}>
          <Svg width={52} height={52} viewBox="0 0 24 24">
            <AnimatedPath d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={AppColors.textPrimary} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[20, 20]} animatedProps={tickProps} />
          </Svg>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.copy, { top: screenHeight * (510 / CANVAS_HEIGHT) }, copyStyle]}
        accessible
        accessibilityLiveRegion="assertive"
        accessibilityLabel={t('tickets.validated.entradaValidaTeDamosLa', { title: ticket?.event.title ?? 'tu evento' })}
      >
        <ThemedText style={styles.label}>{t('tickets.scan.entradaValida')}</ThemedText>
        <ThemedText style={styles.title}>{t('tickets.validated.teDamosLaBienvenidaATitle', { title: ticket?.event.title ?? '' })}</ThemedText>
        {!!ticket && <ThemedText style={styles.text}>{[ticket.event.venueName, when.time].filter(Boolean).join(' · ')}</ThemedText>}
      </Animated.View>

      <SafeAreaView style={styles.bottomArea} edges={['bottom']} pointerEvents="box-none">
        <Animated.View style={[styles.bottom, buttonStyle]}>
          <HanetButton label={t('common.listo')} variant="surface" onPress={close} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas, overflow: 'hidden' },
  tear: { position: 'absolute' },
  sheenClip: { borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden' },
  sheen: { position: 'absolute', top: -20, left: 0, width: 90 },
  trace: { position: 'absolute', left: -4, top: -4 },
  ringArea: { position: 'absolute', width: RING, height: RING },
  ripple: { position: 'absolute', left: 0, top: 0, width: RING, height: RING, borderRadius: 999, borderColor: VALID },
  ripple1: { borderWidth: 2 },
  ripple2: { borderWidth: 1.5 },
  check: { width: RING, height: RING, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: VALID },
  copy: { position: 'absolute', left: AppSpacing.xl, right: AppSpacing.xl, alignItems: 'center', gap: AppSpacing.sm },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, lineHeight: 20, color: VALID, textAlign: 'center' },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -1, color: AppColors.textPrimary, textAlign: 'center' },
  text: { ...AppType.callout, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary, textAlign: 'center' },
  bottomArea: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bottom: { paddingHorizontal: AppSpacing.lg, paddingBottom: AppSpacing.lg },
});
