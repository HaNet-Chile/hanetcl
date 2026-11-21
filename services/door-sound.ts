import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

// The sounds of the door (muxp's, compressed to mp3), played with the
// vibration on each read: the ticket scanner (app/tickets/scan.tsx) and
// Pasar lista with HN-QR (app/event-checkin.tsx).
//   scanned    a QR was read and the server is checking it
//   valid      valid ticket / attendee checked in
//   invalid    not a ticket, already used or the server said no
//   idDetected a HN-QR: the account was found (its tickets, or already on the list)
// The answer cuts the "scanned" sound, so a fast door never stacks them.
// Each sound rewinds itself when it ends (or is cut): calling play() on a
// player that sits at its end does nothing, and a seekTo(0) fired at the same
// time lands after it, which made every other scan silent.
// The phone's silent switch is respected (the vibration still says it).

const SOUNDS = {
  scanned: require('@/assets/sounds/door/scanned.mp3'),
  valid: require('@/assets/sounds/door/valid.mp3'),
  invalid: require('@/assets/sounds/door/invalid.mp3'),
  idDetected: require('@/assets/sounds/door/id-detected.mp3'),
} as const;

export type DoorSound = keyof typeof SOUNDS;

const players = new Map<DoorSound, AudioPlayer>();
let modeSet = false;

function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  if (Platform.OS === 'web') return;
  setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => undefined);
}

function player(key: DoorSound) {
  let found = players.get(key);
  if (!found) {
    const created = createAudioPlayer(SOUNDS[key]);
    created.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) rewind(created);
    });
    players.set(key, created);
    found = created;
  }
  return found;
}

function rewind(sound: AudioPlayer) {
  sound.pause();
  void sound.seekTo(0).catch(() => undefined);
}

/** Loads the sounds when the scanner opens, so the first read sounds on time. */
export function prepareDoorSounds() {
  ensureMode();
  try {
    (Object.keys(SOUNDS) as DoorSound[]).forEach(player);
  } catch {
    // Without sound the door still works.
  }
}

export function playDoorSound(key: DoorSound) {
  ensureMode();
  try {
    const loading = players.get('scanned');
    if (key !== 'scanned' && loading?.playing) rewind(loading);
    const sound = player(key);
    if (sound.currentTime < 0.01 && !sound.playing) {
      sound.play();
      return;
    }
    // Still playing or not rewound yet: start over once the seek is done.
    sound.pause();
    sound.seekTo(0).then(() => sound.play(), () => sound.play());
  } catch {
    // A sound that can't play never stops the door.
  }
}
