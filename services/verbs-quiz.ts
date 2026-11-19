import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { VERBS, VERB_LISTS } from '@/constants/verbs';
import type { Verb, VerbType } from '@/constants/verbs';
import { setVerbAudio } from '@/services/verbs-sound';

// Verbos en inglés (Herramientas): practice the three forms of English verbs.
// It all happens on the phone, like the grade tools: the setup and the best
// marks stay in AsyncStorage and nothing goes to the server.
//
// Two games, from muxp's VerbosByMuxp:
// - Solitario: a set of verbs, checked at the end, with the answer key.
//   "Desafío" goes one verb at a time; "Repaso" shows them all at once.
// - Infinito: the verbs go round without end against a clock that drains.

export type VerbForm = 'infinitive' | 'pastSimple' | 'pastParticiple';
export const VERB_FORMS: VerbForm[] = ['infinitive', 'pastSimple', 'pastParticiple'];

export type QuizMode = 'solo' | 'infinite';
export type SoloStyle = 'challenge' | 'review';

export type VerbSource =
  | { kind: 'list'; id: string }
  | { kind: 'random' }
  | { kind: 'all'; type: 'all' | VerbType }
  | { kind: 'custom'; verbs: string[] };

export type QuizSetup = {
  mode: QuizMode;
  style: SoloStyle;
  /** The forms Solitario asks (Infinito always asks the three). */
  forms: VerbForm[];
  source: VerbSource;
};

export const RANDOM_COUNT = 20;

/** Infinito, as in VerbosByMuxp. */
export const INFINITE_RULES = {
  startSeconds: 30,
  hitBonus: 4,
  missPenalty: 6,
  maxSeconds: 99,
  maxErrors: 20,
  /** Each full round of the verbs drains the clock this much faster. */
  loopSpeedUp: 0.1,
  /** Under this, the clock turns pink. */
  lowSeconds: 8,
} as const;

const DEFAULT_SETUP: QuizSetup = {
  mode: 'solo',
  style: 'challenge',
  forms: [...VERB_FORMS],
  source: { kind: 'list', id: VERB_LISTS[0].id },
};

const BY_INFINITIVE = new Map(VERBS.map(verb => [verb.infinitive, verb]));

export function verbFor(infinitive: string) {
  return BY_INFINITIVE.get(infinitive);
}

export function listFor(id: string) {
  return VERB_LISTS.find(list => list.id === id);
}

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/** The verbs a source stands for, in the order of the list. */
export function verbsFor(source: VerbSource): Verb[] {
  switch (source.kind) {
    case 'list': {
      const list = listFor(source.id);
      return (list?.verbs ?? []).map(verbFor).filter((verb): verb is Verb => !!verb);
    }
    case 'random':
      return shuffle(VERBS).slice(0, RANDOM_COUNT);
    case 'all':
      return source.type === 'all' ? [...VERBS] : VERBS.filter(verb => verb.type === source.type);
    case 'custom':
      return source.verbs.map(verbFor).filter((verb): verb is Verb => !!verb);
  }
}

/** How many verbs a source has, without drawing the random ones. */
export function countFor(source: VerbSource) {
  return source.kind === 'random' ? RANDOM_COUNT : verbsFor(source).length;
}

/** Best marks are kept for the sources that are always the same verbs. */
export function sourceKey(source: VerbSource): string | null {
  if (source.kind === 'list') return `list:${source.id}`;
  if (source.kind === 'all') return `all:${source.type}`;
  return null;
}

// ---------------------------------------------------------------- answers

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Every answer a form accepts. "burnt/burned" takes either one, and so does
 * "was/were able": the words after the last option ("able") belong to the
 * shorter ones too, so "was able" counts.
 */
export function acceptedAnswers(verb: Verb, form: VerbForm): string[] {
  const parts = verb[form].split('/').map(normalize).filter(Boolean);
  const tail = parts.length > 1 ? parts[parts.length - 1].split(' ').slice(1) : [];
  const answers = new Set(parts);
  if (tail.length) {
    parts.forEach(part => {
      if (part.split(' ').length === 1) answers.add([part, ...tail].join(' '));
    });
  }
  return [...answers];
}

export function isCorrect(verb: Verb, form: VerbForm, answer: string) {
  const typed = normalize(answer);
  return !!typed && acceptedAnswers(verb, form).includes(typed);
}

/** A form as the answer key shows it: "burnt / burned". */
export function formatForm(verb: Verb, form: VerbForm) {
  return verb[form].split('/').map(part => part.trim()).join(' / ');
}

export type SoloAnswers = Record<string, Partial<Record<VerbForm, string>>>;

export type SoloMiss = { verb: Verb; form: VerbForm; typed: string };

export type SoloResult = {
  correct: number;
  total: number;
  /** 0 to 100, rounded. */
  percent: number;
  seconds: number;
  misses: SoloMiss[];
};

