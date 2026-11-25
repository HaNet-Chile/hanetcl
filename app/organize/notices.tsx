import { ThemedText } from '@/components/themed-text';
import { SentNoticeRow } from '@/components/organize/notice-ui';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { HanetButton } from '@/components/ui/hanet-button';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { useWide, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { listNotices, peekNotices } from '@/services/notices-service';
import type { NoticeHistory } from '@/services/notices-service';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// "Enviadas": the notifications the institution sent from Organizar, newest
// first. Admin and HNT see all of them and who sent each; the CEE, its own.

export default function SentNoticesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wide = useWide();
  const [history, setHistory] = useState<NoticeHistory | null | undefined>(() => peekNotices());
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    let live = true;
    setError('');
    setNow(Date.now());
    listNotices()
      .then(data => { if (live) setHistory(data); })
      .catch(loadError => {
        if (!live) return;
        setHistory(current => current ?? null);
        setError(describeAuthError(loadError, t('organize.notices.noPudimosCargarLasNotificaciones')));
      });
    return () => { live = false; };
  }, []);
  useFocusEffect(load);

  const notices = history?.notices ?? [];

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView contentContainerStyle={withTopInset([styles.page, widePageStyle(wide, 'reading')], insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow={t('anniversary.welcome.organizar')}
          title={t('organize.enviadas')}
          intro={history?.from ? t('organize.notices.lasNotificacionesDeFromY', { from: history.from }) : undefined}
          actions={<HanetButton label={t('common.enviarUnaNotificacion')} variant="surface" onPress={() => router.push('/organize/notify')} />}
        />
        {history === undefined && <ActivityIndicator color={AppColors.textSecondary} style={styles.loading} />}
        {!!error && <MessageCard message={error} onRetry={load} live />}
        {notices.length > 0 && (
          <View style={styles.group}>
            {notices.map((notice, index) => (
              <View key={notice.id}>
                {index > 0 && <View style={styles.divider} />}
                <SentNoticeRow notice={notice} now={now} />
              </View>
            ))}
          </View>
        )}
        {!!history && notices.length === 0 && <ThemedText style={styles.empty}>{t('organize.notices.todaviaNoSeEnviaNinguna')}</ThemedText>}
      </ScrollView>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.lg },
  loading: { marginVertical: AppSpacing.lg },
  group: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68, backgroundColor: AppColors.separator },
  empty: { ...AppType.footnote, color: AppColors.textSecondary, textAlign: 'center', paddingVertical: AppSpacing.xl },
});
