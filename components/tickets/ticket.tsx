import { ThemedText } from '@/components/themed-text';
import { AppColors } from '@/constants/design-tokens';
import { capitalize, monthsShort, t, weekdaysShort } from '@/i18n';
import type { TicketEvent, TicketStatus } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useId } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeOut } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Line, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

// La entrada de HaNet (canvas de Entradas, variante A "talón oscuro",
// decidida por muxp el 2026-11-19): un rectángulo corto con dos muescas
// donde se corta, la información a la izquierda sobre una luz suave del color
// de la portada que viene desde la izquierda, y el QR en el talón a la
// derecha. Sin cuenta regresiva: el código cambia solo, sin avisar.

export type TicketSize = 'normal' | 'large';

const BASE_WIDTH = 358;
const SIZES = {
  normal: { height: 156, cut: 226, qr: 104 },
  large: { height: 200, cut: 196, qr: 136 },
} as const;
const RADIUS = 22;
const NOTCH = 11;
const BODY = '#333235';
const PLACEHOLDER_QR = 'hanet://ticket/por-aceptar?c=0000000000';

/** The outline of the ticket, with its two notches at `cut`. */
export function ticketPath(width: number, height: number, cut: number) {
  const r = RADIUS;
  const n = NOTCH;
  return [
    `M${r} 0H${cut - n}A${n} ${n} 0 0 0 ${cut + n} 0H${width - r}`,
    `A${r} ${r} 0 0 1 ${width} ${r}V${height - r}A${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H${cut + n}A${n} ${n} 0 0 0 ${cut - n} ${height}H${r}`,
    `A${r} ${r} 0 0 1 0 ${height - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`,
  ].join('');
}

// Where the ticket tears at the door (canvas, board Validada): the edge zigzags
// a few points to each side of the perforation, every 1/25 of the height.
const TEAR = [-4.7, 3.5, -2.3, 2.9, -2.9, 2.3, -3.5, 4.7, -4.1, 4.1];

/** The torn edge along the perforation at `cut`, top to bottom. */
export function tearPoints(height: number, cut: number) {
  const steps = 25;
  return Array.from({ length: steps + 1 }, (_, i) => `${(cut + TEAR[i % TEAR.length]).toFixed(1)},${((height * i) / steps).toFixed(1)}`);
}

