import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_RELEASE_STAGE, APP_VERSION } from '@/constants/app-version';
import CHANGELOG from '@/constants/changelog.json';
import { hasSeenOnboarding } from './onboarding';

// The summary of a new version, shown once on the first Home after updating
// (a new build, an update over the air or the web's "Actualizar"). The
// version seen last and the switch in Configuraciones live on this phone.
// A fresh install starts at the current version: there is nothing "new" yet.

const SEEN_KEY = 'hanet.seenVersion';
const OFF_KEY = 'hanet.whatsNewPrompt';
/** At most this many lines, so the dialog stays a glance. */
const MAX_LINES = 3;

export type ReleaseSummary = { version: string; title: string; lines: string[] };

const CURRENT = `${APP_VERSION}${APP_RELEASE_STAGE ? `-${APP_RELEASE_STAGE}` : ''}`;

type Release = { version: string; title?: string; items: string[]; highlights?: string[] };

/** The current version's summary: its highlights, or its first changes. */
export function currentRelease(): ReleaseSummary | null {
  const release = (CHANGELOG.releases as Release[]).find(item => item.version === CURRENT);
  if (!release) return null;
  const lines = (release.highlights?.length ? release.highlights : release.items).slice(0, MAX_LINES);
  return lines.length ? { version: release.version, title: release.title ?? '', lines } : null;
}

function numbers(version: string) {
  return (/^(\d+)\.(\d+)\.(\d+)/.exec(version) ?? []).slice(1).map(Number);
}

function newer(next: string, previous: string) {
  const [a, b] = [numbers(next), numbers(previous)];
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) > (b[index] ?? 0);
  }
  return false;
}

export async function whatsNewPromptEnabled() {
  try {
    return (await AsyncStorage.getItem(OFF_KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function setWhatsNewPromptEnabled(on: boolean) {
  try {
    if (on) await AsyncStorage.removeItem(OFF_KEY);
    else await AsyncStorage.setItem(OFF_KEY, 'off');
  } catch {
    // Not remembered: the next update asks the same way.
  }
}

/** Whether this is the first visit to a newer version than the last one seen here. */
export async function shouldShowWhatsNew() {
  try {
    const seen = await AsyncStorage.getItem(SEEN_KEY);
    if (!seen) {
      // Never recorded: a phone that already went through the welcome pages
      // had HaNet before this prompt existed, so it did update.
      if (!(await hasSeenOnboarding())) {
        await markWhatsNewSeen();
        return false;
      }
    } else if (!newer(CURRENT, seen)) {
      return false;
    }
    if (!(await whatsNewPromptEnabled()) || !currentRelease()) {
      await markWhatsNewSeen();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function markWhatsNewSeen() {
  try {
    await AsyncStorage.setItem(SEEN_KEY, CURRENT);
  } catch {
    // Shown again next time, at worst.
  }
}