export function scoreSolo(verbs: Verb[], forms: VerbForm[], answers: SoloAnswers, seconds: number): SoloResult {
  const misses: SoloMiss[] = [];
  let correct = 0;
  verbs.forEach(verb => {
    forms.forEach(form => {
      const typed = answers[verb.infinitive]?.[form] ?? '';
      if (isCorrect(verb, form, typed)) correct += 1;
      else misses.push({ verb, form, typed: typed.trim() });
    });
  });
  const total = verbs.length * forms.length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0, seconds, misses };
}

export function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- storage

const STORAGE_KEY = 'hn-verbs-quiz';

export type SoloBest = { percent: number; seconds: number; at: number };
export type InfiniteBest = { seconds: number; correct: number; loops: number; streak?: number; at: number };

export type VerbAudio = { sound: boolean; music: boolean };

type Saved = {
  setup: QuizSetup;
  audio: VerbAudio;
  solo: Record<string, SoloBest>;
  infinite: InfiniteBest | null;
};

let state: Saved = { setup: DEFAULT_SETUP, audio: { sound: true, music: true }, solo: {}, infinite: null };
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
}

function validSetup(value: unknown): QuizSetup {
  const setup = { ...DEFAULT_SETUP, ...(value as Partial<QuizSetup> | null) };
  const forms = Array.isArray(setup.forms) ? VERB_FORMS.filter(form => setup.forms.includes(form)) : [];
  const source = setup.source;
  const sourceOk = !!source && (
    (source.kind === 'list' && !!listFor(source.id))
    || source.kind === 'random'
    || (source.kind === 'all' && ['all', 'regular', 'irregular'].includes(source.type))
    || (source.kind === 'custom' && Array.isArray(source.verbs))
  );
  return {
    mode: setup.mode === 'infinite' ? 'infinite' : 'solo',
    style: setup.style === 'review' ? 'review' : 'challenge',
    forms: forms.length ? forms : [...VERB_FORMS],
    source: sourceOk ? source : DEFAULT_SETUP.source,
  };
}

/** Reads what this phone saved, once. */
export function loadVerbsQuiz(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        const saved = raw ? JSON.parse(raw) as Partial<Saved> : null;
        if (saved) {
          state = {
            setup: validSetup(saved.setup),
            audio: { sound: saved.audio?.sound !== false, music: saved.audio?.music !== false },
            solo: saved.solo && typeof saved.solo === 'object' ? saved.solo : {},
            infinite: saved.infinite ?? null,
          };
        }
      })
      .catch(() => undefined)
      .finally(() => {
        setVerbAudio(state.audio);
        loaded = true;
        emit();
      });
  }
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void loadVerbsQuiz();
  return () => { listeners.delete(listener); };
}

const snapshot = () => state;

/** The saved setup and best marks, kept in step across screens. */
export function useVerbsQuiz() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The longest Infinito game saved on this phone. */
export function getInfiniteBest() {
  return state.infinite;
}

/** The setup as saved (after loadVerbsQuiz). */
export function getSetup() {
  return state.setup;
}

export function updateSetup(patch: Partial<QuizSetup>) {
  state = { ...state, setup: { ...state.setup, ...patch } };
  persist();
  emit();
}

/** The switches for effects and music. */
export function updateAudio(patch: Partial<VerbAudio>) {
  state = { ...state, audio: { ...state.audio, ...patch } };
  setVerbAudio(state.audio);
  persist();
  emit();
}

/** Keeps a Solitario result if it beats the one saved (more right, then faster). */
export function recordSolo(source: VerbSource, forms: VerbForm[], result: SoloResult): { best: SoloBest | null; isNew: boolean } {
  const key = sourceKey(source);
  // Only a full game (the three forms) is comparable with the next one.
  if (!key || forms.length !== VERB_FORMS.length) return { best: null, isNew: false };
  const previous = state.solo[key] ?? null;
  const better = !previous
    || result.percent > previous.percent
    || (result.percent === previous.percent && result.seconds < previous.seconds);
  if (!better) return { best: previous, isNew: false };
  const best = { percent: result.percent, seconds: result.seconds, at: Date.now() };
  state = { ...state, solo: { ...state.solo, [key]: best } };
  persist();
  emit();
  return { best, isNew: true };
}

/** Keeps an Infinito game if it lasted longer than the one saved. */
export function recordInfinite(game: Omit<InfiniteBest, 'at'>): { best: InfiniteBest; isNew: boolean } {
  const previous = state.infinite;
  if (previous && previous.seconds >= game.seconds) return { best: previous, isNew: false };
  const best = { ...game, at: Date.now() };
  state = { ...state, infinite: best };
  persist();
  emit();
  return { best, isNew: true };
}

// ---------------------------------------------------------------- the game being played

export type PlaySession = { setup: QuizSetup; verbs: Verb[] };

let session: PlaySession | null = null;

/** Draws the verbs of a game. Desafío and Infinito shuffle them; Repaso keeps the list. */
export function startSession(setup: QuizSetup, only?: Verb[]): PlaySession {
  const verbs = only ?? verbsFor(setup.source);
  const ordered = setup.mode === 'solo' && setup.style === 'review' ? verbs : shuffle(verbs);
  session = { setup, verbs: ordered };
  return session;
}

/** The game the setup page started (null after a reload of the web page). */
export function currentSession() {
  return session;
}
