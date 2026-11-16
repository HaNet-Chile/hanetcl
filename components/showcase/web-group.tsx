import { GradientCard } from '@/components/anniversary/gradient-card';
import { WideHallCard } from '@/components/classhall/hall-grid';
import { GroupTitle, Note, Section, showcaseStyles } from '@/components/showcase/showcase-ui';
import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { InstallGuideDialog } from '@/components/web/install-guide';
import { AppColors, AppDisplay, AppSpacing } from '@/constants/design-tokens';
import type { Hall } from '@/services/classhall-service';
import type { InstallGuideKind } from '@/services/web-install';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

// La web (PR #38 to #41) and the Aniversario's waving surface (PR #25).

const GUIDES: { kind: InstallGuideKind; label: string }[] = [
  { kind: 'ios-safari', label: 'Safari de iPhone' },
  { kind: 'android-chrome', label: 'Chrome de Android' },
  { kind: 'android-samsung', label: 'Samsung Internet' },
  { kind: 'desktop-chrome', label: 'Chrome del computador' },
  { kind: 'mac-safari', label: 'Safari del Mac' },
];

const HALL: Hall = {
  id: 'ejemplo-hall',
  subject: 'Matemáticas',
  courseId: 'Segundo Medio K',
  teacherName: 'Docente de ejemplo',
  theme: 'math',
  plan: 'comun',
  isTeacher: false,
  code: null,
  memberCount: 38,
  nextEvaluation: { title: 'Prueba 2 (ejemplo)', date: Date.now() + 2 * 86_400_000 },
};

const ALLIANCE_COLORS = ['#EF2274', '#2F6BFF', '#FFCC00'];

export function WebGroup() {
  const [guide, setGuide] = useState<InstallGuideKind>('ios-safari');
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <>
      <GroupTitle>Web</GroupTitle>

      <Section
        title="Agregar a inicio"
        description="La primera vez que el Inicio se abre en un navegador sale esta guía, con los pasos de ese navegador, o el botón “Instalar” si el navegador da su propio aviso. Aquí se puede ver la de cada uno; no queda nada guardado."
        source="components/web/install-guide.tsx · InstallGuideDialog (preview) y HomeInstallGuide"
      >
        <View style={showcaseStyles.chipWrap}>
          {GUIDES.map(item => (
            <HanetChip key={item.kind} label={item.label} compact selected={guide === item.kind} onPress={() => setGuide(item.kind)} />
          ))}
        </View>
        <HanetButton label="Ver la guía" variant="surface" onPress={() => setOpen(true)} />
      </Section>
      <InstallGuideDialog visible={open} preview={guide} onClose={() => setOpen(false)} />

      <Section
        title="Clase en la vista de escritorio"
        description="Mis clases en una ventana ancha: el tema de la asignatura arriba, quién la hace y cuándo toca. Superficies grises; el rosado solo para una clase en curso o una prueba cercana."
        source="components/classhall/hall-grid.tsx · WideHallCard (y WeekPanel, que carga la semana real)"
      >
        <View style={styles.wideCard}>
          <WideHallCard hall={HALL} next="Mañana 10:15 · Sala 12" now={false} onOpen={() => setNote('En la web esto abre el Hall.')} />
        </View>
        <Note>{note}</Note>
        <Note>La barra lateral (SideNav), el panel de entrada (EntryAside) y el Inicio de escritorio (desktop-home) solo aparecen en una ventana ancha: míralos en hanet-app.web.app desde el computador.</Note>
      </Section>

      <GroupTitle>Aniversario</GroupTitle>

      <Section
        title="Tarjeta que ondea"
        description="Los colores de las alianzas se mueven como una bandera, solo en las tarjetas de puntos y resultados. Se detiene fuera de pantalla y con “Reducir movimiento”; sin Skia queda un degradado quieto."
        source="components/anniversary/gradient-card.tsx · GradientCard, con FlagSurface (flag-surface.tsx)"
      >
        <GradientCard colors={ALLIANCE_COLORS} style={styles.flag}>
          <ThemedText style={styles.flagLabel}>Alianza Roja (ejemplo)</ThemedText>
          <ThemedText style={styles.flagScore}>1.240</ThemedText>
        </GradientCard>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  wideCard: { maxWidth: 360 },
  flag: { minHeight: 140, padding: AppSpacing.lg, justifyContent: 'flex-end', gap: 2 },
  flagLabel: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 15, lineHeight: 20 },
  flagScore: { ...AppDisplay.number, color: AppColors.textPrimary },
});
