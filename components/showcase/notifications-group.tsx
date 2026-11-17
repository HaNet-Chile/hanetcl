import { HomeNotificationsPreview } from '@/components/notifications/home-notifications';
import { NotificationRow } from '@/components/notifications/notification-row';
import { PullHint } from '@/components/notifications/pull-hint';
import { PushPermissionPrompt } from '@/components/notifications/push-permission-dialog';
import { GroupTitle, Note, Section, Stage } from '@/components/showcase/showcase-ui';
import { HanetButton } from '@/components/ui/hanet-button';
import { AppColors, AppRadii, AppSpacing } from '@/constants/design-tokens';
import { SPRING_SMOOTH, rubberband } from '@/constants/motion';
import type { HnNotification, NotificationsState } from '@/services/notifications-service';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

// Notificaciones (PR #35): the rows, the end of the Home and the hint that
// turns around when letting go would open them. Nothing here is real.

const MINUTE = 60_000;
const THRESHOLD = 72;

function samples(now: number): HnNotification[] {
  return [
    { id: 'n1', kind: 'grade', title: 'Tienes una nota nueva', body: 'Matemática · Prueba 2. Destápala en ClassHall.', url: null, at: now - 4 * MINUTE },
    { id: 'n2', kind: 'announcement', title: 'Historia: anuncio nuevo', body: 'Mañana la clase es en la biblioteca. Traigan su cuaderno.', url: null, at: now - 52 * MINUTE },
    { id: 'n4', kind: 'signIn', title: 'Nuevo inicio de sesión', body: 'Entraron a tu cuenta desde Chrome en Windows a las 14:32. ¿No fuiste tú? Revisa tus dispositivos.', url: null, at: now - 2 * 60 * MINUTE },
    { id: 'n3', kind: 'dayChange', title: 'Salida anticipada el viernes', body: 'Las clases terminan a las 12:30 por consejo de profesores.', url: null, at: now - 26 * 60 * MINUTE },
  ];
}

function haptic() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Drag the box up: the hint follows, arms at the threshold and settles back. */
function PullDemo() {
  const pull = useSharedValue(0);
  const armed = useSharedValue(false);
  const pan = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate(event => {
      const distance = Math.max(0, rubberband(-event.translationY, 420));
      pull.set(distance);
      const next = distance >= THRESHOLD;
      if (next !== armed.get()) {
        armed.set(next);
        if (next) scheduleOnRN(haptic);
      }
    })
    .onFinalize(() => {
      armed.set(false);
      pull.set(withSpring(0, SPRING_SMOOTH));
    });
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -pull.get() * 0.5 }] }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.pullStage} accessible accessibilityLabel="Ejemplo: arrastra hacia arriba para ver cómo cambia el aviso">
        <Animated.View style={[styles.pullCard, cardStyle]} />
        <PullHint pull={pull} armed={armed} threshold={THRESHOLD} direction="up" pullLabel="Desliza para ver tus notificaciones" releaseLabel="Suelta para abrir tus notificaciones" style={styles.pullHint} />
      </View>
    </GestureDetector>
  );
}

export function NotificationsGroup() {
  const [now] = useState(() => Date.now());
  const [items] = useState(() => samples(now));
  const [note, setNote] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const state: NotificationsState = { items, seenAt: now - 30 * MINUTE, unread: 1 };

  return (
    <>
      <GroupTitle>Notificaciones</GroupTitle>

      <Section
        title="Notificación"
        description="Una fila de la sección y del resumen del Inicio. El punto rosado marca lo nuevo; una nota nueva lleva las rayas y nunca muestra la nota."
        source="components/notifications/notification-row.tsx · NotificationRow"
      >
        <Stage>
          {items.map(item => (
            <NotificationRow key={item.id} item={item} unread={item.at > state.seenAt} now={now} />
          ))}
        </Stage>
      </Section>

      <Section
        title="Final del Inicio"
        description="“Tienes N notificaciones nuevas” y las 2 más recientes, sobre el fondo del Inicio. Nada más se ve sin tocar."
        source="components/notifications/home-notifications.tsx · HomeNotificationsPreview"
      >
        <HomeNotificationsPreview state={state} onOpen={() => setNote('En el Inicio esto abre la sección de notificaciones.')} />
        <Note>{note}</Note>
      </Section>

      <Section
        title="Deslizar para abrir"
        description="Arrastra la tarjeta hacia arriba. La flecha apunta hacia donde tirar y, al pasar el umbral, vibra, se da vuelta y cambia el texto. Al soltar vuelve a su lugar con un resorte."
        source="components/notifications/pull-hint.tsx · PullHint, con usePullDown (pull-down.ts)"
      >
        <PullDemo />
      </Section>

      <Section
        title="Permiso de notificaciones"
        description="La primera vez que una cuenta llega al Inicio, HaNet pregunta antes que el sistema (que solo pregunta una vez). “Ahora no” queda guardado en ese teléfono."
        source="components/notifications/push-permission-dialog.tsx · PushPermissionDialog (decide cuándo) y PushPermissionPrompt (el diálogo)"
      >
        <HanetButton label="Ver el diálogo" variant="surface" onPress={() => setAsking(true)} />
      </Section>
      <PushPermissionPrompt visible={asking} onAllow={() => setAsking(false)} onNotNow={() => setAsking(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  pullStage: {
    height: 220,
    justifyContent: 'flex-start',
    padding: AppSpacing.lg,
    borderRadius: AppRadii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: AppColors.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppColors.surfaceMuted,
  },
  pullCard: {
    height: 96,
    borderRadius: AppRadii.md,
    borderCurve: 'continuous',
    backgroundColor: AppColors.surface,
  },
  pullHint: {
    marginTop: AppSpacing.xl,
  },
});
