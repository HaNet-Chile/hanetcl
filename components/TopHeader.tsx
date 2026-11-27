import { AppColors, AppTheme, AppType } from '@/constants/design-tokens';
import { APP_VERSION_LABEL, APP_VERSION_NUMBER } from '@/constants/app-version';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { SearchPill } from '@/components/ui/search-pill';
import { OrganizeHeaderButton } from '@/components/organize/organize-entry';
import { SEARCH_PLACEHOLDER, pillSuggestions, useSearchIndex } from '@/services/search';
import { useSession } from '@/services/auth-service';
import { t } from '@/i18n';

/** The header's measures, shared with the search screen, whose field starts where this one is. */
export const TOP_HEADER = { paddingTop: 12, paddingHorizontal: 20, paddingBottom: 20, gap: 16 } as const;

/**
 * "HaNet Beta" with the version's numbers raised beside it. With `onPress`
 * the numbers open Novedades.
 */
export function HomeTitle({ onPressVersion }: { onPressVersion?: () => void }) {
  const version = (
    <ThemedText style={styles.version}>{APP_VERSION_NUMBER}</ThemedText>
  );
  return (
    <View style={styles.titleContainer}>
      <ThemedText accessibilityRole="header" numberOfLines={1} style={styles.titleText}>{t('components.topHeader.hanetBeta')}</ThemedText>
      {onPressVersion ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('components.topHeader.versionAppversionlabel', { appVersionLabel: APP_VERSION_LABEL })}
          accessibilityHint={t('components.topHeader.abreLasNovedades')}
          hitSlop={{ top: 14, bottom: 18, left: 6, right: 10 }}
          onPress={onPressVersion}
          style={({ pressed }) => pressed && styles.versionPressed}
        >
          {version}
        </Pressable>
      ) : version}
    </View>
  );
}

/**
 * The Home's header: the app's name and the search, a pill that goes through
 * what this account can find while nobody touches it and opens the search.
 * `transparent` lets what is behind show (the anniversary's glow). Who
 * organizes also gets Organizar's button, with a dot while a door is open.
 */
export default function TopHeader({ transparent, organizeLive = false }: { transparent?: boolean; organizeLive?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const index = useSearchIndex();
  const suggestions = React.useMemo(() => pillSuggestions(index), [index]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + TOP_HEADER.paddingTop }, transparent && styles.transparent]}>
      <HomeTitle onPressVersion={user ? () => router.push('/whats-new') : undefined} />
      {/* Without an account there is nothing of one's own to look through. */}
      {!!user && (
        <SearchPill
          label={SEARCH_PLACEHOLDER}
          shortLabel={t('components.schedule.blockEditor.buscar')}
          suggestions={suggestions}
          onPress={() => router.push('/search')}
          style={styles.search}
        />
      )}
      {/* Organizar, for who organizes; its dot says an event's door is open. */}
      {!!user && <OrganizeHeaderButton live={organizeLive} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TOP_HEADER.gap,
    minHeight: 44 + TOP_HEADER.paddingBottom,
    paddingHorizontal: TOP_HEADER.paddingHorizontal,
    paddingBottom: TOP_HEADER.paddingBottom,
    backgroundColor: AppColors.canvas,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
  },
  titleText: {
    ...AppType.title3,
    // Full black in the light theme; the dark one keeps its soft white.
    color: AppTheme.scheme === 'light' ? AppColors.textPrimary : AppColors.textSecondary,
  },
  // Raised like an exponent: small, and near 0 tracking as small text wants.
  version: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: AppColors.textSecondary,
    opacity: 0.72,
    fontVariant: ['tabular-nums'],
  },
  versionPressed: {
    opacity: 0.6,
  },
  search: {
    flex: 1,
    minWidth: 0,
  },
});
