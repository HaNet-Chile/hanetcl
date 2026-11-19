import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

// The sounds and music of Verbos en inglés, the same ones as muxp's
// VerbosByMuxp (compressed to mp3). Effects and music each have their own
// switch (services/verbs-quiz.ts keeps them); the phone's silent switch is
// respected and nothing plays with the app in the background.

const EFFECTS = {
  select: require('@/assets/sounds/verbs/select.mp3'),
  start: require('@/assets/sounds/verbs/start.mp3'),
  confirm: require('@/assets/sounds/verbs/confirm.mp3'),
  countdown: require('@/assets/sounds/verbs/countdown.mp3'),
  challenge: require('@/assets/sounds/verbs/desafio.mp3'),
  review: require('@/assets/sounds/verbs/repaso.mp3'),
  scoreBad: require('@/assets/sounds/verbs/score-bad.mp3'),
  scoreGood: require('@/assets/sounds/verbs/score-good.mp3'),
  scorePerfect: require('@/assets/sounds/verbs/score-perfect.mp3'),
  surrender: require('@/assets/sounds/verbs/seguro-de-rendirte.mp3'),
  fallingBehind: require('@/assets/sounds/verbs/te-quedas-atras.mp3'),
  winning: require('@/assets/sounds/verbs/vas-ganando.mp3'),
  gameOver: require('@/assets/sounds/verbs/gameover-infinito.mp3'),
} as const;

const MUSIC = {
  solo: require('@/assets/sounds/verbs/music-solo.mp3'),
  infinite: require('@/assets/sounds/verbs/music-infinito-1.mp3'),
  infiniteFast: require('@/assets/sounds/verbs/music-infinito-2.mp3'),
} as const;

export type VerbEffect = keyof typeof EFFECTS;
export type VerbMusic = keyof typeof MUSIC;

const VOLUMES: Partial<Record<VerbEffect, number>> = { select: 0.7, surrender: 0.8, fallingBehind: 0.8, winning: 0.8 };
const MUSIC_VOLUME = 0.25;

let soundOn = true;
let musicOn = true;
let modeSet = false;
const effects = new Map<VerbEffect, AudioPlayer>();
const tracks = new Map<VerbMusic, AudioPlayer>();
let playing: VerbMusic | null = null;
// The track the game wants, even with the music off: switching it back on resumes it.
let wanted: VerbMusic | null = null;
let fade: ReturnType<typeof setInterval> | null = null;

function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  if (Platform.OS === 'web') return;
  setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
}

function effectPlayer(key: VerbEffect) {
  let player = effects.get(key);
  if (!player) {
    player = createAudioPlayer(EFFECTS[key]);
    effects.set(key, player);
  }
  return player;
}

function trackPlayer(key: VerbMusic) {
  let player = tracks.get(key);
  if (!player) {
    player = createAudioPlayer(MUSIC[key]);
    player.loop = true;
    tracks.set(key, player);
  }
  return player;
}

/** Applies the switches saved on this phone. */
export function setVerbAudio(settings: { sound: boolean; music: boolean }) {
  soundOn = settings.sound;
  if (!soundOn) effects.forEach(player => player.pause());
  const wasOn = musicOn;
  musicOn = settings.music;
  const track = wanted;
  if (wasOn && !musicOn) {
    stopMusic(false);
    wanted = track;
  }
  if (!wasOn && musicOn && track) playMusic(track);
}

export function playEffect(key: VerbEffect) {
  if (!soundOn) return;
  ensureMode();
  try {
    const player = effectPlayer(key);
    player.volume = VOLUMES[key] ?? 0.5;
    void player.seekTo(0).catch(() => undefined);
    player.play();
  } catch {
    // A sound that can't play never stops the game.
  }
}

export function stopEffect(key: VerbEffect) {
  effects.get(key)?.pause();
}

/** Loops a track, stopping any other; the same one keeps playing. */
export function playMusic(key: VerbMusic) {
  wanted = key;
  if (!musicOn) return;
  ensureMode();
  if (playing === key && !fade) return;
  stopMusic(false);
  wanted = key;
  try {
    const player = trackPlayer(key);
    player.volume = MUSIC_VOLUME;
    void player.seekTo(0).catch(() => undefined);
    player.play();
    playing = key;
  } catch {
    playing = null;
  }
}

/** Stops the music, fading it out over half a second by default. */
export function stopMusic(fadeOut = true) {
  if (fade) {
    clearInterval(fade);
    fade = null;
    tracks.forEach(player => player.pause());
  }
  const key = playing;
  playing = null;
  wanted = null;
  if (!key) return;
  const player = tracks.get(key);
  if (!player) return;
  if (!fadeOut) {
    player.pause();
    return;
  }
  fade = setInterval(() => {
    if (player.volume > 0.03) {
      player.volume = Math.max(0, player.volume - 0.03);
      return;
    }
    player.pause();
    if (fade) clearInterval(fade);
    fade = null;
  }, 40);
}

/** Silences everything (leaving a game). */
export function stopAllVerbAudio() {
  stopMusic(false);
  effects.forEach(player => player.pause());
}
