import { ThemedText } from '@/components/themed-text';
import { HanetButton } from '@/components/ui/hanet-button';
import { dialogStyles, HanetDialog, HanetDialogActions } from '@/components/ui/hanet-dialog';
import { AppColors, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { t } from '@/i18n';
import { pushPermission, pushSupport, wasPushPromptDismissed } from '@/services/push-service';
import { currentRelease, markWhatsNewSeen, shouldShowWhatsNew } from '@/services/whats-new-prompt';
import type { ReleaseSummary } from '@/services/whats-new-prompt';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

// A beat after the Home settles, like the notifications question.
const SHOW_DELAY_MS = 900;

/**
 * The first Home after updating HaNet (a build, an update over the air or the
 * web's "Actualizar") shows the new version's highlights once. Turned off in
 * Configuraciones → Acerca de HaNet. `ready` is for the Home to hold it back
 * while something else is on top; when the notifications question is about
 * to show, this one waits for the next visit.
 */
export function WhatsNewDialog({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [release, setRelease] = useState<ReleaseSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let active = true;
      const timer = setTimeout(() => {
        void (async () => {
          if (!(await shouldShowWhatsNew()) || !active) return;
          // One question at a time: the notifications one goes first.
          if (pushSupport() === 'supported' && (await pushPermission()) === 'undetermined' && !(await wasPushPromptDismissed())) return;
          if (active) setRelease(currentRelease());
        })().catch(() => undefined);
      }, SHOW_DELAY_MS);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [ready])
  );

  const close = (openAll: boolean) => {
    setRelease(null);
    void markWhatsNewSeen();
    if (openAll) router.push('/whats-new');
  };

  return <WhatsNewPrompt release={release} onClose={() => close(false)} onSeeAll={() => close(true)} />;
}

/**
 * The dialog itself, without deciding when it shows (Sistema HaNet UI opens
 * it with its own button).
 */
export function WhatsNewPrompt({ release, onClose, onSeeAll }: { release: ReleaseSummary | null; onClose: () => void; onSeeAll: () => void }) {
  return (
    <HanetDialog
      visible={!!release}
      onRequestClose={onClose}
      dismissOnBackdrop
      title={release?.title || t('components.system.whatsNewDialog.hanetSeActualizo')}
    >
      {!!release && (
        <>
          <View style={styles.badge}>
            <ThemedText style={styles.badgeText}>v{release.version}</ThemedText>
          </View>
          <View style={styles.lines}>
            {release.lines.map(line => (
              <View key={line} style={styles.line}>
                <View style={styles.dot} />
                <ThemedText style={styles.lineText}>{line}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText style={styles.note}>{t('components.system.whatsNewDialog.puedesApagarEsteResumen')}</ThemedText>
        </>
      )}
      <HanetDialogActions>
        <HanetButton label={t('components.system.whatsNewDialog.verTodo')} variant="surface" onPress={onSeeAll} style={dialogStyles.action} />
        <HanetButton label={t('components.system.whatsNewDialog.listo')} variant="accent" onPress={onClose} style={dialogStyles.action} />
      </HanetDialogActions>
    </HanetDialog>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: AppSpacing.sm, paddingVertical: 2, borderRadius: AppRadii.pill, backgroundColor: AppColors.accent },
  badgeText: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.controlOnActive },
  lines: { gap: AppSpacing.sm },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: AppSpacing.sm },
  dot: { width: 6, height: 6, marginTop: 8, borderRadius: AppRadii.pill, backgroundColor: AppColors.accent },
  lineText: { ...AppType.footnote, flex: 1, color: AppColors.textPrimary },
  note: { ...AppType.caption, color: AppColors.textSecondary, opacity: 0.8 },
});
