import { ThemedText } from '@/components/themed-text';
import { VerbAnswerField, VerbTag, VerbTimeBar, formLabel, formShortLabel, typeLabel } from '@/components/tools/verb-ui';
import type { AnswerState } from '@/components/tools/verb-ui';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { KeyboardScroll } from '@/components/ui/keyboard';
import { AppColors, AppDisplay, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import type { Verb } from '@/constants/verbs';
import {
  INFINITE_RULES,
  VERB_FORMS,
  formatDuration,
  formatForm,
  isCorrect,
  recordInfinite,
  recordSolo,
  scoreSolo,
  shuffle,
} from '@/services/verbs-quiz';
import type { InfiniteBest, SoloAnswers, SoloBest, SoloResult, SoloStyle, VerbForm, VerbSource } from '@/services/verbs-quiz';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { t } from '@/i18n';

// The two games of Verbos en inglés, drawn inside app/tools/verbs/play.tsx,
// which owns the countdown, the close button and starting over.

const NATIVE = Platform.OS !== 'web';
const now = () => Date.now();

const haptic = {
  tick: () => { if (NATIVE) void Haptics.selectionAsync(); },
  hit: () => { if (NATIVE) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  miss: () => { if (NATIVE) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
  warn: () => { if (NATIVE) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
  win: () => { if (NATIVE) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
};

/** 3, 2, 1, ¡Ya! before a game. */
export function VerbCountdown({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(3);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);

  useEffect(() => {
    haptic.tick();
    const timer = setTimeout(() => {
      if (step > 0) setStep(step - 1);
      else done.current();
    }, step > 0 ? 700 : 450);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <View style={styles.countdown} accessibilityLiveRegion="assertive">
      <Animated.View key={step} entering={reduceMotion ? undefined : FadeIn.duration(120)}>
        <ThemedText style={[styles.countdownText, step === 0 && styles.countdownGo]}>{step > 0 ? String(step) : t('components.tools.verbGames.ya')}</ThemedText>
      </Animated.View>
    </View>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------- Solitario

type SoloProps = {
  verbs: Verb[];
  forms: VerbForm[];
  style: SoloStyle;
  source: VerbSource;
  onFinished: () => void;
  onReplay: (only?: Verb[]) => void;
  onExit: () => void;
};

export function SoloGame({ verbs, forms, style, source, onFinished, onReplay, onExit }: SoloProps) {
  const [answers, setAnswers] = useState<SoloAnswers>({});
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ score: SoloResult; best: SoloBest | null; isNew: boolean } | null>(null);
  const [blanksAsk, setBlanksAsk] = useState(0);
  const started = useRef(0);
  useEffect(() => { started.current = now(); }, []);
  const refs = useRef<Record<string, TextInputInstance | null>>({});

  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => setElapsed(Math.floor((now() - started.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [result]);

  const setAnswer = (verb: Verb, form: VerbForm, value: string) => {
    setAnswers(current => ({ ...current, [verb.infinitive]: { ...current[verb.infinitive], [form]: value } }));
  };

  const blanks = useMemo(
    () => verbs.reduce((sum, verb) => sum + forms.filter(form => !(answers[verb.infinitive]?.[form] ?? '').trim()).length, 0),
    [answers, forms, verbs],
  );

  const finish = (force = false) => {
    if (!force && blanks > 0) {
      setBlanksAsk(blanks);
      return;
    }
    setBlanksAsk(0);
    const seconds = Math.floor((now() - started.current) / 1000);
    const score = scoreSolo(verbs, forms, answers, seconds);
    const saved = recordSolo(source, forms, score);
    if (score.percent === 100) haptic.win();
    setResult({ score, ...saved });
    onFinished();
  };

  // Enter goes to the next field, then to the next verb.
  const fieldKey = (verbIndex: number, formIndex: number) => `${verbIndex}:${formIndex}`;
  const advance = (verbIndex: number, formIndex: number) => {
    if (formIndex < forms.length - 1) {
      refs.current[fieldKey(verbIndex, formIndex + 1)]?.focus();
      return;
    }
    if (style === 'challenge') {
      if (verbIndex < verbs.length - 1) setIndex(verbIndex + 1);
      else finish();
      return;
    }
    const next = refs.current[fieldKey(verbIndex + 1, 0)];
    if (next) next.focus();
    else finish();
  };

  if (result) {
    return <SoloResults result={result.score} best={result.best} isNew={result.isNew} forms={forms} onReplay={onReplay} onExit={onExit} />;
  }

  const fields = (verb: Verb, verbIndex: number, compact: boolean) => forms.map((form, formIndex) => (
    <VerbAnswerField
      key={form}
      ref={node => { refs.current[fieldKey(verbIndex, formIndex)] = node; }}
      label={compact ? undefined : formLabel(form)}
      placeholder={compact ? formLabel(form) : undefined}
      accessibilityLabel={`${formLabel(form)} de ${verb.translation}`}
      value={answers[verb.infinitive]?.[form] ?? ''}
      onChangeText={value => setAnswer(verb, form, value)}
      autoFocus={style === 'challenge' && formIndex === 0}
      returnKeyType={formIndex < forms.length - 1 || verbIndex < verbs.length - 1 ? 'next' : 'done'}
      submitBehavior={formIndex < forms.length - 1 || style === 'challenge' ? 'submit' : 'blurAndSubmit'}
      onSubmitEditing={() => advance(verbIndex, formIndex)}
    />
  ));

  const showsInfinitive = !forms.includes('infinitive');

  const blanksDialog = (
    <HanetDialog
      visible={blanksAsk > 0}
      onRequestClose={() => setBlanksAsk(0)}
      dismissOnBackdrop
      title={t('components.tools.verbGames.teFaltanCountRespuestas', { count: blanksAsk })}
      body={t('components.tools.verbGames.lasQueDejesEnBlanco')}
    >
      <HanetDialogActions>
        <HanetButton label={t('components.tools.verbGames.seguirRespondiendo')} variant="surface" onPress={() => setBlanksAsk(0)} style={dialogStyles.action} />
        <HanetButton label={t('components.tools.verbGames.revisarIgual')} onPress={() => finish(true)} style={dialogStyles.action} />
      </HanetDialogActions>
    </HanetDialog>
  );

  if (style === 'challenge') {
    const verb = verbs[index];
    const last = index === verbs.length - 1;
    return (
      <KeyboardScroll contentContainerStyle={styles.gamePage} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.progressRow}>
          <ThemedText style={styles.counter}>{t('components.tools.verbGames.verboNumberDeVerbscount', { number: index + 1, verbsCount: verbs.length })}</ThemedText>
          <ThemedText style={styles.clock}>{formatDuration(elapsed)}</ThemedText>
        </View>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: verbs.length, now: index + 1 }}>
          <View style={[styles.trackFill, { width: `${((index + 1) / verbs.length) * 100}%` }]} />
        </View>

        <View key={verb.infinitive} style={styles.verbCard}>
          <VerbTag label={typeLabel(verb)} />
          <ThemedText style={styles.meaning}>{verb.translation}</ThemedText>
          {showsInfinitive && <ThemedText style={styles.given}>{verb.infinitive}</ThemedText>}
          <View style={styles.fields}>{fields(verb, index, false)}</View>
        </View>

        <View style={styles.navRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('components.tools.verbGames.verboAnterior')}
            accessibilityState={{ disabled: index === 0 }}
            disabled={index === 0}
            onPress={() => setIndex(index - 1)}
            style={({ pressed }) => [styles.backPill, index === 0 && styles.disabled, pressed && AppPressed]}
          >
            <Ionicons name="chevron-back" size={16} color={AppColors.textPrimary} />
            <ThemedText style={styles.backText}>{t('onboarding.anterior')}</ThemedText>
          </Pressable>
          <HanetButton
            label={last ? t('eventCheckin.terminar') : t('anniversary.welcome.siguiente')}
            variant={last ? 'accent' : 'primary'}
            onPress={() => (last ? finish() : setIndex(index + 1))}
            style={styles.navMain}
          />
        </View>
        {blanksDialog}
      </KeyboardScroll>
    );
  }

  return (
    <KeyboardScroll contentContainerStyle={styles.gamePage} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.progressRow}>
        <ThemedText style={styles.counter}>{t('components.tools.verbGames.verbscountVerbosDuration', { verbsCount: verbs.length, duration: formatDuration(elapsed) })}</ThemedText>
        <ThemedText style={styles.clock}>{blanks === 0 ? t('components.tools.verbGames.todoRespondido') : t('components.tools.verbGames.faltanBlanks', { blanks })}</ThemedText>
      </View>
      {verbs.map((verb, verbIndex) => (
        <View key={verb.infinitive} style={styles.reviewCard}>
          <View style={styles.reviewHead}>
            <ThemedText style={styles.reviewMeaning}>{verb.translation}</ThemedText>
            {showsInfinitive && <ThemedText style={styles.reviewGiven}>{verb.infinitive}</ThemedText>}
          </View>
          <View style={styles.fields}>{fields(verb, verbIndex, true)}</View>
        </View>
      ))}
      <HanetButton label={t('components.tools.verbGames.revisarRespuestas')} variant="accent" onPress={() => finish()} />
      {blanksDialog}
    </KeyboardScroll>
  );
}

function SoloResults({ result, best, isNew, forms, onReplay, onExit }: {
  result: SoloResult;
  best: SoloBest | null;
  isNew: boolean;
  forms: VerbForm[];
  onReplay: (only?: Verb[]) => void;
  onExit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const missedVerbs = useMemo(() => {
    const seen = new Map<string, { verb: Verb; misses: { form: VerbForm; typed: string }[] }>();
    result.misses.forEach(miss => {
      const entry = seen.get(miss.verb.infinitive) ?? { verb: miss.verb, misses: [] };
      entry.misses.push({ form: miss.form, typed: miss.typed });
      seen.set(miss.verb.infinitive, entry);
    });
    return [...seen.values()];
  }, [result.misses]);

  const fullGame = forms.length === VERB_FORMS.length;
  const bestLine = isNew
    ? t('components.tools.verbGames.tuMejorMarcaConEsta')
    : best ? t('components.tools.verbGames.tuMejorMarcaConEsta2', { percent: best.percent, duration: formatDuration(best.seconds) }) : null;

  return (
    <ScrollView contentContainerStyle={styles.gamePage} showsVerticalScrollIndicator={false}>
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)} style={styles.hero}>
        <ThemedText style={styles.heroNumber} accessibilityLabel={t('components.tools.verbGames.percentPorCiento', { percent: result.percent })}>{`${result.percent} %`}</ThemedText>
        <ThemedText style={styles.heroLine}>{t('components.tools.verbGames.correctDeTotalRespuestasCorrectas', { correct: result.correct, total: result.total, duration: formatDuration(result.seconds) })}</ThemedText>
        {fullGame && !!bestLine && <ThemedText style={[styles.bestLine, isNew && styles.bestLineNew]}>{bestLine}</ThemedText>}
      </Animated.View>

      {missedVerbs.length > 0 ? (
        <View style={styles.missSection}>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>{t('components.tools.verbGames.paraRepasar')}</ThemedText>
          {missedVerbs.map(({ verb, misses }) => (
            <View key={verb.infinitive} style={styles.missCard}>
              <View style={styles.missHead}>
                <ThemedText style={styles.missVerb}>{verb.infinitive}</ThemedText>
                <ThemedText style={styles.missMeaning}>{verb.translation}</ThemedText>
              </View>
              {misses.map(miss => (
                <View key={miss.form} style={styles.missRow}>
                  <ThemedText style={styles.missForm}>{formLabel(miss.form)}</ThemedText>
                  <View style={styles.missAnswers}>
                    {miss.typed ? <ThemedText style={styles.missTyped}>{miss.typed}</ThemedText> : <ThemedText style={styles.missBlank}>{t('components.tools.verbGames.enBlanco')}</ThemedText>}
                    <Ionicons name="arrow-forward" size={14} color={AppColors.textSecondary} />
                    <ThemedText style={styles.missRight}>{formatForm(verb, miss.form)}</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.allRight}>
          <Ionicons name="checkmark-circle" size={22} color={AppColors.accentMint} />
          <ThemedText style={styles.allRightText}>{t('components.tools.verbGames.todoCorrectoNoHayNada')}</ThemedText>
        </View>
      )}

      <View style={styles.actions}>
        {missedVerbs.length > 0 && (
          <HanetButton label={t('components.tools.verbGames.repetirLosCountQueFalle', { count: missedVerbs.length })} variant="accent" onPress={() => onReplay(missedVerbs.map(item => item.verb))} />
        )}
        <HanetButton label={t('components.tools.verbGames.jugarOtraVez')} variant={missedVerbs.length ? 'primary' : 'accent'} onPress={() => onReplay()} />
        <HanetButton label={t('components.tools.verbGames.volverAVerbos')} variant="surface" onPress={onExit} />
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------- Infinito

type InfiniteProps = {
  verbs: Verb[];
  /** A dialog is open over the game: the clock stops. */
  paused: boolean;
  onFinished: () => void;
  onReplay: () => void;
  onExit: () => void;
};

type Over = { cause: 'time' | 'errors'; seconds: number; correct: number; errors: number; loops: number; best: InfiniteBest; isNew: boolean };

const TICK_MS = 100;

export function InfiniteGame({ verbs, paused, onFinished, onReplay, onExit }: InfiniteProps) {
  const reduceMotion = useReducedMotion();
  const [pool, setPool] = useState(verbs);
  const [verbIndex, setVerbIndex] = useState(0);
  const [formIndex, setFormIndex] = useState(0);
  const [loop, setLoop] = useState(1);
  const [timeLeft, setTimeLeft] = useState<number>(INFINITE_RULES.startSeconds);
  const [errors, setErrors] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<{ state: AnswerState; answer: string }>({ state: 'idle', answer: '' });
  const [loopNotice, setLoopNotice] = useState(false);
  const [away, setAway] = useState(false);
  const [over, setOver] = useState<Over | null>(null);

  const clock = useRef<number>(INFINITE_RULES.startSeconds);
  const survived = useRef(0);
  const low = useRef(false);
  const inputRef = useRef<TextInputInstance | null>(null);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);

  const drain = 1 + (loop - 1) * INFINITE_RULES.loopSpeedUp;
  const running = !over && !paused && !away;

  const end = useCallback((cause: Over['cause'], totals: { correct: number; errors: number; loops: number }) => {
    const seconds = Math.floor(survived.current);
    const saved = recordInfinite({ seconds, correct: totals.correct, loops: totals.loops });
    if (saved.isNew) haptic.win();
    else haptic.miss();
    setOver({ cause, seconds, ...totals, ...saved });
    onFinished();
  }, [onFinished]);

  // Leaving the app stops the clock until the student comes back and taps "Seguir".
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') setAway(true);
    });
    return () => subscription.remove();
  }, []);

  const totals = useRef({ correct: 0, errors: 0, loops: 1 });
  useEffect(() => { totals.current = { correct, errors, loops: loop }; }, [correct, errors, loop]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      clock.current = Math.max(0, clock.current - drain * (TICK_MS / 1000));
      survived.current += TICK_MS / 1000;
      setTimeLeft(clock.current);
      const isLow = clock.current <= INFINITE_RULES.lowSeconds;
      if (isLow && !low.current) haptic.warn();
      low.current = isLow;
      if (clock.current <= 0) {
        clearInterval(timer);
        end('time', totals.current);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [drain, end, running]);

  useEffect(() => {
    if (!loopNotice) return;
    const timer = setTimeout(() => setLoopNotice(false), 2600);
    return () => clearTimeout(timer);
  }, [loopNotice]);

  const verb = pool[verbIndex];
  const form = VERB_FORMS[formIndex];

  const submit = () => {
    if (!running || !input.trim()) return;
    const right = isCorrect(verb, form, input);
    if (right) {
      haptic.hit();
      clock.current = Math.min(clock.current + INFINITE_RULES.hitBonus, INFINITE_RULES.maxSeconds);
      setCorrect(value => value + 1);
      setFeedback({ state: 'right', answer: formatForm(verb, form) });
      if (!reduceMotion) flash.set(withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 260 })));
    } else {
      haptic.miss();
      clock.current = Math.max(clock.current - INFINITE_RULES.missPenalty, 0);
      const nextErrors = errors + 1;
      setErrors(nextErrors);
      setFeedback({ state: 'wrong', answer: formatForm(verb, form) });
      if (!reduceMotion) shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-5, { duration: 50 }), withTiming(0, { duration: 50 })));
      if (nextErrors >= INFINITE_RULES.maxErrors) {
        setTimeLeft(clock.current);
        end('errors', { correct, errors: nextErrors, loops: loop });
        return;
      }
    }
    setTimeLeft(clock.current);
    setInput('');

    if (formIndex < VERB_FORMS.length - 1) {
      setFormIndex(formIndex + 1);
      return;
    }
    setFormIndex(0);
    if (verbIndex < pool.length - 1) {
      setVerbIndex(verbIndex + 1);
      return;
    }
    setPool(shuffle(verbs));
    setVerbIndex(0);
    setLoop(loop + 1);
    setLoopNotice(true);
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.get() }],
    borderColor: flash.get() > 0.5 ? AppColors.accentMint : AppColors.hairline,
  }));

  if (over) {
    const answered = over.correct + over.errors;
    return (
      <ScrollView contentContainerStyle={styles.gamePage} showsVerticalScrollIndicator={false}>
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)} style={styles.hero}>
          <ThemedText style={styles.heroEyebrow}>{over.cause === 'time' ? t('components.tools.verbGames.seAcaboElTiempo') : t('components.tools.verbGames.llegasteAMaxerrorsErrores', { maxErrors: INFINITE_RULES.maxErrors })}</ThemedText>
          <ThemedText style={styles.heroNumber} accessibilityLabel={t('components.tools.verbGames.aguantasteDuration', { duration: formatDuration(over.seconds) })}>{formatDuration(over.seconds)}</ThemedText>
          <ThemedText style={styles.heroLine}>{t('components.tools.verbGames.aguantaste')}</ThemedText>
          <ThemedText style={[styles.bestLine, over.isNew && styles.bestLineNew]}>
            {over.isNew ? t('components.tools.verbGames.esTuMejorPartida') : t('components.tools.verbGames.tuMejorPartidaDurationCorrect', { duration: formatDuration(over.best.seconds), correct: over.best.correct })}
          </ThemedText>
        </Animated.View>
        <View style={styles.stats}>
          <StatBlock value={String(over.correct)} label={t('components.tools.verbGames.aciertos')} />
          <View style={styles.statDivider} />
          <StatBlock value={answered ? `${Math.round((over.correct / answered) * 100)} %` : '–'} label={t('components.tools.verbGames.precision')} />
          <View style={styles.statDivider} />
          <StatBlock value={String(over.loops)} label={t('components.tools.verbGames.vueltas', { count: over.loops })} />
        </View>
        <View style={styles.actions}>
          <HanetButton label={t('components.tools.verbGames.jugarOtraVez')} variant="accent" onPress={onReplay} />
          <HanetButton label={t('components.tools.verbGames.volverAVerbos')} variant="surface" onPress={onExit} />
        </View>
      </ScrollView>
    );
  }

  const isLow = timeLeft <= INFINITE_RULES.lowSeconds;

  return (
    <KeyboardScroll contentContainerStyle={styles.gamePage} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false} scrollEnabled={false}>
      <View style={styles.clockRow}>
        <ThemedText style={[styles.clockBig, isLow && styles.clockLow]} accessibilityLabel={t('components.tools.verbGames.quedanTimeleftSegundos', { timeLeft: Math.ceil(timeLeft) })}>{`${Math.ceil(timeLeft)} s`}</ThemedText>
        <View style={styles.clockMeta}>
          <ThemedText style={styles.counter}>{t('components.tools.verbGames.vueltaLoop', { loop })}</ThemedText>
          <View style={styles.errorsPill} accessibilityLabel={t('components.tools.verbGames.errorsDeMaxerrorsErrores', { errors, maxErrors: INFINITE_RULES.maxErrors })}>
            <Ionicons name="close" size={13} color={errors ? AppColors.errorText : AppColors.textSecondary} />
            <ThemedText style={styles.errorsText}>{`${errors}/${INFINITE_RULES.maxErrors}`}</ThemedText>
          </View>
        </View>
      </View>
      <VerbTimeBar seconds={timeLeft} max={INFINITE_RULES.startSeconds} low={isLow} tick={TICK_MS} />

      {loopNotice && (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(120)} exiting={reduceMotion ? undefined : FadeOut.duration(200)} style={styles.notice}>
          <Ionicons name="speedometer-outline" size={16} color={AppColors.textPrimary} />
          <ThemedText style={styles.noticeText}>{t('components.tools.verbGames.vueltaLoopElRelojCorre', { loop })}</ThemedText>
        </Animated.View>
      )}

      <Animated.View style={[styles.verbCard, styles.infiniteCard, cardStyle]}>
        <View style={styles.tagRow}>
          <VerbTag label={formLabel(form)} strong />
          <VerbTag label={typeLabel(verb)} />
          <ThemedText style={styles.poolCount}>{`${verbIndex + 1}/${pool.length}`}</ThemedText>
        </View>
        <ThemedText style={styles.meaning}>{verb.translation}</ThemedText>
        <View style={styles.chain}>
          {VERB_FORMS.map((item, itemIndex) => (
            <View key={item} style={[styles.chainSlot, itemIndex === formIndex && styles.chainSlotNow]}>
              <ThemedText numberOfLines={1} style={[styles.chainValue, itemIndex > formIndex && styles.chainPending]}>
                {itemIndex < formIndex ? formatForm(verb, item) : itemIndex === formIndex ? '?' : '·'}
              </ThemedText>
              <ThemedText numberOfLines={1} style={styles.chainLabel}>{formShortLabel(item)}</ThemedText>
            </View>
          ))}
        </View>
        <View style={styles.answerRow}>
          <VerbAnswerField
            ref={inputRef}
            accessibilityLabel={`${formLabel(form)} de ${verb.translation}`}
            placeholder={t('components.tools.verbGames.escribeYPresionaEnviar')}
            value={input}
            onChangeText={setInput}
            autoFocus
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={submit}
            style={styles.answerField}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('components.tools.verbGames.enviar')}
            onPress={() => { submit(); inputRef.current?.focus(); }}
            disabled={!input.trim()}
            style={({ pressed }) => [styles.send, !input.trim() && styles.disabled, pressed && AppPressed]}
          >
            <Ionicons name="arrow-up" size={20} color={AppColors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.feedback} accessibilityLiveRegion="polite">
          {feedback.state === 'right' && (
            <>
              <Ionicons name="checkmark-circle" size={16} color={AppColors.accentMint} />
              <ThemedText style={styles.feedbackText}>{t('components.tools.verbGames.bienAnswerHitbonusS', { answer: feedback.answer, hitBonus: INFINITE_RULES.hitBonus })}</ThemedText>
            </>
          )}
          {feedback.state === 'wrong' && (
            <>
              <Ionicons name="close-circle" size={16} color={AppColors.errorText} />
              <ThemedText style={[styles.feedbackText, styles.feedbackWrong]}>{t('components.tools.verbGames.eraAnswerMisspenaltyS', { answer: feedback.answer, missPenalty: INFINITE_RULES.missPenalty })}</ThemedText>
            </>
          )}
        </View>
      </Animated.View>

      <HanetDialog visible={away && !paused} onRequestClose={() => setAway(false)} title={t('components.tools.verbGames.enPausa')} body={t('components.tools.verbGames.elRelojSeDetuvoMientras')}>
        <HanetDialogActions>
          <HanetButton label={t('components.tools.verbGames.seguir')} variant="accent" onPress={() => { setAway(false); setTimeout(() => inputRef.current?.focus(), 150); }} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  countdown: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  countdownText: { ...AppDisplay.number, fontSize: 120, lineHeight: 128, color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  countdownGo: { color: AppColors.accent, fontSize: 88, lineHeight: 96 },
  gamePage: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingTop: AppSpacing.lg, paddingBottom: AppSpacing.xxl, gap: AppSpacing.lg },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  counter: { ...AppType.callout, color: AppColors.textSecondary },
  clock: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textSecondary, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: AppRadii.pill, backgroundColor: AppColors.surface, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: AppRadii.pill, backgroundColor: AppColors.accent },
  verbCard: { padding: 20, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, gap: AppSpacing.md },
  infiniteCard: { borderWidth: 1.5, borderColor: AppColors.hairline },
  meaning: { ...AppType.title1, color: AppColors.textPrimary },
  given: { ...AppType.title3, fontFamily: 'DMSans_500Medium', color: AppColors.textSecondary },
  fields: { gap: AppSpacing.md, marginTop: AppSpacing.xs },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md },
  navMain: { flex: 1 },
  backPill: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 50, paddingLeft: 12, paddingRight: 18, borderRadius: AppRadii.pill, backgroundColor: AppColors.surface },
  backText: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  disabled: { opacity: 0.4 },
  reviewCard: { padding: AppSpacing.lg, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, gap: AppSpacing.sm },
  reviewHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: AppSpacing.md },
  reviewMeaning: { ...AppType.headline, color: AppColors.textPrimary, flex: 1 },
  reviewGiven: { ...AppType.callout, color: AppColors.textSecondary },
  hero: { alignItems: 'center', gap: AppSpacing.xs, paddingVertical: AppSpacing.xl },
  heroEyebrow: { ...AppType.headline, color: AppColors.textSecondary },
  heroNumber: { ...AppDisplay.number, fontSize: 88, lineHeight: 96, color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  heroLine: { ...AppType.callout, color: AppColors.textSecondary, textAlign: 'center' },
  bestLine: { ...AppType.callout, color: AppColors.textSecondary, textAlign: 'center', marginTop: AppSpacing.sm },
  bestLineNew: { fontFamily: 'DMSans_700Bold', color: AppColors.accent },
  missSection: { gap: AppSpacing.md },
  sectionTitle: { ...AppType.title3, color: AppColors.textPrimary },
  missCard: { padding: AppSpacing.lg, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, gap: AppSpacing.sm },
  missHead: { flexDirection: 'row', alignItems: 'baseline', gap: AppSpacing.sm, flexWrap: 'wrap' },
  missVerb: { ...AppType.headline, color: AppColors.textPrimary },
  missMeaning: { ...AppType.footnote, color: AppColors.textSecondary },
  missRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: AppSpacing.md, paddingTop: AppSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  missForm: { ...AppType.caption, color: AppColors.textSecondary },
  missAnswers: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  missTyped: { ...AppType.callout, color: AppColors.errorText, textDecorationLine: 'line-through' },
  missBlank: { ...AppType.callout, color: AppColors.textSecondary, fontStyle: 'italic' },
  missRight: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  allRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: AppSpacing.sm, padding: AppSpacing.lg, borderRadius: AppRadii.lg, backgroundColor: AppColors.surface },
  allRightText: { ...AppType.callout, color: AppColors.textPrimary },
  actions: { gap: AppSpacing.md },
  stats: { flexDirection: 'row', alignItems: 'center', padding: AppSpacing.lg, borderRadius: AppRadii.lg, backgroundColor: AppColors.surface },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...AppDisplay.score, color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { ...AppType.caption, color: AppColors.textSecondary },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: AppColors.separator },
  clockRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  clockBig: { ...AppDisplay.number, fontSize: 48, lineHeight: 52, color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  clockLow: { color: AppColors.accent },
  clockMeta: { alignItems: 'flex-end', gap: 6, paddingBottom: 4 },
  errorsPill: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 24, paddingHorizontal: 9, borderRadius: AppRadii.pill, backgroundColor: AppColors.surface },
  errorsText: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  notice: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm, alignSelf: 'center', height: 34, paddingHorizontal: 14, borderRadius: AppRadii.pill, backgroundColor: AppColors.accent },
  noticeText: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textPrimary },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  poolCount: { ...AppType.caption, color: AppColors.textSecondary, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  chain: { flexDirection: 'row', gap: AppSpacing.sm },
  chainSlot: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: AppRadii.md, backgroundColor: AppColors.canvas, alignItems: 'center', gap: 2, borderWidth: 1.5, borderColor: 'transparent' },
  chainSlotNow: { borderColor: AppColors.accent },
  chainValue: { ...AppType.headline, color: AppColors.textPrimary },
  chainPending: { color: AppColors.surfaceMuted },
  chainLabel: { fontSize: 10, lineHeight: 13, fontFamily: 'DMSans_500Medium', color: AppColors.textSecondary },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.sm },
  answerField: { flex: 1 },
  send: { width: 50, height: 50, borderRadius: AppRadii.pill, backgroundColor: AppColors.accent, alignItems: 'center', justifyContent: 'center' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  feedbackText: { ...AppType.callout, color: AppColors.textPrimary },
  feedbackWrong: { color: AppColors.errorText },
});
