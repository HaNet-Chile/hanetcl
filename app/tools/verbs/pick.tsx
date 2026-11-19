import { ThemedText } from '@/components/themed-text';
import { typeLabel } from '@/components/tools/verb-ui';
import { HanetChip } from '@/components/ui/hanet-chip';
import { PageHeader } from '@/components/ui/page-header';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { useWide, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppRadii, AppRowPressed, AppSpacing, AppType } from '@/constants/design-tokens';
import { VERBS } from '@/constants/verbs';
import type { Verb, VerbType } from '@/constants/verbs';
import { updateSetup, useVerbsQuiz } from '@/services/verbs-quiz';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Elegir verbos: the student's own list for Verbos en inglés. Each tap saves
// it, so "Volver" is all it takes.

type Filter = 'all' | VerbType;

function fold(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function PickVerbsScreen() {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { setup } = useVerbsQuiz();
  const chosen = useMemo(() => new Set(setup.source.kind === 'custom' ? setup.source.verbs : []), [setup.source]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(() => {
    const needle = fold(query.trim());
    return VERBS.filter(verb => (filter === 'all' || verb.type === filter)
      && (!needle || fold(verb.infinitive).includes(needle) || fold(verb.translation).includes(needle)));
  }, [filter, query]);

  const save = (next: Set<string>) => {
    // Kept in the order of the verbs, so Repaso reads like the list.
    updateSetup({ source: { kind: 'custom', verbs: VERBS.filter(verb => next.has(verb.infinitive)).map(verb => verb.infinitive) } });
  };

  const toggle = (verb: Verb) => {
    const next = new Set(chosen);
    if (next.has(verb.infinitive)) next.delete(verb.infinitive);
    else next.add(verb.infinitive);
    save(next);
  };

  const allShownChosen = shown.length > 0 && shown.every(verb => chosen.has(verb.infinitive));
  const toggleShown = () => {
    const next = new Set(chosen);
    shown.forEach(verb => { if (allShownChosen) next.delete(verb.infinitive); else next.add(verb.infinitive); });
    save(next);
  };

  const header = (
    <View style={styles.header}>
      <PageHeader eyebrow={t('common.verbosEnIngles')} title={t('tools.verbs.elegirVerbos')} intro={t('tools.verbs.pick.llevasCountVerbosElegidos', { count: chosen.size })} />
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={AppColors.textSecondary} />
        <TextInput
          accessibilityLabel={t('tools.verbs.pick.buscarUnVerbo')}
          value={query}
          onChangeText={setQuery}
          placeholder={t('tools.verbs.pick.buscarEnInglesOEn')}
          placeholderTextColor={AppColors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={AppColors.accent}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {!!query && (
          <Pressable accessibilityRole="button" accessibilityLabel={t('components.appTabBar.borrarLaBusqueda')} hitSlop={10} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={AppColors.textSecondary} />
          </Pressable>
        )}
      </View>
      <View style={styles.chips}>
        {([['all', t('components.settings.homeCalendarSetting.todos')], ['irregular', t('tools.verbs.pick.irregulares')], ['regular', t('tools.verbs.pick.regulares')]] as [Filter, string][]).map(([value, label]) => (
          <HanetChip key={value} label={label} accessibilityRole="radio" compact selected={filter === value} onPress={() => setFilter(value)} />
        ))}
      </View>
      <View style={styles.bulk}>
        <ThemedText style={styles.bulkCount}>{t('tools.verbs.pick.countVerbos', { count: shown.length })}</ThemedText>
        {shown.length > 0 && (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={toggleShown}>
            <ThemedText style={styles.bulkAction}>{allShownChosen ? t('tools.verbs.pick.quitarEstos') : t('tools.verbs.pick.elegirEstos')}</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <FrostedScreen style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={verb => verb.infinitive}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={withTopInset([styles.page, widePageStyle(wide, 'reading')], insets.top)}
        ListHeaderComponent={header}
        ListEmptyComponent={<ThemedText style={styles.empty}>{t('tools.verbs.pick.noEncontramosEseVerbo')}</ThemedText>}
        renderItem={({ item: verb, index }) => {
          const on = chosen.has(verb.infinitive);
          const first = index === 0;
          const last = index === shown.length - 1;
          return (
            <View style={[styles.rowShell, first && styles.rowFirst, last && styles.rowLast]}>
              {!first && <View style={styles.divider} />}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${verb.infinitive}, ${verb.translation}, ${typeLabel(verb)}`}
                onPress={() => toggle(verb)}
                style={({ pressed }) => [styles.row, pressed && AppRowPressed]}
              >
                <View style={[styles.check, on && styles.checkOn]}>
                  {on && <Ionicons name="checkmark" size={15} color={AppColors.textPrimary} />}
                </View>
                <View style={styles.rowCopy}>
                  <ThemedText style={styles.rowTitle}>{verb.infinitive}</ThemedText>
                  <ThemedText style={styles.rowDetail}>{verb.translation}</ThemedText>
                </View>
                <ThemedText style={styles.rowType}>{typeLabel(verb)}</ThemedText>
              </Pressable>
            </View>
          );
        }}
      />
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150 },
  header: { gap: AppSpacing.lg, marginBottom: AppSpacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm, minHeight: 48, paddingHorizontal: AppSpacing.lg, borderRadius: AppRadii.pill, backgroundColor: AppColors.surface },
  searchInput: { ...AppType.body, flex: 1, color: AppColors.textPrimary, paddingVertical: 10, outlineStyle: 'none' as never },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  bulk: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: AppSpacing.xs },
  bulkCount: { ...AppType.callout, color: AppColors.textSecondary },
  bulkAction: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.accent },
  empty: { ...AppType.callout, color: AppColors.textSecondary, textAlign: 'center', marginTop: AppSpacing.xl },
  rowShell: { backgroundColor: AppColors.surface, overflow: 'hidden' },
  rowFirst: { borderTopLeftRadius: AppRadii.lg, borderTopRightRadius: AppRadii.lg },
  rowLast: { borderBottomLeftRadius: AppRadii.lg, borderBottomRightRadius: AppRadii.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: AppColors.separator, marginLeft: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, minHeight: 56, paddingHorizontal: AppSpacing.lg, paddingVertical: 10 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: AppColors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: AppColors.accent, borderColor: AppColors.accent },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { ...AppType.headline, color: AppColors.textPrimary },
  rowDetail: { ...AppType.footnote, color: AppColors.textSecondary },
  rowType: { ...AppType.caption, color: AppColors.textSecondary },
});
