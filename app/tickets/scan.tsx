import { ThemedText } from '@/components/themed-text';
import { HanetField } from '@/components/ui/hanet-auth-fields';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { getEvent, getLoadedEvent } from '@/services/events-service';
import { validateTicket } from '@/services/tickets-service';
import type { DoorResult } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Escáner en la puerta (canvas, board Escáner): CEE, Admin, HNT and the
// docentes they authorize read each ticket at the door: the QR of the app
// (it changes every 30 s), a shared or printed one, a code typed by hand, or
// a HN-QR (that shows the account's tickets for this event). The first read
// wins; any copy afterwards answers "Esta entrada ya se usó".
// Opened as /tickets/scan?eventId=<id> (also from Organizar).

const SAME_QR_MS = 4000;
const VALID_BACK_MS = 2200;
const VALID = '#30D158';

type Mode =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string }
  | { kind: 'door'; result: DoorResult };

export default function TicketScanScreen() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [title, setTitle] = useState(() => (eventId ? getLoadedEvent(eventId)?.title : undefined) ?? '');
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [count, setCount] = useState<{ count: number; total: number } | null>(null);
  const [torch, setTorch] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const busy = useRef(false);
  const last = useRef<{ value: string; at: number } | null>(null);
  const lock = useSharedValue(0);

  useEffect(() => {
    if (!eventId || title) return;
    getEvent(eventId).then(event => setTitle(event.title)).catch(() => undefined);
  }, [eventId, title]);

  // A valid ticket goes back to scanning by itself.
  useEffect(() => {
    if (mode.kind !== 'door' || mode.result.result !== 'valid') return;
    const timer = setTimeout(() => {
      lock.set(withTiming(0, { duration: 160 }));
      setMode({ kind: 'idle' });
    }, VALID_BACK_MS);
    return () => clearTimeout(timer);
  }, [lock, mode]);

  const haptic = (type: Haptics.NotificationFeedbackType) => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(type).catch(() => undefined);
  };

  const read = async (input: { qr?: string; ticketId?: string }) => {
    if (!eventId || busy.current) return;
    busy.current = true;
    setMode({ kind: 'busy' });
    try {
      const result = await validateTicket({ eventId, ...input });
      setCount({ count: result.count, total: result.total });
      setMode({ kind: 'door', result });
      lock.set(reducedMotion ? 1 : withSequence(withTiming(1, { duration: 120 }), withSpring(1)));
      haptic(result.result === 'valid' ? Haptics.NotificationFeedbackType.Success : result.result === 'used' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      setMode({ kind: 'error', message: describeAuthError(error, t('tickets.scan.noPudimosLeerEsaEntrada')) });
      haptic(Haptics.NotificationFeedbackType.Error);
    } finally {
      busy.current = false;
    }
  };

  const scanned = (value: string) => {
    if (mode.kind !== 'idle') return;
    const now = Date.now();
    if (last.current && last.current.value === value && now - last.current.at < SAME_QR_MS) return;
    last.current = { value, at: now };
    void read({ qr: value });
  };

  const resume = () => {
    lock.set(withTiming(0, { duration: 160 }));
    setMode({ kind: 'idle' });
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const submitTyped = () => {
    const code = typed.trim();
    setTyping(false);
    setTyped('');
    if (code) void read({ qr: code });
  };

  const tone = mode.kind === 'door'
    ? mode.result.result === 'valid' ? 'valid' : mode.result.result === 'used' ? 'used' : 'account'
    : mode.kind === 'error' ? 'used' : 'idle';
  const finderStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - lock.get() * 0.3 }] }));
  const finderColor = tone === 'valid' ? VALID : tone === 'used' ? AppColors.accent : AppColors.textPrimary;
  const camera = Platform.OS !== 'web' && permission?.granted;

  if (Platform.OS !== 'web' && !permission?.granted) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ThemedText style={styles.centerTitle}>{t('tickets.scan.hanetNecesitaLaCamaraPara')}</ThemedText>
        <ThemedText style={styles.centerText}>{t('tickets.scan.soloSeUsaMientrasEscaneas')}</ThemedText>
        {permission && !permission.canAskAgain ? (
          <HanetButton label={t('tickets.scan.abrirAjustes')} variant="accent" onPress={() => void Linking.openSettings()} />
        ) : (
          <HanetButton label={t('eventCheckin.permitirLaCamara')} variant="accent" onPress={() => void requestPermission()} />
        )}
        <HanetButton label={t('tickets.scan.ingresarCodigo')} variant="surface" onPress={() => setTyping(true)} />
        <HanetButton label={t('common.volver')} variant="surface" onPress={close} />
        <CodeDialog visible={typing} value={typed} onChange={setTyped} onCancel={() => setTyping(false)} onSubmit={submitTyped} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      {camera && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => scanned(data)}
        />
      )}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('eventCheckin.terminar')} onPress={close} style={({ pressed }) => [styles.round, pressed && AppPressed]}>
            <Ionicons name="close" size={22} color={AppColors.textPrimary} />
          </Pressable>
          <View style={styles.counter}>
            <ThemedText numberOfLines={1} style={styles.counterTitle}>{title || 'Entradas'}</ThemedText>
            {count && <ThemedText style={styles.counterText}>{t('tickets.scan.llegaronCountvalueDeTotal', { countValue: count.count, total: count.total })}</ThemedText>}
          </View>
          {camera && (
            <Pressable accessibilityRole="button" accessibilityLabel={torch ? t('tickets.scan.apagarLaLinterna') : t('tickets.scan.encenderLaLinterna')} accessibilityState={{ selected: torch }} onPress={() => setTorch(value => !value)} style={({ pressed }) => [styles.round, torch && styles.roundOn, pressed && AppPressed]}>
              <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color={torch ? AppColors.controlOnActive : AppColors.textPrimary} />
            </Pressable>
          )}
        </View>

        {camera ? (
          <Animated.View style={[styles.finder, finderStyle]} accessible accessibilityLabel={t('tickets.scan.apuntaAlQrDeLa')}>
            {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
              <View key={corner} style={[styles.corner, styles[corner], { borderColor: finderColor }]} />
            ))}
          </Animated.View>
        ) : (
          <ThemedText style={styles.webNote}>{t('tickets.scan.enElComputadorNoSe')}</ThemedText>
        )}

        <View style={styles.bottom}>
          {mode.kind === 'door' || mode.kind === 'error' ? (
            <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(140)} exiting={reducedMotion ? undefined : FadeOut.duration(120)}>
              <ResultCard mode={mode} onResume={resume} onValidate={ticketId => void read({ ticketId })} />
            </Animated.View>
          ) : (
            <ThemedText style={styles.hint}>{mode.kind === 'busy' ? t('tickets.scan.revisando') : t('tickets.scan.pideQueAbranSuEntrada')}</ThemedText>
          )}
          <HanetButton label={t('tickets.scan.ingresarCodigo')} variant="surface" icon={<Ionicons name="keypad-outline" size={18} color={AppColors.textPrimary} />} onPress={() => setTyping(true)} />
        </View>
      </SafeAreaView>
      <CodeDialog visible={typing} value={typed} onChange={setTyped} onCancel={() => setTyping(false)} onSubmit={submitTyped} />
    </View>
  );
}

