import { ThemedText } from '@/components/themed-text';
import { InfiniteGame, SoloGame, VerbCountdown } from '@/components/tools/verb-games';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import type { Verb } from '@/constants/verbs';
import { currentSession, getSetup, loadVerbsQuiz, startSession, updateAudio, useVerbsQuiz } from '@/services/verbs-quiz';
import { playEffect, stopAllVerbAudio } from '@/services/verbs-sound';
import type { PlaySession } from '@/services/verbs-quiz';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// A game of Verbos en inglés, full screen: the countdown, then Solitario or
// Infinito. Leaving in the middle asks first, since nothing is kept.

type Phase = 'countdown' | 'playing' | 'done';

export default function PlayVerbsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [session, setSession] = useState<PlaySession | null>(() => currentSession());
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [confirmExit, setConfirmExit] = useState(false);
  const { audio } = useVerbsQuiz();
  const muted = !audio.sound && !audio.music;

  // Nothing keeps playing once the game screen is gone.
  useEffect(() => () => stopAllVerbAudio(), []);

  // Opened directly (a reload of the web page): a new game with the saved setup.
  useEffect(() => {
    if (session) return;
    let alive = true;
    void loadVerbsQuiz().then(() => {
      if (alive) setSession(startSession(getSetup()));
    });
    return () => { alive = false; };
  }, [session]);

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/tools/verbs');
  }, [router]);

  const close = useCallback(() => {
    if (phase === 'playing') {
      playEffect('surrender');
      setConfirmExit(true);
    } else leave();
  }, [leave, phase]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  const replay = (only?: Verb[]) => {
    if (!session) return;
    stopAllVerbAudio();
    setSession(startSession(session.setup, only));
    setRound(value => value + 1);
    setPhase('countdown');
  };

  const setup = session?.setup;
  const title = !setup ? '' : setup.mode === 'infinite' ? t('tools.verbs.infinito') : setup.style === 'challenge' ? t('tools.verbs.play.solitarioDesafio') : t('tools.verbs.play.solitarioRepaso');
  const finished = useCallback(() => setPhase('done'), []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + AppSpacing.sm, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={phase === 'playing' ? t('tools.verbs.play.salirDeLaPartida') : t('common.cerrar')}
          hitSlop={8}
          onPress={close}
          style={({ pressed }) => [styles.round, pressed && AppPressed]}
        >
          <Ionicons name="close" size={22} color={AppColors.textPrimary} />
        </Pressable>
        <ThemedText style={styles.topTitle}>{title}</ThemedText>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('tools.verbs.play.sonido')}
          accessibilityState={{ checked: !muted }}
          hitSlop={8}
          onPress={() => updateAudio(muted ? { sound: true, music: true } : { sound: false, music: false })}
          style={({ pressed }) => [styles.round, pressed && AppPressed]}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={muted ? AppColors.textSecondary : AppColors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {!session && <ActivityIndicator color={AppColors.textSecondary} style={styles.loading} />}
        {!!session && phase === 'countdown' && <VerbCountdown key={`count-${round}`} onDone={() => setPhase('playing')} />}
        {!!session && phase !== 'countdown' && session.setup.mode === 'solo' && (
          <SoloGame
            key={`solo-${round}`}
            verbs={session.verbs}
            forms={session.setup.forms}
            style={session.setup.style}
            source={session.setup.source}
            onFinished={finished}
            onReplay={replay}
            onExit={leave}
          />
        )}
        {!!session && phase !== 'countdown' && session.setup.mode === 'infinite' && (
          <InfiniteGame
            key={`infinite-${round}`}
            verbs={session.verbs}
            paused={confirmExit}
            onFinished={finished}
            onReplay={() => replay()}
            onExit={leave}
          />
        )}
      </View>

      <HanetDialog
        visible={confirmExit}
        onRequestClose={() => setConfirmExit(false)}
        dismissOnBackdrop
        title={t('tools.verbs.play.salirDeLaPartida2')}
        body={t('tools.verbs.play.loQueLlevasNoSe')}
      >
        <HanetDialogActions>
          <HanetButton label={t('tools.verbs.play.seguirJugando')} variant="surface" onPress={() => setConfirmExit(false)} style={dialogStyles.action} />
          <HanetButton label={t('tools.verbs.play.salir')} onPress={() => { setConfirmExit(false); leave(); }} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas, paddingHorizontal: AppSpacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: AppSpacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  round: { width: 40, height: 40, borderRadius: AppRadii.pill, backgroundColor: AppColors.surface, alignItems: 'center', justifyContent: 'center' },
  topTitle: { ...AppType.headline, color: AppColors.textPrimary, flex: 1, textAlign: 'center' },
  body: { flex: 1 },
  loading: { marginTop: AppSpacing.xxl },
});
