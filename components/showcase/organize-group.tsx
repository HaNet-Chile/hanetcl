import { CreateMenu, CreatePill, ScanPill } from '@/components/organize/organize-bar';
import { OrganizeHeaderButton } from '@/components/organize/organize-entry';
import { ArrivalCounter, OrganizedEventRow, TodayEventCard } from '@/components/organize/organize-ui';
import { GroupTitle, Section, Stage, showcaseStyles } from '@/components/showcase/showcase-ui';
import { HanetChip } from '@/components/ui/hanet-chip';
import { AppColors, AppRadii } from '@/constants/design-tokens';
import type { HnEvent } from '@/services/events-service';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

// Organizar (app/organize): what Admin, CEE and HNT run from the phone.

const HOUR = 3_600_000;

function example(now: number, patch: Partial<HnEvent>): HnEvent {
  return {
    id: 'ejemplo-organizar',
    kind: 'institution',
    status: 'published',
    private: false,
    tickets: { enabled: false, cap: null, giftable: true, guestLinks: true, printable: false, style: 'simple', note: '' },
    title: 'Velada de Aniversario (ejemplo)',
    category: 'Arte',
    description: '',
    imageUrl: null,
    palette: [],
    gallery: [],
    startsAt: now - HOUR,
    endsAt: now + 3 * HOUR,
    venueName: 'Gimnasio',
    address: '',
    city: 'Temuco',
    region: '',
    priceFrom: null,
    isFree: true,
    ticketUrl: '',
    sourceName: '',
    sourceUrl: '',
    sponsored: false,
    perk: '',
    editorial: null,
    coupon: null,
    jornada: 'ambas',
    signupMode: 'list',
    capacity: 300,
    signupCount: 300,
    checkinCount: 212,
    canCheckIn: true,
    authorName: 'CEE',
    reactions: [],
    ...patch,
  };
}

export function OrganizeGroup() {
  const [now] = useState(() => Date.now());
  const [live, setLive] = useState(true);
  const today = example(now, {});
  const rows = [
    example(now, { id: 'r1', title: 'Gala de cuartos (ejemplo)', private: true, signupMode: 'tickets', canCheckIn: false, startsAt: now + 5 * 24 * HOUR }),
    example(now, { id: 'r2', title: 'Feria vocacional (ejemplo)', signupCount: 48, canCheckIn: false, startsAt: now + 3 * 24 * HOUR }),
    example(now, { id: 'r3', title: 'Torneo de debate (ejemplo)', status: 'draft', signupMode: 'none', canCheckIn: false, startsAt: now + 7 * 24 * HOUR }),
  ];

  return (
    <>
      <GroupTitle>Organizar</GroupTitle>

      <Section
        title="Llegaron X de Y"
        description="El contador de la puerta, igual en el Inicio, en Organizar y en la página del evento (grande). Con entradas cuenta las usadas sobre las emitidas sin anular; con Pasar lista, los que llegaron sobre los inscritos."
        source="components/organize/organize-ui.tsx · ArrivalCounter"
      >
        <Stage>
          <ArrivalCounter arrived={212} of={300} />
          <ArrivalCounter arrived={212} of={300} size="large" />
        </Stage>
      </Section>

      <Section
        title="Hoy organizas"
        description="El evento con la puerta abierta (de 3 h antes a 24 h después). Compacta en el Inicio, con Escanear; completa arriba de Organizar. Para un docente que solo escanea (door) no muestra conteos y tocarla abre el escáner."
        source="components/organize/organize-ui.tsx · TodayEventCard"
      >
        <TodayEventCard event={today} compact />
        <TodayEventCard event={today} />
      </Section>

      <Section
        title="Evento en Organizar"
        description="Una fila de las listas de Organizar: portada, cuándo y de qué tipo, y su estado (borrador, con entrada, inscritos)."
        source="components/organize/organize-ui.tsx · OrganizedEventRow"
      >
        <View style={styles.group}>
          {rows.map(event => <OrganizedEventRow key={event.id} event={event} onPress={() => undefined} />)}
        </View>
      </Section>

      <Section
        title="Centro de la barra en Organizar"
        description="“Escanear” mientras uno de sus eventos tiene la puerta abierta; si no, “Crear”, cuyo menú crece desde la barra: aviso, evento, votación y, para Admin y HNT, suspender clases o salida anticipada."
        source="components/organize/organize-bar.tsx · ScanPill, CreatePill, CreateMenu"
      >
        <Stage canvas>
          <View style={showcaseStyles.buttonRow}>
            <ScanPill eventId={today.id} ticketed={false} />
            <CreatePill open={false} />
          </View>
        </Stage>
        <View style={styles.menu}><CreateMenu /></View>
      </Section>

      <Section
        title="Botón de Organizar en el Inicio"
        description="Junto al buscador del encabezado, solo para Admin, CEE y HNT. El punto rosado dice que hoy hay una puerta abierta. En la web abrirá el panel web cuando se publique."
        source="components/organize/organize-entry.tsx · OrganizeHeaderButton"
      >
        <View style={showcaseStyles.chipWrap}>
          <HanetChip label="Con puerta abierta" compact selected={live} onPress={() => setLive(true)} />
          <HanetChip label="Sin eventos hoy" compact selected={!live} onPress={() => setLive(false)} />
        </View>
        <Stage canvas>
          <OrganizeHeaderButton live={live} />
        </Stage>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, overflow: 'hidden' },
  menu: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
});
