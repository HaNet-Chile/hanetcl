import { hallFormStyles as styles } from '@/components/classhall/hall-form';
import { ThemedText } from '@/components/themed-text';
import { withSheetFrame } from '@/components/ui/sheet-frame';
import { AppColors, AppRadii, AppSpacing } from '@/constants/design-tokens';
import { useRole } from '@/services/auth-service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// "Crear un evento": which kind first, then the event form for it.

type Kind = { key: string; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text: string; params: Record<string, string> };

function NewEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const role = useRole();
  const kinds: Kind[] = [
    { key: 'institution', icon: 'school-outline', title: t('organize.deLaInstitucion'), text: t('organize.enEventosParaTodaLa'), params: { kind: 'institution' } },
    { key: 'private', icon: 'ticket-outline', title: t('organize.privadoOFormal'), text: t('organize.soloLoVenQuienesTienen'), params: { kind: 'institution', private: '1' } },
    ...(role === 'HNT' ? [{ key: 'regional', icon: 'location-outline' as const, title: t('organize.hanetEventos'), text: t('organize.cercaDeMiEventosDe'), params: { kind: 'regional' } }] : []),
  ];

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={[styles.content, local.content, { paddingTop: AppSpacing.xxl, paddingBottom: insets.bottom + AppSpacing.lg }]}>
      <ThemedText accessibilityRole="header" style={styles.title}>{t('organize.crearUnEvento')}</ThemedText>
      <ThemedText style={styles.lead}>{t('organize.queTipoDeEvento')}</ThemedText>
      {kinds.map(kind => (
        <Pressable
          key={kind.key}
          accessibilityRole="button"
          accessibilityLabel={`${kind.title}. ${kind.text}`}
          onPress={() => router.replace({ pathname: '/event-form', params: kind.params })}
          style={({ pressed }) => [local.option, pressed && styles.pressed]}
        >
          <View style={local.icon}><Ionicons name={kind.icon} size={22} color={AppColors.textPrimary} /></View>
          <View style={local.text}>
            <ThemedText style={local.optionTitle}>{kind.title}</ThemedText>
            <ThemedText style={local.optionText}>{kind.text}</ThemedText>
          </View>
        </Pressable>
      ))}
      {Platform.OS !== 'ios' && (
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <ThemedText style={styles.cancelText}>{t('common.cancelar')}</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { gap: AppSpacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.lg, padding: AppSpacing.lg + 2, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surfaceMuted },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.surface },
  text: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17, lineHeight: 22, letterSpacing: -0.4, color: AppColors.textPrimary },
  optionText: { fontFamily: 'DMSans_500Medium', fontSize: 14, lineHeight: 20, color: AppColors.textSecondary },
});

export default withSheetFrame(NewEventScreen, AppColors.surface);
