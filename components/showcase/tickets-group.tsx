import { GroupTitle, Section, Stage } from '@/components/showcase/showcase-ui';
import { TicketPile } from '@/components/tickets/profile-tickets';
import { TicketView } from '@/components/tickets/ticket';
import { HanetChip } from '@/components/ui/hanet-chip';
import type { Ticket, TicketEvent } from '@/services/tickets-service';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

// Entradas (v0.13.0): the ticket in each of its states and the pile of
// Perfil. The event here is made up.

const SAMPLE_EVENT: TicketEvent = {
  id: 'ejemplo',
  institutionName: 'Liceo de ejemplo',
  title: 'Velada de Aniversario',
  startsAt: new Date(2027, 6, 8, 19, 0).getTime(),
  endsAt: null,
  venueName: 'Gimnasio',
  address: '',
  city: '',
  imageUrl: null,
  palette: ['#EF2274'],
  authorName: 'CEE',
  cap: 300,
  giftable: true,
  printable: true,
  style: 'simple',
  note: '',
};

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

export function TicketsGroup() {
  const [state, setState] = useState<(typeof STATES)[number]['value']>('active');
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
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
