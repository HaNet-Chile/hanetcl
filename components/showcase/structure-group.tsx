import { GroupTitle, Note, Section, Stage, useOverlay } from '@/components/showcase/showcase-ui';
import { DeviceRow } from '@/components/settings/device-row';
import { SettingsGroup, SettingsLinkRow, SettingsNote, SettingsToggleRow } from '@/components/settings/settings-list';
import { TopNotice } from '@/components/system/top-notice';
import { WhatsNewPrompt } from '@/components/system/whats-new-dialog';
import { currentRelease } from '@/services/whats-new-prompt';
import type { ReleaseSummary } from '@/services/whats-new-prompt';
import { HanetButton } from '@/components/ui/hanet-button';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { SearchPill } from '@/components/ui/search-pill';
import { HanetSegmented } from '@/components/ui/hanet-auth-fields';
import { GlassFill, GlassPressed, LIQUID_GLASS, glassClear } from '@/components/ui/liquid-glass';
import { AppColors, AppPressed } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { SearchRow } from '@/components/search/search-row';
import { t } from '@/i18n';
import React, { useState } from 'react';

// Estructura: the pieces every page is built from (PR #27 to #43).

export function StructureGroup() {
  const overlay = useOverlay();
  const [morning, setMorning] = useState(true);
  const [lock, setLock] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [segment, setSegment] = useState('a');
  const [now] = useState(() => Date.now());
  const [whatsNew, setWhatsNew] = useState<ReleaseSummary | null>(null);

  return (
    <>
      <GroupTitle>Estructura</GroupTitle>

      <Section
        title="Encabezado de página"
        description="Arriba de cada página que se desplaza: dónde vive (gris y chico), el título y una o dos líneas de para qué sirve. El mismo en Herramientas, Notas, Novedades y Licencias."
        source="components/ui/page-header.tsx · PageHeader"
      >
        <Stage canvas>
          <PageHeader eyebrow="Herramientas" title="Escala de notas" intro="Convierte los puntos de una prueba en nota, con la exigencia que use tu liceo." style={{ paddingTop: 0 }} />
        </Stage>
      </Section>

      <Section
        title="Tarjeta de mensaje"
        description="En lugar de una lista o sección: no cargó (con Reintentar), todavía no hay nada o el módulo está apagado. Gris, nunca rosado: es información, no una alarma."
        source="components/ui/message-card.tsx · MessageCard"
      >
        <MessageCard message="Todavía no tienes clases en HaNet con notas." />
        <MessageCard message="No pudimos cargar tus notas. Revisa tu conexión." onRetry={() => setNote('En la app esto vuelve a cargar.')} />
        <Note>{note}</Note>
      </Section>

      <Section
        title="Lista de ajustes"
        description="Grupos de filas sobre una tarjeta, como los ajustes del teléfono. Toda la fila cambia el interruptor, no solo el interruptor; el rosado de la pista es el único color fuerte de Configuraciones."
        source="components/settings/settings-list.tsx · SettingsGroup, SettingsLinkRow, SettingsToggleRow, SettingsNote"
      >
        <SettingsGroup title="Notificaciones (ejemplo)" footer="Se guardan en tu cuenta, para todos tus dispositivos.">
          <SettingsToggleRow icon="sunny-outline" label="Resumen de las 7:00" detail="Clases y pruebas del día" value={morning} onChange={setMorning} />
          <SettingsToggleRow icon="lock-closed-outline" label="Proteger Notas" value={lock} onChange={setLock} />
          <SettingsLinkRow icon="sparkles-outline" label="Novedades" detail="v0.10.1-beta" onPress={() => {}} />
        </SettingsGroup>
        <SettingsNote error>Así se ve una nota de error bajo un grupo.</SettingsNote>
      </Section>

      <Section
        title="Dispositivo"
        description="Dónde está abierta la cuenta, en Configuraciones → Seguridad. El que tienes en la mano dice “Este dispositivo” en rosado; los demás, su última actividad."
        source="components/settings/device-row.tsx · DeviceRow"
      >
        <SettingsGroup title="Dónde está abierta tu cuenta (ejemplo)">
          <DeviceRow device={{ kind: 'phone', name: 'iPhone', system: 'iOS 26.1', app: 'HaNet v0.12.0-beta', lastAt: now }} current now={now} />
          <DeviceRow device={{ kind: 'computer', name: 'Chrome en Windows', system: null, app: 'HaNet web', lastAt: now - 3 * 60 * 60 * 1000 }} now={now} />
          <DeviceRow device={{ kind: 'phone', name: 'moto e15', system: 'Android 14', app: 'HaNet v0.11.0-beta', lastAt: now - 26 * 60 * 60 * 1000 }} now={now} />
        </SettingsGroup>
      </Section>

      <Section
        title="Aviso flotante"
        description="Una píldora arriba de todo que no tapa la pantalla: “Sin conexión” y, en la web, “Hay una versión nueva”. Sale y se va hacia arriba, por el mismo camino."
        source="components/system/top-notice.tsx · TopNotice (lo usan update-prompt.tsx y el aviso sin conexión)"
      >
        <HanetButton
          label="Sin conexión"
          variant="surface"
          onPress={() => overlay(<TopNotice icon="cloud-offline-outline" text={t('components.errors.appErrorLayer.sinConexionVesLoUltimo')} action={{ label: t('common.reintentar'), onPress: () => overlay(null) }} />, 5000)}
        />
        <HanetButton
          label="Versión nueva (web)"
          variant="surface"
          onPress={() => overlay(<TopNotice icon="sparkles-outline" text={t('components.system.updatePrompt.hayUnaVersionNuevaDe')} action={{ label: t('components.system.updatePrompt.actualizar'), onPress: () => overlay(null) }} />, 6000)}
        />
      </Section>

      <Section
        title="Resumen al actualizar"
        description="El primer Inicio después de actualizar HaNet muestra lo más importante de la versión, una vez. Sale de los highlights del changelog (o de sus primeras 3 novedades) y se apaga en Configuraciones."
        source="components/system/whats-new-dialog.tsx · WhatsNewDialog (decide cuándo) y WhatsNewPrompt (el diálogo)"
      >
        <HanetButton label="Ver el resumen" variant="surface" onPress={() => setWhatsNew(currentRelease())} />
      </Section>
      <WhatsNewPrompt release={whatsNew} onClose={() => setWhatsNew(null)} onSeeAll={() => setWhatsNew(null)} />

      <Section
        title="Buscador"
        description="El buscador del Inicio es una píldora que abre la búsqueda. Mientras nadie la toca va pasando lo que se puede encontrar (la próxima evaluación, una clase, una herramienta), una línea cada 3 segundos: la que está sale hacia arriba y la siguiente sube. Se detiene con la pantalla atrás y, con “Reducir movimiento”, solo cambia con un fundido. La variante de vidrio va sobre la foto del Inicio de escritorio."
        source="components/ui/search-pill.tsx · SearchPill (lo usan TopHeader y el Inicio de escritorio)"
      >
        <Stage canvas>
          <SearchPill label="Buscar en HaNet" shortLabel="Buscar" suggestions={['Matemática', 'Feria científica', 'Horario', 'Escala de notas']} onPress={() => setNote('En el Inicio esto abre la búsqueda.')} />
          <SearchPill label="Buscar en HaNet" suggestions={['Horario']} still tone="glass" onPress={() => setNote('En el Inicio esto abre la búsqueda.')} />
        </Stage>
      </Section>

      <Section
        title="Liquid Glass"
        description="En iPhone con iOS 26, los controles que flotan sobre el contenido son de vidrio: las flechas del Calendar, el buscador del Inicio y su campo, el botón para cerrar al destapar una nota, la selección de los días del Calendar y la de las barras de opciones, que se infla un poco al moverse. Al presionarlos solo se hunden (el vidrio no cambia de opacidad). En Android, la web y iPhones anteriores conservan su fondo sólido."
        source="components/ui/liquid-glass.tsx · LIQUID_GLASS, GlassFill, AnimatedGlassView, liftGlass, GlassPressed, glassClear"
      >
        <Stage canvas>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ejemplo de botón de vidrio"
            onPress={() => setNote(LIQUID_GLASS ? 'Este teléfono dibuja Liquid Glass.' : 'Aquí no hay Liquid Glass: el botón queda sólido.')}
            style={({ pressed }) => [showcaseStyles.glassButton, LIQUID_GLASS && glassClear, pressed && (LIQUID_GLASS ? GlassPressed : AppPressed)]}
          >
            <GlassFill radius={22} />
            <Ionicons name="chevron-forward" size={20} color={AppColors.textSecondary} />
          </Pressable>
          <HanetSegmented
            accessibilityLabel="Ejemplo de opciones"
            options={[{ value: 'a', label: '1er semestre', accessibilityLabel: 'Primer semestre' }, { value: 'b', label: '2° semestre', accessibilityLabel: 'Segundo semestre' }, { value: 'c', label: 'Anual', accessibilityLabel: 'Anual' }]}
            value={segment}
            onChange={setSegment}
          />
        </Stage>
      </Section>

      <Section
        title="Resultado de búsqueda"
        description="Una fila de la búsqueda, dentro de un grupo de ajustes: ícono, título con lo que coincide en negrita y una línea de contexto. El ícono rosado marca la mejor respuesta, la que abre la tecla “Buscar” del teclado, o lo que viene entre las sugerencias. Lo del Calendar que ya pasó va tachado, después de lo que viene."
        source="components/search/search-row.tsx · SearchRow · services/search.ts"
      >
        <SettingsGroup title="Tus clases (ejemplo, buscando “mate”)">
          <SearchRow top query="mate" item={{ key: 'a', kind: 'hall', title: 'Matemática', subtitle: 'Docente de ejemplo', icon: 'school-outline', href: '/classhall' }} onPress={() => {}} />
          <SearchRow query="mate" item={{ key: 'b', kind: 'calendar', title: 'Prueba de Matemática: funciones', subtitle: 'Mié 18 nov. · Evaluación sumativa', icon: 'calendar-outline', href: '/calendar' }} onPress={() => {}} />
          <SearchRow query="mate" item={{ key: 'd', kind: 'calendar', title: 'Control de Matemática', subtitle: 'Ayer · Evaluación formativa', icon: 'calendar-outline', href: '/calendar', past: true }} onPress={() => {}} />
          <SearchRow query="mate" item={{ key: 'c', kind: 'section', title: 'ClassHall', subtitle: 'Tus clases, tareas y materiales', icon: 'school-outline', href: '/classhall' }} onPress={() => {}} />
        </SettingsGroup>
      </Section>

      <Section
        title="Pantalla completa"
        description="Toda pantalla completa va en FrostedScreen: el contenido llega de borde a borde bajo la barra de estado, y solo una barra fija (como la del Calendar) lleva vidrio esmerilado. Esta misma pantalla es un FrostedScreen sin barra."
        source="components/ui/frosted-screen.tsx · FrostedScreen, withTopInset, useFrostedInset"
      >
        <Note>Sin ejemplo aparte: abre el Calendar para ver la barra de vidrio.</Note>
      </Section>
    </>
  );
}

const showcaseStyles = StyleSheet.create({
  glassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surface,
  },
});
