import { DayChangeBanner, DayChangeList, DismissalLine } from '@/components/calendar/day-change-banner';
import { GroupTitle, Section, Stage } from '@/components/showcase/showcase-ui';
import { ThemedText } from '@/components/themed-text';
import { AreaIcon, KnowledgeIcon } from '@/components/tools/area-icon';
import { VerbAnswerField, VerbTag, VerbTimeBar } from '@/components/tools/verb-ui';
import { AppColors, AppRadii, AppSpacing } from '@/constants/design-tokens';
import type { AreaId, KnowledgeArea } from '@/services/electividad-service';
import type { DayChange } from '@/services/schedule-service';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

// Calendar (PR #43) and Herramientas (PR #30 and #32). Sample days only.

const AREAS: { id: AreaId; name: string }[] = [
  { id: 'bio', name: 'Biología' },
  { id: 'qui', name: 'Química' },
  { id: 'mat', name: 'Matemáticas' },
  { id: 'fis', name: 'Física' },
  { id: 'soc', name: 'Ciencias Sociales' },
  { id: 'len', name: 'Lenguaje' },
  { id: 'mus', name: 'Artes Musicales' },
  { id: 'vis', name: 'Artes Visuales' },
  { id: 'mov', name: 'Artes del Movimiento' },
];

const KNOWLEDGE: KnowledgeArea[] = [
  'Salud', 'Ciencias Básicas', 'Tecnología', 'Educación', 'Arte y Arquitectura',
  'Ciencias Sociales', 'Humanidades', 'Derecho', 'Administración y Comercio', 'Agropecuaria',
];

function dayKey(offset: number) {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function changes(): DayChange[] {
  return [
    { id: 'c1', kind: 'suspended', from: dayKey(3), to: dayKey(4), endsAt: null, scope: 'school', courses: [], reason: 'Jornada de reflexión docente (ejemplo).', byName: 'Dirección', at: null },
    { id: 'c2', kind: 'early', from: dayKey(7), to: dayKey(7), endsAt: '12:30', scope: 'courses', courses: ['Segundo Medio K', 'Tercero Medio B'], reason: 'Consejo de profesores (ejemplo).', byName: 'Dirección', at: null },
  ];
}

export function CalendarGroup() {
  const [sample] = useState(changes);
  return (
    <>
      <GroupTitle>Calendar</GroupTitle>

      <Section
        title="Día sin clases o salida anticipada"
        description="Una tarjeta rosada sólida arriba del día, con las fechas, a quiénes alcanza y qué pasa con las pruebas. Admin y HNT ven además “Administrar”."
        source="components/calendar/day-change-banner.tsx · DayChangeBanner"
      >
        {sample.map(change => <DayChangeBanner key={change.id} change={change} canManage={false} />)}
      </Section>

      <Section
        title="Próximos cambios en el Horario"
        description="La semana del Horario no cambia: debajo, la lista de lo que viene."
        source="components/calendar/day-change-banner.tsx · DayChangeList"
      >
        <DayChangeList changes={sample} />
      </Section>

      <Section
        title="Hora de salida"
        description="Una línea rosada donde una salida anticipada corta el día, entre los bloques."
        source="components/calendar/day-change-banner.tsx · DismissalLine"
      >
        <Stage>
          <View style={styles.block}><ThemedText style={styles.blockText}>11:00 · Matemática</ThemedText></View>
          <DismissalLine endsAt="12:30" />
          <View style={[styles.block, styles.blockAfter]}><ThemedText style={styles.blockText}>13:15 · Historia</ThemedText></View>
        </Stage>
      </Section>
    </>
  );
}

export function ToolsGroup() {
  return (
    <>
      <GroupTitle>Herramientas</GroupTitle>

      <Section
        title="Íconos de áreas"
        description="Trazo de 2 px sobre 24 × 24, dibujados para HaNet: las 9 áreas de HaNet Electividad."
        source="components/tools/area-icon.tsx · AreaIcon"
      >
        <View style={styles.grid}>
          {AREAS.map(area => (
            <View key={area.id} style={styles.cell}>
              <View style={styles.tile}><AreaIcon area={area.id} size={22} color={AppColors.accent} /></View>
              <ThemedText style={styles.label} numberOfLines={2}>{area.name}</ThemedText>
            </View>
          ))}
        </View>
      </Section>

      <Section
        title="Íconos de carreras"
        description="Las áreas del conocimiento en que mifuturo.cl ordena las carreras, para el resultado del test."
        source="components/tools/area-icon.tsx · KnowledgeIcon"
      >
        <View style={styles.grid}>
          {KNOWLEDGE.map(area => (
            <View key={area} style={styles.cell}>
              <View style={[styles.tile, styles.tileGrey]}><KnowledgeIcon area={area} size={22} color={AppColors.textPrimary} /></View>
              <ThemedText style={styles.label} numberOfLines={2}>{area}</ThemedText>
            </View>
          ))}
        </View>
      </Section>

      <Section
        title="Verbos en inglés"
        description="La etiqueta de lo que se pregunta (rosada) o del tipo de verbo, el campo de respuesta sin autocorrector (con su marca al revisar) y el reloj de Infinito, que se pone rosado bajo 8 segundos."
        source="components/tools/verb-ui.tsx · VerbTag, VerbAnswerField, VerbTimeBar"
      >
        <View style={styles.verbStack}>
          <View style={styles.verbTags}>
            <VerbTag label="Pasado simple" strong />
            <VerbTag label="Irregular" />
          </View>
          <VerbAnswerField label="Pasado simple" value="went" state="right" editable={false} />
          <VerbAnswerField label="Participio pasado" value="goed" state="wrong" editable={false} />
          <VerbTimeBar seconds={21} max={30} low={false} />
          <VerbTimeBar seconds={6} max={30} low />
        </View>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  block: { padding: AppSpacing.md, borderRadius: AppRadii.md, borderCurve: 'continuous', backgroundColor: AppColors.surfaceMuted },
  blockAfter: { opacity: 0.45 },
  blockText: { color: AppColors.textPrimary, fontFamily: 'DMSans_500Medium', fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: AppSpacing.md },
  cell: { width: '33.33%', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  tile: { width: 48, height: 48, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.accentTint },
  tileGrey: { backgroundColor: AppColors.surface },
  verbStack: { gap: AppSpacing.md },
  verbTags: { flexDirection: 'row', gap: AppSpacing.sm },
  label: { color: AppColors.textSecondary, fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 16, textAlign: 'center' },
});
