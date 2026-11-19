import { ThemedText } from '@/components/themed-text';
import { OrganizedEventRow } from '@/components/organize/organize-ui';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { useWide, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { describeAuthError } from '@/services/auth-service';
import { eventFilter, listOrganizedEvents, peekOrganizedEvents } from '@/services/organize-service';
import type { EventFilter, OrganizedEvents } from '@/services/organize-service';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Every event that whoever organizes can manage, from yesterday on, with
// drafts and private events: by kind.

export default function OrganizedEventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wide = useWide();
  const [list, setList] = useState<OrganizedEvents | null | undefined>(() => peekOrganizedEvents());
  const [filter, setFilter] = useState<EventFilter>('all');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let live = true;
    setError('');
    listOrganizedEvents()
      .then(data => { if (live) setList(data); })
      .catch(loadError => {
        if (!live) return;
        setList(current => current ?? null);
        setError(describeAuthError(loadError, t('organize.noPudimosCargarTusEventos')));
      });
    return () => { live = false; };
  }, []);
  useFocusEffect(load);

  const filters: { value: EventFilter; label: string }[] = [
    { value: 'all', label: t('organize.todos') },
    { value: 'institution', label: t('organize.institucion') },
    { value: 'private', label: t('organize.privadoYFormal') },
    ...(list?.canRegional ? [{ value: 'regional' as const, label: t('organize.hanetEventos') }] : []),
  ];
  const shown = (list?.events ?? []).filter(event => filter === 'all' || eventFilter(event) === filter);

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView contentContainerStyle={withTopInset([styles.page, widePageStyle(wide, 'reading')], insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow={t('organize.organizar')}
          title={t('organize.eventos')}
          actions={<HanetButton label={t('organize.crearUnEvento')} variant="surface" onPress={() => router.push('/organize/new')} />}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map(option => (
            <HanetChip key={option.value} label={option.label} selected={filter === option.value} compact onPress={() => setFilter(option.value)} />
          ))}
        </ScrollView>
        {list === undefined && <ActivityIndicator color={AppColors.textSecondary} style={styles.loading} />}
        {!!error && <MessageCard message={error} onRetry={load} live />}
        {shown.length > 0 && (
          <View style={styles.group}>
            {shown.map((event, index) => (
              <View key={event.id}>
                {index > 0 && <View style={styles.divider} />}
                <OrganizedEventRow event={event} onPress={() => router.push({ pathname: '/organize/event', params: { id: event.id } })} />
              </View>
            ))}
          </View>
        )}
        {!!list && shown.length === 0 && <ThemedText style={styles.empty}>{t('organize.noHayEventosDeEste')}</ThemedText>}
      </ScrollView>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.lg },
  filters: { gap: AppSpacing.sm },
  loading: { marginVertical: AppSpacing.lg },
  group: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 78, backgroundColor: AppColors.separator },
  empty: { ...AppType.footnote, color: AppColors.textSecondary, textAlign: 'center', paddingVertical: AppSpacing.xl },
});
