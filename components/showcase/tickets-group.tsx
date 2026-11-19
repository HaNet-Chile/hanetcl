import { GroupTitle, Section, Stage } from '@/components/showcase/showcase-ui';
import { DEMO_EVENT } from '@/components/showcase/ticket-demo';
import { ScreenshotWarning } from '@/components/system/screenshot-guard';
import { ThemedText } from '@/components/themed-text';
import { TicketPile } from '@/components/tickets/profile-tickets';
import { TicketView } from '@/components/tickets/ticket';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import type { Ticket } from '@/services/tickets-service';
import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

// Entradas (v0.13.0): the ticket in each of its states, the pile of Perfil
// and every animation of the module, opened with a made-up ticket (`?demo=`,
// components/showcase/ticket-demo.ts). The event here is made up.

const SAMPLE_EVENT = DEMO_EVENT;

const STATES = [
  { value: 'active', label: 'Activa' },
  { value: 'pending', label: 'Por aceptar' },
  { value: 'link', label: 'Link enviado' },
  { value: 'shared', label: 'Compartida' },
  { value: 'used', label: 'Usada' },
] as const;

const SAMPLE_PILE: Ticket[] = [1, 2, 3].map(number => ({
  id: `ejemplo-${number}`,
  eventId: 'ejemplo',
  number: 140 + number,
  holderName: '',
  courseId: '',
  status: number === 3 ? 'link' : 'active',
  giftedFromName: '',
  giftedToName: '',
  issuedAt: null,
  usedAt: null,
  linkExpiresAt: null,
  receivedAt: null,
  event: SAMPLE_EVENT,
}));

type Demo = { label: string; note: string; icon: keyof typeof Ionicons.glyphMap; href?: Href; screenshot?: true };

const DEMOS: Demo[] = [
  { label: 'Abrir una entrada', note: 'La hoja con el QR que cambia solo cada 30 s. Saca una captura para ver el aviso, o toca "Simular lectura en la puerta".', icon: 'ticket-outline', href: { pathname: '/tickets/detail', params: { demo: '1' } } },
  { label: 'Entrada válida', note: 'Lo que pasa en el teléfono cuando la leen en la puerta: el talón se corta y cae, el check verde y dos vibraciones. Dura 3 s.', icon: 'checkmark-circle-outline', href: { pathname: '/tickets/validated', params: { demo: '1' } } },
  { label: 'Llega una entrada', note: 'La primera vez que el teléfono ve una entrada nueva: sube desde abajo.', icon: 'arrow-up-circle-outline', href: { pathname: '/tickets/arrival', params: { demo: '1' } } },
  { label: 'Llegan 5 (Presidente de curso)', note: 'Las del curso se abren en abanico.', icon: 'albums-outline', href: { pathname: '/tickets/arrival', params: { demo: '5' } } },
  { label: 'Recibir una regalada', note: 'La entrada flota arriba y se inclina con el teléfono; el QR borroso se enfoca al aceptarla.', icon: 'gift-outline', href: { pathname: '/tickets/receive', params: { demo: '1' } } },
  { label: 'Aviso de captura', note: 'El diálogo que sale al sacar una captura con un QR en pantalla (iPhone y Android 14+).', icon: 'ban-outline', screenshot: true },
];

export function TicketsGroup() {
  const router = useRouter();
  const [state, setState] = useState<(typeof STATES)[number]['value']>('active');
  const [warning, setWarning] = useState(false);
  return (
    <>
      <GroupTitle>Entradas</GroupTitle>
      <Section
        title="Entrada"
        description="Variante A (talón oscuro): la información a la izquierda sobre una luz suave del color de la portada y el QR en el talón. Sin cuenta regresiva: el código cambia solo cada 30 s. Normal y grande (la del detalle)."
        source="components/tickets/ticket.tsx · TicketView"
      >
        <View style={styles.chips}>
          {STATES.map(item => <HanetChip key={item.value} label={item.label} compact selected={state === item.value} onPress={() => setState(item.value)} />)}
        </View>
        <Stage canvas>
          <TicketView event={SAMPLE_EVENT} status={state} qrValue="hanet://ticket/ejemplo?c=0123456789" number={142} cap={300} />
          <TicketView event={SAMPLE_EVENT} status={state} qrValue="hanet://ticket/ejemplo?c=0123456789" number={142} cap={300} size="large" />
        </Stage>
      </Section>
      <Section
        title="Pila de entradas"
        description="Varias entradas del mismo evento (las 5 de un Presidente de curso): asoman los bordes de las otras y la cuenta ×N. En Perfil y en Entradas."
        source="components/tickets/profile-tickets.tsx · TicketPile, ProfileTickets"
      >
        <Stage canvas>
          <TicketPile tickets={SAMPLE_PILE} top={SAMPLE_PILE[0]} onPress={() => undefined} />
        </Stage>
      </Section>
      <Section
        title="Probar las animaciones"
        description="Cada pantalla de Entradas con una entrada de prueba: nada se guarda ni llega al servidor."
        source="app/tickets/{detail,validated,arrival,receive}.tsx · ?demo="
      >
        <View style={styles.demos}>
          {DEMOS.map(item => (
            <View key={item.label} style={styles.demo}>
              <HanetButton
                label={item.label}
                variant="surface"
                icon={<Ionicons name={item.icon} size={18} color={AppColors.textPrimary} />}
                onPress={() => (item.href ? router.push(item.href) : setWarning(true))}
              />
              <ThemedText style={styles.demoNote}>{item.note}</ThemedText>
            </View>
          ))}
        </View>
        <ScreenshotWarning visible={warning} ticket onClose={() => setWarning(false)} />
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demos: { gap: AppSpacing.lg },
  demo: { gap: AppSpacing.xs },
  demoNote: { ...AppType.footnote, color: AppColors.textSecondary, paddingHorizontal: AppSpacing.sm },
});
