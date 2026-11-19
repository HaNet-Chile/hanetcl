import { ThemedText } from '@/components/themed-text';
import { TicketView, ticketWhen } from '@/components/tickets/ticket';
import { HanetButton } from '@/components/ui/hanet-button';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import type { Ticket } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { ViewInstance } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import { t } from '@/i18n';

// The ticket outside the app: as an image to send (dark, like in the app) or
// on white paper to print (the "simple" style of the canvas: little ink, the
// institution's name, the perforation with scissors). Both carry a fixed code
// and the written one, for "Ingresar código" at the door; the first read wins.

export type ShareKind = 'image' | 'print';

const PRINT_WIDTH = 680;
const PRINT_HEIGHT = 240;
const INK = '#282829';
const INK_SOFT = '#6B6A70';
const PAPER = '#FFFFFF';

type Props = {
  ticket: Ticket | null;
  kind: ShareKind;
  code: string | null;
  qr: string | null;
  onClose: () => void;
};

export function TicketShareModal({ ticket, kind, code, qr, onClose }: Props) {
  const card = useRef<ViewInstance>(null);
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visible = !!ticket && !!code && !!qr;
  const printScale = Math.min(1, (width - AppSpacing.lg * 2) / PRINT_WIDTH);

  const share = async () => {
    if (!card.current || busy) return;
    if (Platform.OS === 'web') {
      window.print();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) throw new Error('unavailable');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: kind === 'print' ? t('components.tickets.ticketShare.guardarParaImprimir') : t('components.tickets.ticketShare.compartirEntrada') });
      onClose();
    } catch {
      setError(t('components.tickets.ticketShare.noPudimosPrepararLaImagen'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={styles.overlay}>
        {visible && kind === 'image' && (
          <View ref={card} collapsable={false} style={styles.imageCard} accessible accessibilityLabel={t('components.tickets.ticketShare.vistaPreviaDeLaEntrada')}>
            <TicketView event={ticket.event} status="active" qrValue={qr} number={ticket.number} cap={ticket.event.cap} size="large" width={340} />
            <View style={styles.imageFoot}>
              <ThemedText style={styles.imageCode}>{code}</ThemedText>
              <ThemedText style={styles.imageNote}>{t('components.tickets.ticketShare.valeUnaVezSeAnula')}</ThemedText>
            </View>
          </View>
        )}
        {visible && kind === 'print' && (
          <View style={{ width: PRINT_WIDTH * printScale, height: PRINT_HEIGHT * printScale }}>
            <View style={{ width: PRINT_WIDTH, height: PRINT_HEIGHT, transform: [{ scale: printScale }], transformOrigin: t('components.share.storyShare.topLeft') }}>
              <View ref={card} collapsable={false} accessible accessibilityLabel={t('components.tickets.ticketShare.vistaPreviaDeLaEntrada2')}>
                <PrintedTicket ticket={ticket} code={code} qr={qr} />
              </View>
            </View>
          </View>
        )}
        <ThemedText style={styles.hint}>
          {kind === 'print'
            ? t('components.tickets.ticketShare.desdeAhoraTuEntradaEs')
            : t('components.tickets.ticketShare.desdeAhoraTuEntradaEs2')}
        </ThemedText>
        {!!error && <ThemedText accessibilityLiveRegion="assertive" style={styles.error}>{error}</ThemedText>}
        <View style={styles.buttons}>
          <HanetButton label={t('common.cerrar')} variant="surface" disabled={busy} onPress={onClose} style={styles.button} />
          <HanetButton
            label={busy ? t('components.tickets.ticketShare.preparando') : Platform.OS === 'web' ? t('components.tickets.ticketShare.imprimir') : kind === 'print' ? t('common.guardar') : t('common.compartir')}
            variant="accent"
            disabled={busy}
            onPress={() => void share()}
            style={styles.button}
          />
        </View>
      </View>
    </Modal>
  );
}

/** The paper ticket, 17 × 6 cm at 40 points per cm. */
export function PrintedTicket({ ticket, code, qr }: { ticket: Ticket; code: string; qr: string }) {
  const when = ticketWhen(ticket.event.startsAt);
  const stub = 200;
  return (
    <View style={print.paper}>
      <View style={print.info}>
        <View style={print.school}>
          <View style={print.crest}><Ionicons name="school-outline" size={18} color={INK} /></View>
          <ThemedText numberOfLines={1} style={print.schoolName}>{ticket.event.institutionName || 'Tu institución'}</ThemedText>
        </View>
        <ThemedText numberOfLines={2} style={print.title}>{ticket.event.title}</ThemedText>
        <View style={print.meta}>
          {!!when.date && <PrintMeta label={t('eventInfo.fecha')} value={when.date} />}
          {!!when.time && <PrintMeta label={t('components.ui.hanetDateTimePicker.hora')} value={when.time} />}
          {!!ticket.event.venueName && <PrintMeta label={t('anniversary.activity.lugar')} value={ticket.event.venueName} />}
        </View>
        <ThemedText style={print.small}>
          {[ticket.number ? (ticket.event.cap ? `N.º ${ticket.number} de ${ticket.event.cap}` : `N.º ${ticket.number}`) : '', t('components.tickets.ticketShare.seAnulaAlPrimerUso')].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>
      <View style={[print.perforation, { right: stub }]}>
        <Ionicons name="cut-outline" size={14} color={INK_SOFT} style={print.scissors} />
      </View>
      <View style={[print.stub, { width: stub }]}>
        <QRCode value={qr} size={132} color={INK} backgroundColor={PAPER} ecl="M" />
        <ThemedText style={print.code}>{code}</ThemedText>
        <ThemedText style={print.brand}>HaNet</ThemedText>
      </View>
    </View>
  );
}

function PrintMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={print.metaItem}>
      <ThemedText style={print.metaLabel}>{label}</ThemedText>
      <ThemedText numberOfLines={1} style={print.metaValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: AppSpacing.lg, padding: AppSpacing.lg, backgroundColor: AppColors.scrim },
  imageCard: { padding: 24, paddingTop: 32, borderRadius: 32, borderCurve: 'continuous', backgroundColor: AppColors.canvas, alignItems: 'center', gap: AppSpacing.lg },
  imageFoot: { alignItems: 'center', gap: 2 },
  imageCode: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 22, lineHeight: 28, letterSpacing: 2 },
  imageNote: { ...AppType.footnote, color: AppColors.textSecondary },
  hint: { ...AppType.footnote, color: AppColors.textPrimary, textAlign: 'center', maxWidth: 340 },
  error: { ...AppType.footnote, color: AppColors.errorText, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: AppSpacing.sm, width: '100%', maxWidth: 360 },
  button: { flex: 1 },
});

