import { ThemedText } from '@/components/themed-text';
import { AppColors, AppRowPressed, AppSpacing, AppType } from '@/constants/design-tokens';
import { matchParts } from '@/services/search';
import type { SearchItem } from '@/services/search';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  item: SearchItem;
  /** What was typed: the parts of the title that match it go in bold. */
  query?: string;
  /**
   * The one to look at: the best answer (what the keyboard's "Buscar" opens)
   * or, among the suggestions, what comes next. Its icon goes in pink.
   */
  top?: boolean;
  onPress: () => void;
};

/**
 * One thing the search found, or recommends: icon, title and a line of
 * context. It goes inside a `SettingsGroup`, with its same measures.
 */
export function SearchRow({ item, query = '', top = false, onPress }: Props) {
  const parts = matchParts(item.title, query);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.subtitle ? `${item.title}, ${item.subtitle}` : item.title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && AppRowPressed]}
    >
      <View style={[styles.badge, top && styles.badgeTop]}>
        <Ionicons name={item.icon} size={17} color={top ? AppColors.accent : AppColors.textPrimary} />
      </View>
      <View style={styles.copy}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {parts.map((part, index) => (
            <ThemedText key={index} style={[styles.title, part.match && styles.match]}>{part.text}</ThemedText>
          ))}
        </ThemedText>
        {!!item.subtitle && <ThemedText numberOfLines={1} style={styles.subtitle}>{item.subtitle}</ThemedText>}
      </View>
      <Ionicons name="chevron-forward" size={17} color={AppColors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, paddingHorizontal: 14, paddingVertical: 9 },
  badge: { width: 30, height: 30, borderRadius: 9, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.surfaceMuted },
  badgeTop: { backgroundColor: AppColors.accentTint },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  title: { ...AppType.callout, fontFamily: 'DMSans_400Regular', fontSize: 15, color: AppColors.textPrimary },
  match: { fontFamily: 'DMSans_700Bold' },
  subtitle: { ...AppType.caption, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary, opacity: 0.8 },
});
