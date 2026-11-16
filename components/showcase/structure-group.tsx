import { GroupTitle, Note, Section, Stage, useOverlay } from '@/components/showcase/showcase-ui';
import { SettingsGroup, SettingsLinkRow, SettingsNote, SettingsToggleRow } from '@/components/settings/settings-list';
import { TopNotice } from '@/components/system/top-notice';
import { HanetButton } from '@/components/ui/hanet-button';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { t } from '@/i18n';
import React, { useState } from 'react';

// Estructura: the pieces every page is built from (PR #27 to #43).

export function StructureGroup() {
  const overlay = useOverlay();
  const [morning, setMorning] = useState(true);
  const [lock, setLock] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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
        title="Pantalla completa"
        description="Toda pantalla completa va en FrostedScreen: el contenido llega de borde a borde bajo la barra de estado, y solo una barra fija (como la del Calendar) lleva vidrio esmerilado. Esta misma pantalla es un FrostedScreen sin barra."
        source="components/ui/frosted-screen.tsx · FrostedScreen, withTopInset, useFrostedInset"
      >
        <Note>Sin ejemplo aparte: abre el Calendar para ver la barra de vidrio.</Note>
      </Section>
    </>
  );
}
