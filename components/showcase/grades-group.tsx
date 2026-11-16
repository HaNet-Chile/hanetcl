import { ScratchCard } from '@/components/classhall/scratch-card';
import { GradesLocked } from '@/components/grades/grades-lock';
import { GradesTileView } from '@/components/grades/grades-tile';
import { GroupTitle, Note, Section, Stage, showcaseStyles } from '@/components/showcase/showcase-ui';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { StripedBanner, StripedPill, Stripes } from '@/components/ui/stripes';
import { AppColors, AppRadii } from '@/constants/design-tokens';
import { formatGrade } from '@/services/grades';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

// Notas (PR #34 and #35): the stripes, what points to a covered grade, and
// the scratch card itself. The grades here are made up.

const SAMPLE_GRADES = [6.5, 4.8];

export function GradesGroup({ onScratching }: { onScratching: (active: boolean) => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [count, setCount] = useState(2);
  const [grade, setGrade] = useState(SAMPLE_GRADES[0]);
  const [revealed, setRevealed] = useState(false);
  // A new key draws the cover again from scratch.
  const [round, setRound] = useState(0);

  return (
    <>
      <GroupTitle>Notas</GroupTitle>

      <Section
        title="Rayas de HaNet"
        description="Las rayas de la tapa del raspe. Significan “aquí hay una nota tapada”, así que nada más en la app las usa: el banner de notas nuevas, la píldora “N nuevas”, una nota en las notificaciones y la tarjeta de ClassHall."
        source="components/ui/stripes.tsx · Stripes, StripedBanner, StripedPill"
      >
        <View style={styles.swatch}><Stripes /></View>
        <StripedBanner
          title="Tienes 2 notas nuevas"
          actionLabel="Destapar"
          accessibilityLabel="Tienes 2 notas nuevas. Destapar"
          onPress={() => setNote('En la app esto abre el raspe a pantalla completa.')}
        />
        <StripedBanner
          title="Tienes 3 notas por destapar"
          subtitle="Matemática, Historia"
          actionLabel="Destapar"
          accessibilityLabel="Tienes 3 notas por destapar, de Matemática e Historia. Destapar"
          onPress={() => setNote('En la app esto abre el raspe a pantalla completa.')}
        />
        <Stage>
          <View style={styles.row}>
            <ThemedText style={styles.rowTitle}>Matemática</ThemedText>
            <StripedPill label="2 nuevas" />
          </View>
        </Stage>
        <Note>{note}</Note>
      </Section>

      <Section
        title="Notas en ClassHall"
        description="El tile ancho de arriba de ClassHall para estudiantes. Dice cuántas faltan por destapar y nunca muestra notas ni promedios: es lo que se mira por encima del hombro."
        source="components/grades/grades-tile.tsx · GradesTile (carga) y GradesTileView (solo el dibujo)"
      >
        <View style={showcaseStyles.chipWrap}>
          {[0, 1, 3].map(value => (
            <HanetChip key={value} label={value === 0 ? 'Sin nuevas' : value === 1 ? '1 nueva' : `${value} nuevas`} selected={count === value} onPress={() => setCount(value)} />
          ))}
        </View>
        <GradesTileView count={count} onPress={() => setNote('En la app esto abre Notas.')} />
      </Section>

      <Section
        title="Raspe"
        description="Raspa con el dedo. La tapa brilla como lámina al inclinar el teléfono, salta viruta, la vibración se acelera y al 75 % la tapa se rompe y la nota aterriza. Tapada, es igual para cualquier nota; solo un 6,0 o más, ya visible, suma un estallido."
        source="components/classhall/scratch-card.tsx (Skia) y scratch-card.web.tsx (canvas)"
      >
        <View style={showcaseStyles.chipWrap}>
          {SAMPLE_GRADES.map(value => (
            <HanetChip
              key={value}
              label={`Nota ${formatGrade(value)}`}
              selected={grade === value}
              onPress={() => { setGrade(value); setRevealed(false); setRound(current => current + 1); }}
            />
          ))}
        </View>
        <ScratchCard
          key={round}
          height={180}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onScratching={onScratching}
          celebrate={grade >= 6}
          label="Raspa para ver tu nota"
          accessibilityLabel="Nota de ejemplo, tapada"
          accessibilityHint="Raspa con el dedo o usa el botón para verla."
        >
          <ThemedText style={styles.grade}>{formatGrade(grade)}</ThemedText>
        </ScratchCard>
        <View style={showcaseStyles.buttonRow}>
          <HanetButton label="Ver sin raspar" variant="surface" disabled={revealed} onPress={() => setRevealed(true)} style={showcaseStyles.flexButton} />
          <HanetButton label="Tapar de nuevo" variant="surface" onPress={() => { setRevealed(false); setRound(current => current + 1); }} style={showcaseStyles.flexButton} />
        </View>
      </Section>

      <Section
        title="Notas protegidas"
        description="Con “Proteger Notas” encendido, esto va en lugar de las notas hasta desbloquear con Face ID, huella o el código del teléfono."
        source="components/grades/grades-lock.tsx · GradesLocked"
      >
        <GradesLocked onUnlock={() => setNote('En la app esto pide Face ID, huella o el código.')} />
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  swatch: { height: 56, borderRadius: AppRadii.lg, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, color: AppColors.textPrimary, fontFamily: 'DMSans_500Medium', fontSize: 16, lineHeight: 22 },
  grade: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 72, lineHeight: 80, letterSpacing: -4, fontVariant: ['tabular-nums'] },
});
