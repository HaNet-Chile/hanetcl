import { ThemedText } from '@/components/themed-text';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import { t } from '@/i18n';
import { notificationAge } from '@/services/notifications-service';
import type { DeviceKind, SecurityDevice } from '@/services/security-service';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// One device where the account is open, in Configuraciones → Seguridad: what
// it is, its system and app, and when it was last used. The device in hand
// says so instead of a time. Sits inside a SettingsGroup like any other row.

const ICONS: Record<DeviceKind, keyof typeof Ionicons.glyphMap> = {
  phone: 'phone-portrait-outline',
  tablet: 'tablet-portrait-outline',
  computer: 'laptop-outline',
};

type Props = {
  device: Pick<SecurityDevice, 'kind' | 'name' | 'system' | 'app' | 'lastAt'>;
  /** The device in hand. */
  current?: boolean;
  now: number;
};

export function DeviceRow({ device, current = false, now }: Props) {
  const detail = [device.system, device.app].filter(Boolean).join(' · ');
  const when = current
    ? t('components.settings.deviceRow.esteDispositivo')
    : device.lastAt
      ? t('components.settings.deviceRow.ultimaActividadAge', { age: notificationAge(device.lastAt, now).toLowerCase() })
      : null;
  return (
    <View accessible accessibilityLabel={[device.name, detail, when].filter(Boolean).join('. ')} style={styles.row}>
      <View style={styles.badge}>
        <Ionicons name={ICONS[device.kind] ?? ICONS.phone} size={17} color={AppColors.textPrimary} />
      </View>
      <View style={styles.copy}>
        <ThemedText numberOfLines={1} style={styles.name}>{device.name}</ThemedText>
        {!!detail && <ThemedText numberOfLines={1} style={styles.detail}>{detail}</ThemedText>}
        {!!when && <ThemedText style={[styles.when, current && styles.current]}>{when}</ThemedText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'flex-start', gap: AppSpacing.md, paddingHorizontal: 14, paddingVertical: 12 },
  badge: { width: 30, height: 30, borderRadius: 9, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.surfaceMuted },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  name: { ...AppType.callout, fontSize: 15, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  detail: { ...AppType.caption, color: AppColors.textSecondary, opacity: 0.8 },
  when: { ...AppType.caption, color: AppColors.textSecondary, opacity: 0.8 },
  // Pink only as the accent that says "this one".
  current: { fontFamily: 'DMSans_700Bold', color: AppColors.accent, opacity: 1 },
});