const print = StyleSheet.create({
  paper: { width: PRINT_WIDTH, height: PRINT_HEIGHT, flexDirection: 'row', backgroundColor: PAPER, borderWidth: 1, borderColor: '#D7D6DC' },
  info: { flex: 1, paddingVertical: 22, paddingHorizontal: 26, justifyContent: 'space-between' },
  school: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crest: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  schoolName: { color: INK, fontFamily: 'DMSans_700Bold', fontSize: 14, lineHeight: 18, flexShrink: 1 },
  title: { color: INK, fontFamily: 'DMSans_700Bold', fontSize: 30, lineHeight: 34, letterSpacing: -1 },
  meta: { flexDirection: 'row', gap: 24 },
  metaItem: { flexShrink: 1 },
  metaLabel: { color: INK_SOFT, fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 15 },
  metaValue: { color: INK, fontFamily: 'DMSans_700Bold', fontSize: 16, lineHeight: 20 },
  small: { color: INK_SOFT, fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 15 },
  perforation: { position: 'absolute', top: 0, bottom: 0, borderLeftWidth: 1.5, borderStyle: 'dashed', borderColor: '#A9A8AE' },
  scissors: { position: 'absolute', top: -2, left: -8, backgroundColor: PAPER },
  stub: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  code: { color: INK, fontFamily: 'DMSans_700Bold', fontSize: 16, lineHeight: 20, letterSpacing: 2 },
  brand: { color: INK_SOFT, fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 12 },
});
