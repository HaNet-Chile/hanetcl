import { ThemedText } from '@/components/themed-text';
import { TicketView } from '@/components/tickets/ticket';
import { Tilt } from '@/components/tickets/tilt';
import { HanetButton } from '@/components/ui/hanet-button';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError, useSession } from '@/services/auth-service';
import { acceptGift, giftToken, previewGift, ticketQrValue } from '@/services/tickets-service';
import type { GiftPreview } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Recibir una entrada regalada (canvas, board Recibir; iOS first): the
// ticket floats at the top, outside the sheet, and leans with the phone. Until
// it is accepted its stub shows a blurred placeholder QR with "Por aceptar"
// (the real code never reaches this phone before). The sheet holds only the
// information and "Aceptar entrada". Opened from the link
// https://hanet-app.web.app/tickets/receive?t=<token> (or hanetcl://).

function clock(ms: number) {
  const date = new Date(ms);
  return `${date.getDate()}/${date.getMonth() + 1}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function ReceiveTicketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { user, initializing } = useSession();
  const params = useLocalSearchParams<{ t?: string }>();
  const token = giftToken(params.t);
  const [preview, setPreview] = useState<GiftPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<{ id: string; qr: string | null } | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    let active = true;
    previewGift(token)
      .then(result => { if (active) setPreview(result); })
      .catch(failure => { if (active) setError(describeAuthError(failure, t('tickets.receive.noPudimosAbrirEsteLink'))); });
    return () => { active = false; };
  }, [token, user]);

  const accept = async () => {
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
    if (initializing) return <ActivityIndicator color={AppColors.textSecondary} />;
    if (!token) return <ThemedText style={styles.lead}>{t('tickets.receive.esteLinkNoEsDe')}</ThemedText>;
    if (!user) {
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
          <HanetButton label={t('tickets.receive.verMiEntrada')} variant="accent" onPress={() => router.replace({ pathname: '/tickets/detail', params: { id: accepted.id } })} />
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
      <View style={[styles.top, { paddingTop: insets.top + 64 }]}>
        {preview && (
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(260)}>
            <Tilt>
              <TicketView
                event={preview.event}
                status={accepted ? 'active' : 'pending'}
                qrValue={accepted?.qr ?? null}
                number={preview.ticket.number}
                cap={preview.event.cap}
              />
            </Tilt>
          </Animated.View>
        )}
      </View>
      <Animated.View entering={reducedMotion ? undefined : SlideInDown.springify().stiffness(260).damping(26)} style={[styles.sheet, !glass && styles.sheetSolid, { paddingBottom: insets.bottom + AppSpacing.lg }]}>
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