function ResultCard({ mode, onResume, onValidate }: { mode: Mode; onResume: () => void; onValidate: (ticketId: string) => void }) {
  if (mode.kind === 'error') {
    return (
      <View style={[styles.card, styles.cardUsed]}>
        <CardHead icon="alert-circle" color={AppColors.accent} title={t('tickets.scan.noSirve')} text={mode.message} />
        <HanetButton label={t('tickets.scan.seguirEscaneando')} variant="surface" onPress={onResume} />
      </View>
    );
  }
  if (mode.kind !== 'door') return null;
  const result = mode.result;
  if (result.result === 'account') {
    const usable = result.tickets.filter(ticket => ticket.status !== 'used' && ticket.status !== 'voided' && ticket.status !== 'link');
    return (
      <View style={styles.card}>
        <CardHead icon="person-circle" color={AppColors.textPrimary} title={result.name} text={[result.courseId, result.tickets.length ? t('tickets.scan.ticketscountEntradasEnEstaCuenta', { ticketsCount: result.tickets.length }) : t('tickets.scan.sinEntradasParaEsteEvento')].filter(Boolean).join(' · ')} />
        {result.tickets.map(ticket => (
          <View key={ticket.ticketId} style={styles.accountRow}>
            <ThemedText style={styles.accountNumber}>{ticket.number ? `N.º ${ticket.number}` : t('tickets.scan.entrada')}</ThemedText>
            <ThemedText style={styles.accountStatus}>{ticket.status === 'used' ? t('tickets.scan.usada') : ticket.status === 'link' ? t('tickets.scan.regaladaSinAceptar') : t('tickets.scan.sinUsar')}</ThemedText>
          </View>
        ))}
        {usable[0] && <HanetButton label={t('tickets.scan.validarEntrada')} variant="accent" onPress={() => onValidate(usable[0].ticketId)} />}
        <HanetButton label={t('tickets.scan.seguirEscaneando')} variant="surface" onPress={onResume} />
      </View>
    );
  }
  const ticket = result.ticket;
  const who = [ticket.holderName, ticket.courseId].filter(Boolean).join(' · ');
  if (result.result === 'valid') {
    return (
      <View style={[styles.card, styles.cardValid]}>
        <CardHead icon="checkmark-circle" color={VALID} title={t('tickets.scan.entradaValida')} text={[who, ticket.number ? `N.º ${ticket.number}` : ''].filter(Boolean).join(' · ')} />
      </View>
    );
  }
  const at = ticket.usedAt ? new Date(ticket.usedAt) : null;
  return (
    <View style={[styles.card, styles.cardUsed]}>
      <CardHead
        icon="close-circle"
        color={AppColors.accent}
        title={t('tickets.scan.estaEntradaYaSeUso')}
        text={[who, at ? t('tickets.scan.entroALasHoursMinutes', { hours: String(at.getHours()).padStart(2, '0'), minutes: String(at.getMinutes()).padStart(2, '0') }) : ''].filter(Boolean).join(' · ')}
      />
      <HanetButton label={t('tickets.scan.seguirEscaneando')} variant="surface" onPress={onResume} />
    </View>
  );
}

