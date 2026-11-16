import { ThemedText } from '@/components/themed-text';
import { PageHeader } from '@/components/ui/page-header';
import { MessageCard } from '@/components/ui/message-card';
import { AreaIcon } from '@/components/tools/area-icon';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { getElectividad, peekElectividad } from '@/services/electividad-service';
import type { ElectividadState } from '@/services/electividad-service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Herramientas: tools for school life. HaNet Electividad is a module of the
// institution; the grade scale and the calculator work on the phone alone, so
// they show even when Electividad can't load.

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [state, setState] = useState<ElectividadState | null | undefined>(() => peekElectividad());
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    getElectividad()
      .then(data => { if (alive) setState(data); })
      .catch(err => {
        if (!alive) return;
        setState(null);
        setError(describeAuthError(err, t('tools.noPudimosCargarTusHerramientas')));
      });
    return () => { alive = false; };
  }, []);

  const done = !!state?.result;

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView contentContainerStyle={withTopInset(styles.page, insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader eyebrow="HaNet" title={t('common.herramientas')} intro={t('tools.recursosParaTusDecisionesDel')} />

        {state === undefined && <ActivityIndicator color={AppColors.textSecondary} style={styles.loading} />}

        {state === null && (
          <MessageCard message={error} live />
        )}

        {!!state && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tools.hanetElectividadValue', { value: done ? t('tools.respondidoVerTuResultado') : t('tools.testDeInteresesParaElegir') })}
            onPress={() => router.push('/tools/electividad')}
            style={({ pressed }) => [styles.card, pressed && AppPressed]}
          >
            <View style={styles.cardTop}>
              <View style={styles.iconRow}>
                {(['qui', 'len', 'vis'] as const).map(area => (
                  <View key={area} style={styles.iconTile}>
                    <AreaIcon area={area} size={22} color={AppColors.accent} />
                  </View>
                ))}
              </View>
              <View style={[styles.status, done && styles.statusDone]}>
                {done && <Ionicons name="checkmark" size={14} color={AppColors.accent} />}
                <ThemedText style={styles.statusText}>{done ? t('tools.respondido') : t('tools.disponible')}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.cardTitle}>{t('tools.electividad.hanetElectividad')}</ThemedText>
            <ThemedText style={styles.cardText}>{t('tools.testDeInteresesParaElegir2')}</ThemedText>
            <View style={styles.cardFoot}>
              <ThemedText style={styles.cardLink}>{done ? t('tools.electividad.verMiResultado') : t('tools.comenzar')}</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={AppColors.textPrimary} />
            </View>
          </Pressable>
        )}

        <View style={styles.pair}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tools.escalaDeNotasPuntosANotas')}
            onPress={() => router.push('/tools/scale')}
            style={({ pressed }) => [styles.card, styles.small, pressed && AppPressed]}
          >
            <View style={styles.iconTile}>
              <Ionicons name="list-outline" size={22} color={AppColors.accent} />
            </View>
            <ThemedText style={styles.smallTitle}>{t('tools.scale.escalaDeNotas')}</ThemedText>
            <ThemedText style={styles.cardText}>{t('tools.dePuntosANotasDe')}</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tools.calculadoraDeNotasPromedioYLo')}
            onPress={() => router.push('/tools/grades')}
            style={({ pressed }) => [styles.card, styles.small, pressed && AppPressed]}
          >
            <View style={styles.iconTile}>
              <Ionicons name="calculator-outline" size={22} color={AppColors.accent} />
            </View>
            <ThemedText style={styles.smallTitle}>{t('tools.grades.calculadoraDeNotas')}</ThemedText>
            <ThemedText style={styles.cardText}>{t('tools.tuPromedioYCuantoNecesitas')}</ThemedText>
          </Pressable>
        </View>

        <View style={styles.soon}>
          <ThemedText style={styles.soonText}>{t('tools.proximamenteMasHerramientas')}</ThemedText>
        </View>
      </ScrollView>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.lg },
  loading: { marginTop: AppSpacing.xxl },
  card: { padding: 18, borderRadius: AppRadii.lg, backgroundColor: AppColors.surface, borderWidth: 1, borderColor: AppColors.hairline, gap: AppSpacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: AppSpacing.xs },
  iconRow: { flexDirection: 'row', gap: 6 },
  iconTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: AppColors.accentTint, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: AppRadii.pill, backgroundColor: AppColors.surfaceMuted },
  statusDone: { backgroundColor: AppColors.accentTint, paddingLeft: 7 },
  statusText: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  cardTitle: { ...AppType.title3, color: AppColors.textPrimary },
  cardText: { ...AppType.footnote, color: AppColors.textSecondary },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: AppSpacing.xs },
  cardLink: { ...AppType.headline, color: AppColors.textPrimary },
  pair: { flexDirection: 'row', gap: AppSpacing.md },
  small: { flex: 1, padding: 16 },
  smallTitle: { ...AppType.headline, color: AppColors.textPrimary, marginTop: AppSpacing.xs },
  soon: { alignItems: 'center', paddingVertical: AppSpacing.md },
  soonText: { ...AppType.caption, color: AppColors.surfaceSoft },
});
