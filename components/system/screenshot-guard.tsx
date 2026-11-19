import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { ThemedText } from '@/components/themed-text';
import { AppColors, AppType } from '@/constants/design-tokens';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { t } from '@/i18n';

// Decidido por muxp el 2026-11-19: los QR de HaNet (el HN-QR del perfil y el
// de cada entrada) cambian cada 30 s, así que una captura no sirve en la
// puerta. Si alguien saca una mientras uno está en pantalla, se le avisa.
// Funciona en iPhone y en Android 14+ (permiso DETECT_SCREEN_CAPTURE); en
// la web no existe.

type Props = {
  /** Listens only while a QR is on screen. */
  active: boolean;
  /** For a ticket: the dialog points to Regalar and Compartir como imagen. */
  ticket?: boolean;
};

export function ScreenshotGuard({ active, ticket = false }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = ScreenCapture.addScreenshotListener(() => {
        setVisible(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      });
    } catch {
      // Without the native module (an old build) there is simply no warning.
    }
    return () => subscription?.remove();
  }, [active]);

  return (
    <HanetDialog
      visible={visible}
      onRequestClose={() => setVisible(false)}
      dismissOnBackdrop
    >
      <View style={styles.icon} accessible={false}>
        <Ionicons name="ban-outline" size={28} color={AppColors.accent} />
      </View>
      <ThemedText accessibilityRole="header" style={styles.title}>{t('components.system.screenshotGuard.lasCapturasNoSirvenPara')}</ThemedText>
      <ThemedText style={styles.body}>
        {ticket
          ? t('components.system.screenshotGuard.elCodigoDeLaEntrada')
          : t('components.system.screenshotGuard.tuHnQrCambiaCada')}
      </ThemedText>
      <HanetDialogActions>
        <HanetButton label={t('events.entendido')} variant="surface" onPress={() => setVisible(false)} style={dialogStyles.action} />
      </HanetDialogActions>
    </HanetDialog>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.accentTint,
  },
  title: { ...AppType.title3, color: AppColors.textPrimary },
  body: { ...AppType.callout, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary },
});
