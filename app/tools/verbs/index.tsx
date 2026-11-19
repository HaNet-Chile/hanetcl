import { ThemedText } from '@/components/themed-text';
import { formLabel } from '@/components/tools/verb-ui';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetChip } from '@/components/ui/hanet-chip';
import { PageHeader } from '@/components/ui/page-header';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { WideColumns, useWideLayout, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppDisplay, AppPressed, AppRadii, AppRowPressed, AppSpacing, AppType } from '@/constants/design-tokens';
import { VERBS, VERB_LISTS } from '@/constants/verbs';
import {
  INFINITE_RULES,
  RANDOM_COUNT,
  VERB_FORMS,
  countFor,
  formatDuration,
  sourceKey,
  startSession,
  updateAudio,
  updateSetup,
  useVerbsQuiz,
} from '@/services/verbs-quiz';
import { playEffect } from '@/services/verbs-sound';
import type { VerbEffect } from '@/services/verbs-sound';
import type { QuizMode, SoloStyle, VerbForm, VerbSource } from '@/services/verbs-quiz';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n';

// Verbos en inglés: choose the game, the verbs and the forms, then play.
// The choice is remembered on the phone.

type IconName = keyof typeof Ionicons.glyphMap;

const REGULAR_COUNT = VERBS.filter(verb => verb.type === 'regular').length;
const IRREGULAR_COUNT = VERBS.length - REGULAR_COUNT;

function sameSource(a: VerbSource, b: VerbSource) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'list' && b.kind === 'list') return a.id === b.id;
  if (a.kind === 'all' && b.kind === 'all') return a.type === b.type;
  return true;
}

function tap(sound: VerbEffect = 'select') {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
  playEffect(sound);
}