/** "Jue 8 jul" and "19:00" for the ticket. */
export function ticketWhen(ms: number | null) {
  if (ms === null) return { date: '', time: '' };
  const date = new Date(ms);
  return {
    date: `${capitalize(weekdaysShort()[date.getDay()])} ${date.getDate()} ${monthsShort()[date.getMonth()]}`,
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

export type TicketProps = {
  event: Pick<TicketEvent, 'title' | 'startsAt' | 'venueName' | 'palette'>;
  status: TicketStatus | 'pending';
  /** The QR's value; null while it loads (or without internet the first time). */
  qrValue?: string | null;
  number?: number | null;
  cap?: number | null;
  /** The small line above the title. */
  kicker?: string;
  size?: TicketSize;
  /** Width in points; by default the screen's, up to 358. */
  width?: number;
  style?: StyleProp<ViewStyle>;
  /** One half of the torn ticket (Entrada válida): the information or the stub. */
  piece?: 'info' | 'stub';
  /** Only the paper, with nothing printed: the tickets behind in a fan. */
  bare?: boolean;
};

export function TicketView({ event, status, qrValue = null, number = null, cap = null, kicker, size = 'normal', width, style, piece, bare = false }: TicketProps) {
  const id = useId().replace(/[^A-Za-z0-9]/g, '');
  const screen = useWindowDimensions();
  const w = width ?? Math.min(BASE_WIDTH, screen.width - 32);
  const scale = w / BASE_WIDTH;
  const spec = SIZES[size];
  const height = Math.round(spec.height * Math.max(0.9, scale));
  const cut = Math.round(spec.cut * scale);
  const qr = Math.round(spec.qr * Math.max(0.85, scale));
  const used = status === 'used' || status === 'voided';
  const light = used ? '#8E8D93' : event.palette[0] ?? AppColors.accent;
  const when = ticketWhen(event.startsAt);
  const path = ticketPath(w, height, cut);
  const large = size === 'large';
  const numberText = number ? (cap ? `N.º ${number} de ${cap}` : `N.º ${number}`) : '';
  const tear = piece ? tearPoints(height, cut) : null;
  const tearShape = tear
    ? (piece === 'info' ? ['0,0', ...tear, `0,${height}`] : [...tear, `${w},${height}`, `${w},0`]).join(' ')
    : '';

  const stub = (() => {
    if (status === 'link' || status === 'shared' || status === 'printed') {
      const icon = status === 'link' ? 'link-outline' : status === 'printed' ? 'print-outline' : 'image-outline';
      const label = status === 'link' ? t('components.tickets.ticket.linkEnviado') : status === 'printed' ? t('components.tickets.ticket.impresa') : t('components.tickets.ticket.compartida');
      return (
        <View style={styles.status}>
          <View style={styles.statusIcon}><Ionicons name={icon} size={22} color={AppColors.textPrimary} /></View>
          <ThemedText style={styles.statusText}>{label}</ThemedText>
        </View>
      );
    }
    const pending = status === 'pending';
    return (
      <View style={[styles.qr, { width: qr, height: qr }, used && styles.qrUsed]}>
        {pending || qrValue ? (
          <QRCode value={pending ? PLACEHOLDER_QR : qrValue!} size={qr - 16} color={AppColors.canvas} backgroundColor="transparent" ecl="M" />
        ) : (
          <Ionicons name="qr-code-outline" size={qr * 0.42} color={AppColors.surfaceMuted} />
        )}
        {/* Accepting it brings the code into focus (canvas, board Recibir). */}
        {pending && (
          <Animated.View exiting={FadeOut.duration(420)} style={StyleSheet.absoluteFill}>
            {Platform.OS === 'android'
              ? <View style={[StyleSheet.absoluteFill, styles.frost]} />
              : <BlurView intensity={28} tint="light" style={[StyleSheet.absoluteFill, styles.blurClip]} />}
          </Animated.View>
        )}
        {pending && (
          <Animated.View exiting={FadeOut.duration(220)} style={styles.pendingPill}>
            <Ionicons name="gift-outline" size={15} color={AppColors.textPrimary} />
            <ThemedText style={styles.pendingText}>{t('components.tickets.ticket.porAceptar')}</ThemedText>
          </Animated.View>
        )}
      </View>
    );
  })();

  return (
    <View style={[styles.ticket, { width: w, height }, style]}>
      <Svg width={w} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id={`shape${id}`}><Path d={path} /></ClipPath>
          {!!tear && <ClipPath id={`tear${id}`}><Polygon points={tearShape} /></ClipPath>}
          <RadialGradient id={`light${id}`} gradientUnits="userSpaceOnUse" cx={0} cy={height / 2} rx={w * 0.7} ry={height * 1.2} fx={0} fy={height / 2}>
            <Stop offset="0" stopColor={light} stopOpacity={used ? 0.3 : 0.55} />
            <Stop offset="0.45" stopColor={light} stopOpacity={used ? 0.12 : 0.22} />
            <Stop offset="1" stopColor={light} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G clipPath={tear ? `url(#tear${id})` : undefined}>
          <G clipPath={`url(#shape${id})`}>
            <Rect x={0} y={0} width={w} height={height} fill={BODY} />
            <Rect x={0} y={0} width={w} height={height} fill={`url(#light${id})`} />
            <Rect x={cut} y={0} width={w - cut} height={height} fill="#FFFFFF" fillOpacity={0.05} />
          </G>
          {!tear && <Line x1={cut} y1={NOTCH + 6} x2={cut} y2={height - NOTCH - 6} stroke="#FFFFFF" strokeOpacity={0.42} strokeWidth={1.5} strokeDasharray="4 4" />}
          <Path d={path} fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1} />
        </G>
      </Svg>

      {!bare && piece !== 'stub' && <View style={[styles.left, { width: cut }, large && styles.leftLarge]}>
        <View>
          {!!(kicker ?? numberText) && <ThemedText numberOfLines={1} style={styles.kicker}>{kicker ?? numberText}</ThemedText>}
          <ThemedText numberOfLines={2} style={[styles.title, large && styles.titleLarge]}>{event.title}</ThemedText>
        </View>
        <View style={[styles.meta, large && styles.metaLarge]}>
          {!!when.date && <Meta label={t('eventInfo.fecha')} value={when.date} />}
          {!!when.time && <Meta label={t('components.ui.hanetDateTimePicker.hora')} value={when.time} />}
          {!!event.venueName && <Meta label={t('anniversary.activity.lugar')} value={event.venueName} shrink />}
        </View>
      </View>}

      {!bare && piece !== 'info' && <View style={[styles.stub, { left: cut }]}>{stub}</View>}

      {status === 'used' && !piece && !bare && (
        <View pointerEvents="none" style={styles.stampWrap}>
          <ThemedText style={styles.stamp}>{t('tickets.scan.usada')}</ThemedText>
        </View>
      )}
    </View>
  );
}

function Meta({ label, value, shrink = false }: { label: string; value: string; shrink?: boolean }) {
  return (
    <View style={shrink ? styles.metaShrink : undefined}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedText numberOfLines={1} style={styles.value}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  // The shadow follows the paper (notches, torn edge). On iOS the layer's
  // shadow already does; on the web a box shadow is a plain rectangle that
  // stays behind a torn or fanned ticket, so it is a drop shadow there.
  ticket: Platform.select<ViewStyle>({
    web: { filter: 'drop-shadow(0px 12px 8px rgba(0, 0, 0, 0.38))' },
    default: {
      shadowColor: '#000',
      shadowOpacity: 0.38,
      shadowRadius: 11,
      shadowOffset: { width: 0, height: 14 },
    },
  }),
  left: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    paddingTop: 16,
    paddingRight: 14,
    paddingBottom: 14,
    paddingLeft: 18,
    justifyContent: 'space-between',
  },
  leftLarge: { paddingTop: 20, paddingBottom: 18, paddingLeft: 20 },
  stub: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { color: 'rgba(249,249,250,0.86)', fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0.15 },
  title: { marginTop: 2, color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 20, lineHeight: 22, letterSpacing: -0.6 },
  titleLarge: { fontSize: 23, lineHeight: 25, letterSpacing: -0.8 },
  meta: { flexDirection: 'row', gap: 14 },
  metaLarge: { flexWrap: 'wrap', rowGap: 8 },
  metaShrink: { flexShrink: 1 },
  label: { color: 'rgba(249,249,250,0.78)', fontFamily: 'DMSans_500Medium', fontSize: 11, lineHeight: 14, letterSpacing: 0.15 },
  value: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 13, lineHeight: 17 },
  qr: {
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: AppColors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrUsed: { opacity: 0.18 },
  frost: { backgroundColor: 'rgba(249,249,250,0.82)' },
  blurClip: { borderRadius: 12 },
  pendingPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(40,40,41,0.86)',
  },
  pendingText: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 12, lineHeight: 15 },
  status: { alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  statusIcon: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  statusText: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 12, lineHeight: 15, textAlign: 'center' },
  stampWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  stamp: {
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: AppColors.textPrimary,
    borderRadius: 999,
    backgroundColor: 'rgba(40,40,41,0.78)',
    color: AppColors.textPrimary,
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    lineHeight: 16,
    transform: [{ rotate: '-9deg' }],
  },
});
