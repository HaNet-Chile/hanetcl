import { ThemedText } from '@/components/themed-text';
import { TicketView, ticketWhen } from '@/components/tickets/ticket';
import { TicketGlow } from '@/components/tickets/ticket-glow';
import { Tilt } from '@/components/tickets/tilt';
import { demoCount, demoGiftPreview, demoQr } from '@/components/showcase/ticket-demo';
import { HanetButton } from '@/components/ui/hanet-button';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError, useSession } from '@/services/auth-service';
import { acceptGift, giftToken, openGuestTicket, previewGift, ticketQrValue } from '@/services/tickets-service';
import type { GiftPreview, GuestTicket } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { LINEAR, track } from '@/components/tickets/timeline';
import type { Ease } from '@/components/tickets/timeline';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Recibir una entrada regalada (canvas, board Recibir; iOS first): the
// ticket floats at the top, outside the sheet, and leans with the phone. Until
// it is accepted its stub shows a blurred placeholder QR with "Por aceptar"
// (the real code never reaches this phone before). The sheet holds only the
// information and "Aceptar entrada". Opened from the link
// https://app.hanet.muxp.art/tickets/receive?t=<token> (or hanetcl://).

// The canvas keyframes (board Recibir): the sheet rises as a material in
// 440 ms, the ticket drops in from above 120 ms later and settles with a small
// bounce (820 ms), and accepting makes it hop once (520 ms).
const SHEET: Ease = [0.2, 0.9, 0.3, 1];
const DROP: Ease = [0.2, 0.8, 0.35, 1];
const HOP: Ease = [0.3, 1.4, 0.5, 1];

