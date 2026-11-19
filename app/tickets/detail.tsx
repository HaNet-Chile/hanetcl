import { DEMO_SHARE, demoCount, demoQr, demoTickets } from '@/components/showcase/ticket-demo';
import { ScreenshotGuard } from '@/components/system/screenshot-guard';
import { ThemedText } from '@/components/themed-text';
import { TicketView, ticketWhen } from '@/components/tickets/ticket';
import { TicketShareModal } from '@/components/tickets/ticket-share';
import type { ShareKind } from '@/components/tickets/ticket-share';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { withSheetFrame } from '@/components/ui/sheet-frame';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { useMyTickets } from '@/hooks/use-my-tickets';
import { describeAuthError } from '@/services/auth-service';
import { cancelGift, giftTicket, msToNextTicketCode, patchKeptTicket, shareTicket, ticketQrValue, watchTicketUsed } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// The ticket opened: a native sheet on iOS, the HaNet sheet on Android and
// the web, both on the surface color. Its QR changes by itself every 30 seconds, with no
// countdown (muxp: "se ve feo y estorba"). While it is open the screen
// listens to the ticket, so the moment it is read at the door the phone plays
// "Entrada válida" (app/tickets/validated.tsx).

function clock(ms: number) {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function TicketDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; demo?: string }>();
  // Sistema HaNet UI opens it with ?demo=1: a made-up ticket whose QR also
  // changes every 30 s, and "Simular lectura en la puerta" instead of Regalar.
  const demo = demoCount(params.demo) > 0;
  const [demoTicket] = useState(() => demoTickets(1)[0]);
  const id = demo ? demoTicket.id : params.id;
  const { tickets, failed } = useMyTickets();
  const ticket = demo ? demoTicket : tickets?.find(item => item.id === id) ?? null;
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ShareKind | null>(null);
  const [shared, setShared] = useState<{ kind: ShareKind; code: string; qr: string } | null>(null);
  const live = ticket?.status === 'active';

  // The changing QR, computed on the phone.
  useEffect(() => {
    if (!live || !id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const value = demo ? demoQr() : await ticketQrValue(id);
      if (!active) return;
      setQrValue(value);
      timer = setTimeout(() => void tick(), (value ? msToNextTicketCode() : 5000) + 50);
    };
    void tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [demo, id, live]);

  // The door: the instant the ticket is used, "Entrada válida".
  useEffect(() => {
    if (!live || !id || demo) return;
    return watchTicketUsed(id, usedAt => {
      patchKeptTicket(id, { status: 'used', usedAt });
      router.push({ pathname: '/tickets/validated', params: { id } });
    });
  }, [demo, id, live, router]);

  const run = async (action: () => Promise<void>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(describeAuthError(failure, fallback));
    } finally {
      setBusy(false);
    }
  };

  const gift = () => run(async () => {
    if (!ticket) return;
    const { url } = await giftTicket(ticket.id);
    await Share.share(Platform.OS === 'ios'
      ? { url, message: t('tickets.detail.teRegaloUnaEntradaPara', { title: ticket.event.title }) }
      : { message: t('tickets.detail.teRegaloUnaEntradaPara2', { title: ticket.event.title, url }) });
  }, t('tickets.detail.noPudimosCrearElLink'));

  const takeBack = () => run(async () => {
    if (ticket) await cancelGift(ticket.id);
  }, t('tickets.detail.noPudimosAnularElLink'));

  const share = (kind: ShareKind) => run(async () => {
    if (!ticket) return;
    setConfirm(null);
    const result = demo ? DEMO_SHARE : await shareTicket(ticket.id, kind);
    setShared({ kind, ...result });
  }, t('tickets.detail.noPudimosPrepararLaEntrada'));

  if (!ticket) {
    return (
      <View style={[styles.sheet, styles.center, { paddingBottom: insets.bottom + AppSpacing.lg }]}>
        {tickets === undefined && !failed ? (
          <ActivityIndicator color={AppColors.textSecondary} />
        ) : (
          <>
            <ThemedText style={styles.lead}>{t('tickets.detail.estaEntradaYaNoEsta')}</ThemedText>
            <HanetButton label={t('common.volver')} variant="surface" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }

  const when = ticketWhen(ticket.event.startsAt);
  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'calendar-outline', label: t('createEvent.fechaYHora'), value: [when.date, when.time].filter(Boolean).join(', ') },
    { icon: 'location-outline', label: t('anniversary.activity.lugar'), value: [ticket.event.venueName, ticket.event.address].filter(Boolean).join(' · ') },
    { icon: 'person-outline', label: t('tickets.detail.aNombreDe'), value: [ticket.holderName, ticket.courseId].filter(Boolean).join(' · ') },
    { icon: 'gift-outline', label: t('tickets.detail.deParteDe'), value: ticket.giftedFromName },
    { icon: 'shirt-outline', label: t('tickets.detail.indicaciones'), value: ticket.event.note },
    { icon: 'megaphone-outline', label: t('tickets.detail.organiza'), value: ticket.event.authorName },
  ].filter((row): row is { icon: keyof typeof Ionicons.glyphMap; label: string; value: string } => !!row.value);

  const statusLine = ticket.status === 'used'
    ? (ticket.usedAt ? t('tickets.detail.seUsoALasClock', { clock: clock(ticket.usedAt) }) : t('tickets.detail.estaEntradaYaSeUso'))
    : ticket.status === 'link'
      ? (ticket.linkExpiresAt ? t('tickets.detail.enviasteUnLinkParaRegalarla', { clock: clock(ticket.linkExpiresAt) }) : t('tickets.detail.enviasteUnLinkParaRegalarla2'))
      : ticket.status === 'shared'
        ? t('tickets.detail.laCompartisteComoImagenEsa')
        : ticket.status === 'printed'
          ? t('tickets.detail.laDescargasteParaImprimirEsa')
          : t('tickets.detail.muestraEsteQrEnLa');

  return (
    <View style={styles.sheet}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + AppSpacing.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.ticketWrap}>
          <TicketView event={ticket.event} status={ticket.status} qrValue={qrValue} number={ticket.number} cap={ticket.event.cap} size="large" />
        </View>
        <ThemedText accessibilityLiveRegion="polite" style={styles.lead}>{statusLine}</ThemedText>

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

        {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}

        <View style={styles.actions}>
          {demo && (
            <HanetButton label={t('tickets.detail.simularLecturaEnLaPuerta')} variant="accent" icon={<Ionicons name="scan-outline" size={18} color={AppColors.textPrimary} />} onPress={() => router.push({ pathname: '/tickets/validated', params: { demo: '1' } })} />
          )}
          {live && ticket.event.giftable && !demo && (
            <HanetButton label={t('tickets.detail.regalar')} variant="accent" disabled={busy} icon={<Ionicons name="gift-outline" size={18} color={AppColors.textPrimary} />} onPress={() => void gift()} />
          )}
          {ticket.status === 'link' && (
            <>
              <HanetButton label={t('tickets.detail.enviarUnLinkNuevo')} variant="accent" disabled={busy} onPress={() => void gift()} />
              <HanetButton label={t('tickets.detail.anularElLink')} variant="surface" disabled={busy} onPress={() => void takeBack()} />
            </>
          )}
          {live && (
            <HanetButton label={t('tickets.detail.compartirComoImagen')} variant="surface" disabled={busy} icon={<Ionicons name="image-outline" size={18} color={AppColors.textPrimary} />} onPress={() => setConfirm('image')} />
          )}
          {live && ticket.event.printable && (
            <HanetButton label={t('tickets.detail.descargarParaImprimir')} variant="surface" disabled={busy} icon={<Ionicons name="print-outline" size={18} color={AppColors.textPrimary} />} onPress={() => setConfirm('print')} />
          )}
          {(ticket.status === 'shared' || ticket.status === 'printed') && (
            <HanetButton
              label={ticket.status === 'printed' ? t('tickets.detail.descargarOtraVez') : t('tickets.detail.compartirOtraVez')}
              variant="surface"
              disabled={busy}
              onPress={() => void share(ticket.status === 'printed' ? 'print' : 'image')}
            />
          )}
        </View>
      </ScrollView>

      <HanetDialog visible={!!confirm} onRequestClose={() => setConfirm(null)} dismissOnBackdrop title={confirm === 'print' ? t('tickets.detail.descargarParaImprimir2') : t('tickets.detail.compartirComoImagen2')} body={confirm === 'print'
        ? t('tickets.detail.laEntradaSaleDeTu')
        : t('tickets.detail.laEntradaSaleDeTu2')}>
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" onPress={() => setConfirm(null)} style={dialogStyles.action} />
          <HanetButton label={t('tickets.detail.continuar')} variant="accent" onPress={() => confirm && void share(confirm)} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>

      <TicketShareModal ticket={shared ? ticket : null} kind={shared?.kind ?? 'image'} code={shared?.code ?? null} qr={shared?.qr ?? null} onClose={() => setShared(null)} />
      <ScreenshotGuard active={live} ticket />
    </View>
  );
}

const styles = StyleSheet.create({
  // The HaNet surface everywhere, painted here: on iOS the sheet itself stays
  // transparent (app/_layout.tsx), or its glass comes out white.
  sheet: { flex: 1, backgroundColor: AppColors.surface },
  center: { alignItems: 'center', justifyContent: 'center', gap: AppSpacing.lg, padding: AppSpacing.xl },
  content: { paddingTop: AppSpacing.xxl, paddingHorizontal: AppSpacing.lg, gap: AppSpacing.lg },
  ticketWrap: { alignItems: 'center' },
  lead: { ...AppType.callout, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary, textAlign: 'center' },
  card: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.canvas, paddingHorizontal: AppSpacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: AppSpacing.md, paddingVertical: AppSpacing.md },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  rowCopy: { flex: 1 },
  rowLabel: { ...AppType.caption, color: AppColors.textSecondary },
  rowValue: { ...AppType.callout, color: AppColors.textPrimary },
  error: { ...AppType.footnote, color: AppColors.errorText, textAlign: 'center' },
  actions: { gap: AppSpacing.sm },
});

export default withSheetFrame(TicketDetailScreen, AppColors.surface);
