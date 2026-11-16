import { HomeTitle, TOP_HEADER } from '@/components/TopHeader';
import { SearchRow } from '@/components/search/search-row';
import { SettingsGroup } from '@/components/settings/settings-list';
import { ThemedText } from '@/components/themed-text';
import { HanetChip } from '@/components/ui/hanet-chip';
import { useKeyboardOverlap } from '@/components/ui/keyboard';
import { MessageCard } from '@/components/ui/message-card';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppTouch, AppType } from '@/constants/design-tokens';
import { SPRING_SMOOTH } from '@/constants/motion';
import { useSideNav } from '@/hooks/use-desktop-layout';
import { SEARCH_PLACEHOLDER, clearRecentSearches, recentSearches, rememberSearch, searchIndex, suggestionsFrom, useSearchIndex } from '@/services/search';
import type { SearchItem } from '@/services/search';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { LayoutChangeEvent, TextInputInstance } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// The Home's search (services/search.ts). It opens over the Home with a
// fade, and its header starts drawn exactly like the Home's: the name and the
// field where the pill was. From there the name folds away, the field takes
// the whole width and the button to close comes in, so the pill seems to
// grow into the field. Closing goes back the same way.

/** The tabs' screens: opening one leaves the search instead of stacking over it. */
const TAB_ROUTES = ['/', '/explore', '/calendar', '/events', '/feed'];
const CLOSE_SIZE = AppTouch.minimum;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Beside the side navigation there is no name to fold: the field is already whole.
  const desktop = useSideNav().width > 0;
  const reduceMotion = useReducedMotion();
  const keyboard = useKeyboardOverlap();
  const input = useRef<TextInputInstance>(null);

  const index = useSearchIndex(true);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    void recentSearches().then(kept => { if (active) setRecent(kept); });
    return () => { active = false; };
  }, []);

  const typed = query.trim();
  const results = useMemo(() => searchIndex(index, typed, now), [index, now, typed]);
  const suggestions = useMemo(() => suggestionsFrom(index, now), [index, now]);

  // 0 is the Home's header, 1 the search's. It waits for the name's width,
  // which is what the field has to grow over.
  const open = useSharedValue(desktop ? 1 : 0);
  const [titleWidth, setTitleWidth] = useState(0);
  const measured = desktop || titleWidth > 0;
  const move = (to: 0 | 1) => open.set(reduceMotion ? withTiming(to, { duration: 160 }) : withSpring(to, SPRING_SMOOTH));
  useEffect(() => {
    if (measured) move(1);
    // Only when the name's width arrives: `move` changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured]);

  const titleStyle = useAnimatedStyle(() => {
    const progress = open.get();
    return {
      width: titleWidth > 0 ? interpolate(progress, [0, 1], [titleWidth, 0]) : undefined,
      marginRight: interpolate(progress, [0, 1], [TOP_HEADER.gap, 0]),
      opacity: interpolate(progress, [0, 0.6], [1, 0], 'clamp'),
    };
  });
  const closeStyle = useAnimatedStyle(() => {
    const progress = open.get();
    return {
      width: interpolate(progress, [0, 1], [0, CLOSE_SIZE]),
      marginLeft: interpolate(progress, [0, 1], [0, AppSpacing.sm]),
      opacity: interpolate(progress, [0.4, 1], [0, 1], 'clamp'),
      transform: [{ scale: interpolate(progress, [0, 1], [0.6, 1]) }],
    };
  });
  const contentStyle = useAnimatedStyle(() => {
    const progress = open.get();
    return { opacity: progress, transform: [{ translateY: reduceMotion ? 0 : interpolate(progress, [0, 1], [10, 0]) }] };
  });

  const close = () => {
    Keyboard.dismiss();
    move(0);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const openItem = (item: SearchItem) => {
    setRecent(rememberSearch(typed, recent));
    Keyboard.dismiss();
    const pathname = typeof item.href === 'string' ? item.href : item.href.pathname;
    if (TAB_ROUTES.includes(pathname)) {
      if (router.canDismiss()) router.dismissAll();
      router.navigate(item.href);
    } else {
      router.push(item.href);
    }
  };

  const fillQuery = (text: string) => {
    setQuery(text);
    input.current?.focus();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + TOP_HEADER.paddingTop }]}>
        <View style={styles.headerRow}>
          {!desktop && (
            <Animated.View style={[styles.titleWrap, titleStyle]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View
                onLayout={(event: LayoutChangeEvent) => { if (!titleWidth) setTitleWidth(Math.ceil(event.nativeEvent.layout.width)); }}
                style={titleWidth > 0 ? { width: titleWidth } : undefined}
              >
                <HomeTitle />
              </View>
            </Animated.View>
          )}
          <View style={styles.field}>
            <Ionicons name="search" size={18} color={AppColors.textSecondary} style={styles.fieldIcon} />
            <TextInput
              ref={input}
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={SEARCH_PLACEHOLDER}
              placeholderTextColor={PLACEHOLDER}
              selectionColor={AppColors.accent}
              keyboardAppearance="dark"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              enterKeyHint="search"
              onSubmitEditing={() => { if (results.top) openItem(results.top); }}
              onKeyPress={event => { if (event.nativeEvent.key === 'Escape') close(); }}
              accessibilityLabel={SEARCH_PLACEHOLDER}
              style={styles.input}
            />
            {query.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('components.appTabBar.borrarLaBusqueda')}
                hitSlop={10}
                onPress={() => fillQuery('')}
                style={({ pressed }) => [styles.clear, pressed && AppPressed]}
              >
                <Ionicons name="close" size={14} color={AppColors.canvas} />
              </Pressable>
            )}
          </View>
          <Animated.View style={[styles.closeWrap, closeStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('components.appTabBar.cerrarLaBusqueda')}
              onPress={close}
              style={({ pressed }) => [styles.close, pressed && AppPressed]}
            >
              <Ionicons name="close" size={20} color={AppColors.textPrimary} />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[styles.body, contentStyle]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(keyboard.overlap, insets.bottom) + AppSpacing.xl }]}
        >
          {typed ? (
            results.groups.length > 0 ? (
              results.groups.map(group => (
                <SettingsGroup key={group.kind} title={group.label}>
                  {group.items.map(item => (
                    <SearchRow key={item.key} item={item} query={typed} top={item.key === results.top?.key} onPress={() => openItem(item)} />
                  ))}
                </SettingsGroup>
              ))
            ) : (
              <MessageCard live message={t('search.noEncontramosNadaParaTyped', { typed })} />
            )
          ) : (
            <>
              {recent.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <ThemedText accessibilityRole="header" style={styles.sectionTitle}>{t('search.busquedasRecientes')}</ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('search.borrarLasBusquedasRecientes')}
                      hitSlop={14}
                      onPress={() => setRecent(clearRecentSearches())}
                      style={({ pressed }) => pressed && styles.linkPressed}
                    >
                      <ThemedText style={styles.link}>{t('common.borrar')}</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.chips}>
                    {recent.map(text => (
                      <HanetChip key={text} label={text} icon={<Ionicons name="time-outline" size={15} color={AppColors.textSecondary} />} onPress={() => fillQuery(text)} />
                    ))}
                  </View>
                </View>
              )}
              {suggestions.length > 0 && (
                <SettingsGroup title={t('search.sugerencias')} footer={t('search.buscaEnTusClasesEl')}>
                  {suggestions.map((item, position) => <SearchRow key={item.key} item={item} top={position === 0 && item.at !== undefined} onPress={() => openItem(item)} />)}
                </SettingsGroup>
              )}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const PLACEHOLDER = 'rgba(221,221,226,0.6)';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppColors.canvas,
  },
  header: {
    paddingHorizontal: TOP_HEADER.paddingHorizontal,
    paddingBottom: AppSpacing.md,
  },
  headerRow: {
    width: '100%',
    maxWidth: 760 - TOP_HEADER.paddingHorizontal * 2,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  // A row, so the name keeps its width while the wrap closes over it.
  titleWrap: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  field: {
    flex: 1,
    minWidth: 0,
    height: AppTouch.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: AppRadii.pill,
    backgroundColor: AppColors.surface,
  },
  fieldIcon: {
    opacity: 0.8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: AppTouch.minimum,
    paddingVertical: 0,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    letterSpacing: -0.2,
    color: AppColors.textPrimary,
    outlineStyle: 'none' as any,
  },
  clear: {
    width: 20,
    height: 20,
    borderRadius: AppRadii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceSoft,
  },
  closeWrap: {
    overflow: 'hidden',
  },
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: AppRadii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surface,
  },
  body: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: AppSpacing.lg,
    paddingTop: AppSpacing.sm,
    gap: AppSpacing.xl,
  },
  section: {
    gap: AppSpacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpacing.sm,
  },
  sectionTitle: {
    ...AppType.footnote,
    fontFamily: 'DMSans_700Bold',
    color: AppColors.textSecondary,
  },
  link: {
    ...AppType.footnote,
    fontFamily: 'DMSans_700Bold',
    color: AppColors.textPrimary,
  },
  linkPressed: {
    opacity: 0.6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppSpacing.sm,
  },
});
