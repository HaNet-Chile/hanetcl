import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, Platform } from 'react-native';
import { applyColorScheme } from '@/constants/design-tokens';
import type { AppScheme } from '@/constants/design-tokens';

// The theme (Configuraciones → Apariencia): dark (the default), light, or
// whatever the phone uses. It is a setting of this device. The screens'
// StyleSheets read `AppColors` once when they load, so the theme is chosen
// before they load (`index.tsx`) and changing it restarts HaNet.

export type ColorSchemeMode = 'dark' | 'light' | 'system';

const KEY = 'hanet.colorScheme';

let current: ColorSchemeMode = 'dark';

function parse(value: string | null | undefined): ColorSchemeMode {
  return value === 'light' || value === 'system' ? value : 'dark';
}

/** The theme a mode shows right now. */
export function resolveScheme(mode: ColorSchemeMode): AppScheme {
  if (mode !== 'system') return mode;
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

/** The mode chosen on this device. */
export function colorSchemeMode() {
  return current;
}

/**
 * On the web the setting can be read at once (AsyncStorage keeps it in
 * localStorage under the same key), so the first render already has it.
 */
export function readColorSchemeSync(): ColorSchemeMode | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return parse(window.localStorage.getItem(KEY));
  } catch {
    return 'dark';
  }
}

/** Reads the setting and fills the colors. Runs once, before the screens load. */
export async function prepareColorScheme() {
  const sync = readColorSchemeSync();
  if (sync) {
    current = sync;
  } else {
    try {
      current = parse(await AsyncStorage.getItem(KEY));
    } catch {
      current = 'dark';
    }
  }
  applyColorScheme(resolveScheme(current));
  return current;
}

/** Saves a new mode. The caller restarts HaNet to show it. */
export async function saveColorSchemeMode(mode: ColorSchemeMode) {
  current = mode;
  await AsyncStorage.setItem(KEY, mode);
}