/** One of the two games, as a tile: the chosen one turns pink. */
function ModeTile({ icon, title, text, selected, onPress }: { icon: IconName; title: string; text: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${text}`}
      onPress={onPress}
      style={({ pressed }) => [styles.modeTile, selected && styles.modeTileOn, pressed && AppPressed]}
    >
      <View style={[styles.modeIcon, selected && styles.modeIconOn]}>
        <Ionicons name={icon} size={22} color={selected ? AppColors.textPrimary : AppColors.accent} />
      </View>
      <ThemedText style={styles.modeTitle}>{title}</ThemedText>
      <ThemedText style={styles.modeText}>{text}</ThemedText>
    </Pressable>
  );
}

/** One way of choosing the verbs: a row with a radio mark. */
function SourceRow({ title, detail, extra, selected, onPress, icon = 'radio' }: {
  title: string;
  detail: string;
  extra?: string;
  selected: boolean;
  onPress: () => void;
  icon?: 'radio' | 'chevron';
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[title, detail, extra].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && AppRowPressed]}
    >
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.rowCopy}>
        <ThemedText style={styles.rowTitle}>{title}</ThemedText>
        <ThemedText style={styles.rowDetail}>{detail}</ThemedText>
      </View>
      {!!extra && <ThemedText style={styles.rowExtra}>{extra}</ThemedText>}
      {icon === 'chevron' && <Ionicons name="chevron-forward" size={17} color={AppColors.textSecondary} />}
    </Pressable>
  );
}

function Rule({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleIcon}><Ionicons name={icon} size={16} color={AppColors.accent} /></View>
      <ThemedText style={styles.ruleText}>{text}</ThemedText>
    </View>
  );
}

export default function VerbsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const layout = useWideLayout();
  const { setup, solo, infinite, audio } = useVerbsQuiz();
  const { mode, style, forms, source } = setup;

  const count = countFor(source);
  const customCount = source.kind === 'custom' ? source.verbs.length : 0;
  const ready = count > 0 && (mode === 'infinite' || forms.length > 0);

  const pick = (next: VerbSource) => {
    tap();
    updateSetup({ source: next });
  };

  const toggleForm = (form: VerbForm) => {
    tap();
    const next = forms.includes(form) ? forms.filter(item => item !== form) : VERB_FORMS.filter(item => item === form || forms.includes(item));
    updateSetup({ forms: next });
  };

  const bestFor = (candidate: VerbSource) => {
    const key = sourceKey(candidate);
    const best = key ? solo[key] : undefined;
    return mode === 'solo' && best ? `${best.percent} %` : undefined;
  };

  const start = () => {
    if (!ready) return;
    tap('start');
    startSession(setup);
    router.push('/tools/verbs/play');
  };

  const sourceRows = (
    <>
      <View style={styles.group}>
        <ThemedText accessibilityRole="header" style={styles.groupTitle}>{t('tools.verbs.listasDeLosQuiz')}</ThemedText>
        <View accessibilityRole="radiogroup" style={styles.card}>
          {VERB_LISTS.map((list, index) => {
            const candidate: VerbSource = { kind: 'list', id: list.id };
            return (
              <React.Fragment key={list.id}>
                {index > 0 && <View style={styles.divider} />}
                <SourceRow
                  title={list.name}
                  detail={t('tools.verbs.verbscountVerbosDescription', { verbsCount: list.verbs.length, description: list.description })}
                  extra={bestFor(candidate)}
                  selected={sameSource(source, candidate)}
                  onPress={() => pick(candidate)}
                />
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText accessibilityRole="header" style={styles.groupTitle}>{t('tools.verbs.todosLosVerbos')}</ThemedText>
        <View accessibilityRole="radiogroup" style={styles.card}>
          <SourceRow
            title={t('tools.verbs.randomcountAlAzar', { randomCount: RANDOM_COUNT })}
            detail={t('tools.verbs.otrosCadaVezQueJuegas')}
            selected={source.kind === 'random'}
            onPress={() => pick({ kind: 'random' })}
          />
          <View style={styles.divider} />
          <SourceRow
            title={t('tools.verbs.soloIrregulares')}
            detail={t('tools.verbs.irregularcountVerbos', { irregularCount: IRREGULAR_COUNT })}
            extra={bestFor({ kind: 'all', type: 'irregular' })}
            selected={sameSource(source, { kind: 'all', type: 'irregular' })}
            onPress={() => pick({ kind: 'all', type: 'irregular' })}
          />
          <View style={styles.divider} />
          <SourceRow
            title={t('tools.verbs.soloRegulares')}
            detail={t('tools.verbs.regularcountVerbos', { regularCount: REGULAR_COUNT })}
            extra={bestFor({ kind: 'all', type: 'regular' })}
            selected={sameSource(source, { kind: 'all', type: 'regular' })}
            onPress={() => pick({ kind: 'all', type: 'regular' })}
          />
          <View style={styles.divider} />
          <SourceRow
            title={t('components.settings.homeCalendarSetting.todos')}
            detail={t('tools.verbs.verbscountVerbos', { vERBSCount: VERBS.length })}
            extra={bestFor({ kind: 'all', type: 'all' })}
            selected={sameSource(source, { kind: 'all', type: 'all' })}
            onPress={() => pick({ kind: 'all', type: 'all' })}
          />
          <View style={styles.divider} />
          <SourceRow
            title={t('tools.verbs.elegirVerbos')}
            detail={source.kind === 'custom' ? t('tools.verbs.customcountElegidos', { customCount }) : t('tools.verbs.armaTuPropiaLista')}
            selected={source.kind === 'custom'}
            icon="chevron"
            onPress={() => {
              if (source.kind !== 'custom') updateSetup({ source: { kind: 'custom', verbs: [] } });
              router.push('/tools/verbs/pick');
            }}
          />
        </View>
      </View>
    </>
  );

  const settings = (
    <View style={styles.settings}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('tools.verbs.juego')} style={styles.modes}>
        {([
          ['solo', 'trophy-outline', t('tools.verbs.solitario'), t('tools.verbs.tuListaCompletaConNota')],
          ['infinite', 'infinite-outline', t('tools.verbs.infinito'), t('tools.verbs.contraElRelojSinFinal')],
        ] as [QuizMode, IconName, string, string][]).map(([value, icon, title, text]) => (
          <ModeTile key={value} icon={icon} title={title} text={text} selected={mode === value} onPress={() => { tap('confirm'); updateSetup({ mode: value }); }} />
        ))}
      </View>

      {mode === 'solo' ? (
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <ThemedText style={styles.lead}>{t('tools.verbs.respondesLaListaCompletaY')}</ThemedText>
            <View style={styles.fieldBlock}>
              <ThemedText style={styles.label}>{t('tools.verbs.como')}</ThemedText>
              <View style={styles.chips}>
                {([['challenge', t('tools.verbs.desafio')], ['review', t('tools.verbs.repaso')]] as [SoloStyle, string][]).map(([value, label]) => (
                  <HanetChip
                    key={value}
                    label={label}
                    accessibilityRole="radio"
                    selected={style === value}
                    onPress={() => { tap(value === 'challenge' ? 'challenge' : 'review'); updateSetup({ style: value }); }}
                    style={style !== value && styles.chipIdle}
                  />
                ))}
              </View>
              <ThemedText style={styles.hint}>
                {style === 'challenge' ? t('tools.verbs.unVerboALaVez') : t('tools.verbs.todosLosVerbosALa')}
              </ThemedText>
            </View>
            <View style={styles.fieldBlock}>
              <ThemedText style={styles.label}>{t('tools.verbs.queFormas')}</ThemedText>
              <View style={styles.chips}>
                {VERB_FORMS.map(form => (
                  <HanetChip
                    key={form}
                    label={formLabel(form)}
                    accessibilityRole="checkbox"
                    selected={forms.includes(form)}
                    onPress={() => toggleForm(form)}
                    style={!forms.includes(form) && styles.chipIdle}
                  />
                ))}
              </View>
              {!forms.length && <ThemedText style={styles.error}>{t('tools.verbs.eligeAlMenosUnaForma')}</ThemedText>}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <ThemedText style={styles.lead}>{t('tools.verbs.losVerbosDanVueltasSin')}</ThemedText>
            <View style={styles.rules}>
              <Rule icon="timer-outline" text={t('tools.verbs.empiezasConStartsecondsSegundosY', { startSeconds: INFINITE_RULES.startSeconds })} />
              <Rule icon="add-circle-outline" text={t('tools.verbs.cadaAciertoSumaHitbonusSegundos', { hitBonus: INFINITE_RULES.hitBonus })} />
              <Rule icon="remove-circle-outline" text={t('tools.verbs.cadaErrorRestaMisspenaltyCon', { missPenalty: INFINITE_RULES.missPenalty, maxErrors: INFINITE_RULES.maxErrors })} />
              <Rule icon="repeat-outline" text={t('tools.verbs.enCadaVueltaALa', { value: Math.round(INFINITE_RULES.loopSpeedUp * 100) })} />
            </View>
            {!!infinite && (
              <View style={styles.best}>
                <ThemedText style={styles.bestLabel}>{t('tools.verbs.tuMejorPartida')}</ThemedText>
                <ThemedText style={styles.bestValue}>{t('tools.verbs.durationCorrectAciertos', { duration: formatDuration(infinite.seconds), correct: infinite.correct })}</ThemedText>
              </View>
            )}
          </View>
        </View>
      )}

      <HanetButton
        label={count > 0 ? t('tools.verbs.empezarConCountvalueVerbos', { countValue: count }) : t('tools.verbs.eligeVerbosParaEmpezar')}
        variant="accent"
        disabled={!ready}
        onPress={start}
        icon={<Ionicons name="play" size={16} color={AppColors.textPrimary} />}
      />

      <View style={styles.audioRow}>
        <HanetChip
          label={t('tools.verbs.efectos')}
          accessibilityRole="switch"
          compact
          selected={audio.sound}
          icon={<Ionicons name={audio.sound ? 'volume-high' : 'volume-mute'} size={15} color={audio.sound ? AppColors.textPrimary : AppColors.textSecondary} />}
          onPress={() => { updateAudio({ sound: !audio.sound }); if (!audio.sound) tap(); }}
          style={!audio.sound && styles.chipIdle}
        />
        <HanetChip
          label={t('services.eventsService.musica')}
          accessibilityRole="switch"
          compact
          selected={audio.music}
          icon={<Ionicons name={audio.music ? 'musical-notes' : 'musical-notes-outline'} size={15} color={audio.music ? AppColors.textPrimary : AppColors.textSecondary} />}
          onPress={() => { tap(); updateAudio({ music: !audio.music }); }}
          style={!audio.music && styles.chipIdle}
        />
      </View>
    </View>
  );

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView contentContainerStyle={withTopInset([styles.page, widePageStyle(layout.wide)], insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow={t('common.herramientas')}
          title={t('common.verbosEnIngles')}
          intro={t('tools.verbs.practicaElInfinitivoElPasado')}
        />
        <WideColumns asideLeft asideFirstOnPhone asideWidth={380} stickyAside aside={settings} main={sourceRows} />
        <ThemedText style={styles.note}>{t('tools.verbs.tusMarcasQuedanGuardadasSolo')}</ThemedText>
      </ScrollView>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.lg },
  settings: { gap: AppSpacing.lg },
  modes: { flexDirection: 'row', gap: AppSpacing.md },
  modeTile: { flex: 1, padding: AppSpacing.lg, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, borderWidth: 1.5, borderColor: AppColors.hairline, gap: 6 },
  modeTileOn: { borderColor: AppColors.accent },
  modeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: AppColors.accentTint, alignItems: 'center', justifyContent: 'center', marginBottom: AppSpacing.xs },
  modeIconOn: { backgroundColor: AppColors.accent },
  modeTitle: { ...AppDisplay.section, color: AppColors.textPrimary },
  modeText: { ...AppType.footnote, color: AppColors.textSecondary },
  audioRow: { flexDirection: 'row', justifyContent: 'center', gap: AppSpacing.sm },
  group: { gap: AppSpacing.sm },
  groupTitle: { ...AppType.headline, color: AppColors.textPrimary, paddingHorizontal: AppSpacing.xs },
  card: { borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface, overflow: 'hidden' },
  cardBody: { padding: 18, gap: AppSpacing.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: AppColors.separator, marginLeft: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, minHeight: 60, paddingHorizontal: AppSpacing.lg, paddingVertical: AppSpacing.md },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: AppColors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: AppColors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: AppColors.accent },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { ...AppType.headline, color: AppColors.textPrimary },
  rowDetail: { ...AppType.footnote, color: AppColors.textSecondary },
  rowExtra: { ...AppType.callout, fontFamily: 'DMSans_700Bold', color: AppColors.textSecondary, fontVariant: ['tabular-nums'] },
  lead: { ...AppType.body, color: AppColors.textPrimary },
  fieldBlock: { gap: AppSpacing.sm },
  label: { ...AppType.headline, color: AppColors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: AppSpacing.sm },
  chipIdle: { backgroundColor: AppColors.canvas },
  hint: { ...AppType.caption, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary },
  error: { ...AppType.caption, color: AppColors.errorText },
  rules: { gap: AppSpacing.md },
  rule: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md },
  ruleIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: AppColors.accentTint, alignItems: 'center', justifyContent: 'center' },
  ruleText: { ...AppType.callout, color: AppColors.textPrimary, flex: 1 },
  best: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: AppSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.separator },
  bestLabel: { ...AppType.callout, color: AppColors.textSecondary },
  bestValue: { ...AppType.headline, color: AppColors.textPrimary, fontVariant: ['tabular-nums'] },
  note: { ...AppType.caption, fontFamily: 'DMSans_400Regular', color: AppColors.textSecondary, textAlign: 'center' },
});