function CardHead({ icon, color, title, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; text: string }) {
  return (
    <View style={styles.cardHead} accessible accessibilityLiveRegion="assertive">
      <Ionicons name={icon} size={34} color={color} />
      <View style={styles.cardCopy}>
        <ThemedText style={styles.cardTitle}>{title}</ThemedText>
        {!!text && <ThemedText style={styles.cardText}>{text}</ThemedText>}
      </View>
    </View>
  );
}

function CodeDialog({ visible, value, onChange, onCancel, onSubmit }: { visible: boolean; value: string; onChange: (value: string) => void; onCancel: () => void; onSubmit: () => void }) {
  return (
    <HanetDialog visible={visible} onRequestClose={onCancel} title={t('tickets.scan.ingresarCodigo')} body={t('tickets.scan.elCodigoDe8Caracteres')}>
      <HanetField
        label={t('classhall.codigo')}
        value={value}
        onChangeText={text => onChange(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={9}
        placeholder={t('tickets.scan.n7f3k29qx')}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <HanetDialogActions>
        <HanetButton label={t('common.cancelar')} variant="surface" onPress={onCancel} style={dialogStyles.action} />
        <HanetButton label={t('tickets.scan.validar')} variant="accent" disabled={value.replace(/[^0-9A-Z]/g, '').length !== 8} onPress={onSubmit} style={dialogStyles.action} />
      </HanetDialogActions>
    </HanetDialog>
  );
}

const CORNER = 34;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: AppSpacing.md, padding: AppSpacing.xl, backgroundColor: AppColors.canvas },
  centerTitle: { ...AppType.title3, color: AppColors.textPrimary, textAlign: 'center' },
  centerText: { ...AppType.callout, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary, textAlign: 'center', marginBottom: AppSpacing.md },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm, paddingHorizontal: AppSpacing.lg, paddingTop: AppSpacing.sm },
  round: { width: 44, height: 44, borderRadius: AppRadii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.surface },
  roundOn: { backgroundColor: AppColors.controlActive },
  counter: { flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: AppSpacing.lg, borderRadius: AppRadii.pill, backgroundColor: AppColors.surface },
  counterTitle: { ...AppType.headline, color: AppColors.textPrimary },
  counterText: { ...AppType.caption, color: AppColors.textSecondary },
  finder: { alignSelf: 'center', width: 250, height: 250 },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 18 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 18 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 18 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 18 },
  webNote: { ...AppType.callout, color: AppColors.textSecondary, textAlign: 'center', paddingHorizontal: AppSpacing.xl, maxWidth: 440, alignSelf: 'center' },
  bottom: { paddingHorizontal: AppSpacing.lg, paddingBottom: AppSpacing.lg, gap: AppSpacing.md, width: '100%', maxWidth: 480, alignSelf: 'center' },
  hint: {
    alignSelf: 'center',
    overflow: 'hidden',
    paddingHorizontal: AppSpacing.lg,
    paddingVertical: AppSpacing.sm,
    borderRadius: AppRadii.pill,
    backgroundColor: AppColors.surface,
    textAlign: 'center',
    ...AppType.callout,
    color: AppColors.textPrimary,
  },
  card: { padding: AppSpacing.lg, gap: AppSpacing.md, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  cardValid: { borderWidth: 2, borderColor: VALID },
  cardUsed: { borderWidth: 2, borderColor: AppColors.accent },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md },
  cardCopy: { flex: 1 },
  cardTitle: { ...AppType.title3, color: AppColors.textPrimary },
  cardText: { ...AppType.footnote, color: AppColors.textSecondary },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  accountNumber: { ...AppType.callout, color: AppColors.textPrimary },
  accountStatus: { ...AppType.callout, color: AppColors.textSecondary },
});