function clock(ms: number) {
  const date = new Date(ms);
  return `${date.getDate()}/${date.getMonth() + 1}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function ReceiveTicketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { user, initializing } = useSession();
  const params = useLocalSearchParams<{ t?: string; demo?: string }>();
  // Sistema HaNet UI opens it with ?demo=1: a made-up gift, accepted on the phone only.
  const demo = demoCount(params.demo) > 0;
  const token = giftToken(params.t);
  const [preview, setPreview] = useState<GiftPreview | null>(() => (demo ? demoGiftPreview() : null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<{ id: string; qr: string | null } | null>(null);
  const enter = useSharedValue(reducedMotion ? 1000 : 0);
  const hop = useSharedValue(reducedMotion ? 520 : 0);
  // Without an account: a guest's link opens as the ticket itself.
  const [guest, setGuest] = useState<GuestTicket | null>(null);
  const guestTicket = guest && !guest.account ? guest : null;
  const shown = preview ?? guestTicket;
  const ready = !!shown;

  useEffect(() => {
    if (!ready || reducedMotion) return;
    enter.set(withTiming(1000, { duration: 1000, easing: Easing.linear }));
  }, [enter, ready, reducedMotion]);

  useEffect(() => {
    if (!accepted || reducedMotion) return;
    hop.set(0);
    hop.set(withTiming(520, { duration: 520, easing: Easing.linear }));
  }, [accepted, hop, reducedMotion]);

  const sheetStyle = useAnimatedStyle(() => {
    const time = enter.get();
    return {
      opacity: track(time, [0, 440], [0, 1], [SHEET]),
      transform: [{ translateY: track(time, [0, 440], [90, 0], [SHEET]) }, { scale: track(time, [0, 440], [0.97, 1], [SHEET]) }],
    };
  });
  const lightStyle = useAnimatedStyle(() => ({ opacity: track(enter.get(), [0, 360], [0, 1]) }));
  const dropStyle = useAnimatedStyle(() => {
    const time = enter.get() - 120;
    const times = [0, 451, 640, 820];
    const eases: Ease[] = [DROP, LINEAR, LINEAR];
    const lift = hop.get();
    return {
      opacity: track(time, [0, 164], [0, 1], [DROP]),
      transform: [
        { translateY: track(time, times, [-260, 10, -3, 0], eases) + track(lift, [0, 182, 520], [0, -14, 0], [HOP, HOP]) },
        { rotate: `${track(time, times, [-4, 1, -0.3, 0], eases)}deg` },
        { scale: track(time, times, [0.92, 1, 1, 1], eases) * track(lift, [0, 182, 520], [1, 1.03, 1], [HOP, HOP]) },
      ],
    };
  });

  useEffect(() => {
    if (demo || !user || !token) return;
    let active = true;
    previewGift(token)
      .then(result => { if (active) setPreview(result); })
      .catch(failure => { if (active) setError(describeAuthError(failure, t('tickets.receive.noPudimosAbrirEsteLink'))); });
    return () => { active = false; };
  }, [demo, token, user]);

  useEffect(() => {
    if (demo || initializing || user || !token) return;
    let active = true;
    openGuestTicket(token)
      .then(result => { if (active) setGuest(result); })
      .catch(failure => { if (active) setError(describeAuthError(failure, t('tickets.receive.noPudimosAbrirEsteLink'))); });
    return () => { active = false; };
  }, [demo, initializing, token, user]);

  const accept = async () => {
    if (demo) {
      setAccepted({ id: 'demo', qr: demoQr() });
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      return;
    }
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { ticketId } = await acceptGift(token);
      const qr = await ticketQrValue(ticketId);
      setAccepted({ id: ticketId, qr });
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (failure) {
      setError(describeAuthError(failure, t('tickets.receive.noPudimosAceptarLaEntrada')));
    } finally {
      setBusy(false);
    }
  };

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const sheetBody = (() => {
    if (initializing && !demo) return <ActivityIndicator color={AppColors.textSecondary} />;
    if (!token && !demo) return <ThemedText style={styles.lead}>{t('tickets.receive.esteLinkNoEsDe')}</ThemedText>;
    if (!user && !demo && guestTicket) {
      const used = guestTicket.ticket.status === 'used';
      const when = ticketWhen(guestTicket.event.startsAt);
      const guestRows = [
        { icon: 'person-outline' as const, label: t('tickets.detail.aNombreDe'), value: guestTicket.ticket.holderName },
        { icon: 'calendar-outline' as const, label: t('createEvent.fechaYHora'), value: [when.date, when.time].filter(Boolean).join(', ') },
        { icon: 'location-outline' as const, label: t('anniversary.activity.lugar'), value: [guestTicket.event.venueName, guestTicket.event.address].filter(Boolean).join(' · ') },
        { icon: 'shirt-outline' as const, label: t('tickets.detail.indicaciones'), value: guestTicket.event.note },
        { icon: 'megaphone-outline' as const, label: t('tickets.detail.organiza'), value: guestTicket.event.authorName },
      ].filter(row => !!row.value);
      return (
        <>
          <ThemedText style={styles.title}>{t('tickets.receive.tuEntradaParaTitle', { title: guestTicket.event.title })}</ThemedText>
          <ThemedText style={styles.lead}>{used ? t('tickets.receive.estaEntradaYaSeUso') : t('tickets.receive.muestraEsteQrEnLaPuerta')}</ThemedText>
          <View style={styles.card}>
            {guestRows.map((row, index) => (
              <View key={row.label} style={[styles.row, index > 0 && styles.rowLine]}>
                <Ionicons name={row.icon} size={20} color={AppColors.textSecondary} />
                <View style={styles.rowCopy}>
                  <ThemedText style={styles.rowLabel}>{row.label}</ThemedText>
                  <ThemedText style={styles.rowValue}>{row.value}</ThemedText>
                </View>
              </View>
            ))}
          </View>
          <ThemedText style={styles.lead}>{t('tickets.receive.codigoCode', { code: guestTicket.code })}</ThemedText>
        </>
      );
    }
    if (!user && !demo && error) {
      return (
        <>
          <ThemedText style={styles.lead}>{error}</ThemedText>
          <HanetButton label={t('common.iniciarSesion')} variant="surface" onPress={() => router.push('/auth')} />
        </>
      );
    }
    if (!user && !demo && !guest) return <ActivityIndicator color={AppColors.textSecondary} />;
    if (!user && !demo) {
      return (
        <>
          <ThemedText style={styles.title}>{t('tickets.receive.teRegalaronUnaEntrada')}</ThemedText>
          <ThemedText style={styles.lead}>{t('tickets.receive.paraRecibirlaNecesitasUnaCuenta')}</ThemedText>
          <HanetButton label={t('common.iniciarSesion')} variant="accent" onPress={() => router.push('/auth')} />
        </>
      );
    }
    if (error && !preview) {
      return (
        <>
          <ThemedText style={styles.lead}>{error}</ThemedText>
          <HanetButton label={t('common.volver')} variant="surface" onPress={leave} />
        </>
      );
    }
    if (!preview) return <ActivityIndicator color={AppColors.textSecondary} />;
    const rows = [
      { icon: 'gift-outline' as const, label: t('tickets.detail.deParteDe'), value: preview.fromName || 'Quien organiza el evento' },
      { icon: 'megaphone-outline' as const, label: t('tickets.detail.organiza'), value: preview.organizer },
      { icon: 'time-outline' as const, label: t('tickets.receive.elLinkVence'), value: preview.ticket.linkExpiresAt ? clock(preview.ticket.linkExpiresAt) : '' },
    ].filter(row => !!row.value);
    return (
      <>
        <ThemedText style={styles.title}>{accepted ? t('tickets.receive.laEntradaEsTuya') : t('tickets.receive.teRegalaronUnaEntrada')}</ThemedText>
        <ThemedText style={styles.lead}>
          {accepted
            ? t('tickets.receive.yaEstaEnTuPerfil')
            : preview.mine
              ? t('tickets.receive.estaEntradaEsTuyaEnvia')
              : t('tickets.receive.alAceptarlaPasaATu')}
        </ThemedText>
        {!accepted && (
          <View style={styles.card}>
            {rows.map((row, index) => (
              <View key={row.label} style={[styles.row, index > 0 && styles.rowLine]}>
                <Ionicons name={row.icon} size={20} color={AppColors.textSecondary} />
                <View style={styles.rowCopy}>
                  <ThemedText style={styles.rowLabel}>{row.label}</ThemedText>
                  <ThemedText style={styles.rowValue}>{row.value}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}
        {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
        {accepted ? (
          <HanetButton label={t('tickets.receive.verMiEntrada')} variant="accent" onPress={() => router.replace({ pathname: '/tickets/detail', params: demo ? { demo: '1' } : { id: accepted.id } })} />
        ) : preview.mine ? (
          <HanetButton label={t('common.volver')} variant="surface" onPress={leave} />
        ) : (
          <HanetButton label={busy ? t('tickets.receive.aceptando') : t('tickets.receive.aceptarEntrada')} variant="accent" disabled={busy} onPress={() => void accept()} />
        )}
      </>
    );
  })();

  const glass = Platform.OS === 'ios';
  return (
    <View style={styles.screen}>
      {/* The cover's light at the top, behind the ticket. */}
      <TicketGlow id="receive" colors={shown?.event.palette ?? []} y={insets.top + 150} style={lightStyle} />
      <View style={[styles.top, { paddingTop: insets.top + 70 }]}>
        {guestTicket && !preview && (
          <Animated.View style={dropStyle}>
            <Tilt>
              <TicketView
                event={guestTicket.event}
                status={guestTicket.ticket.status === 'used' ? 'used' : 'active'}
                qrValue={guestTicket.qr}
                number={guestTicket.ticket.number}
                cap={guestTicket.event.cap}
                size="large"
              />
            </Tilt>
          </Animated.View>
        )}
        {preview && (
          <Animated.View style={dropStyle}>
            <Tilt>
              <TicketView
                event={preview.event}
                status={accepted ? 'active' : 'pending'}
                qrValue={accepted?.qr ?? null}
                number={preview.ticket.number}
                cap={preview.event.cap}
                size="large"
              />
            </Tilt>
          </Animated.View>
        )}
      </View>
      <Animated.View style={[styles.sheet, !glass && styles.sheetSolid, { paddingBottom: insets.bottom + AppSpacing.lg }, sheetStyle]}>
        {glass && <BlurView intensity={60} tint="systemChromeMaterialDark" style={StyleSheet.absoluteFill} />}
        <View style={styles.grabber} />
        <View style={styles.sheetContent}>{sheetBody}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  top: { alignItems: 'center', paddingHorizontal: AppSpacing.lg },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: '52%',
    overflow: 'hidden',
    borderTopLeftRadius: AppRadii.xl,
    borderTopRightRadius: AppRadii.xl,
    borderCurve: 'continuous',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.separator,
  },
  sheetSolid: { backgroundColor: AppColors.surface },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 999, marginTop: AppSpacing.sm, backgroundColor: AppColors.separator },
  sheetContent: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: AppSpacing.lg, paddingTop: AppSpacing.xl, gap: AppSpacing.lg },
  title: { ...AppType.title2, color: AppColors.textPrimary },
  lead: { ...AppType.callout, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary },
  card: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.canvas, paddingHorizontal: AppSpacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: AppSpacing.md, paddingVertical: AppSpacing.md },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  rowCopy: { flex: 1 },
  rowLabel: { ...AppType.caption, color: AppColors.textSecondary },
  rowValue: { ...AppType.callout, color: AppColors.textPrimary },
  error: { ...AppType.footnote, color: AppColors.errorText },
});
