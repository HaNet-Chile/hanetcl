import { httpsCallable } from 'firebase/functions';
import { useSyncExternalStore } from 'react';

import { showAppError } from '@/services/app-error';
import { functions } from '@/services/firebase';

/**
 * "Cerrar HaNet al público" (functions/app-status.js): HNT can close HaNet
 * for everyone but the team. The app asks on launch and each time it comes
 * back to the front (components/errors/AppErrorLayer.tsx); while it is
 * closed, PausedScreen covers everything and the servers refuse the calls.
 */
export type AppPauseKind = 'maintenance' | 'incident' | 'closed';
export type AppStatus = { open: boolean; kind: AppPauseKind | null; message: string | null; until: number | null };

const STATUS_URL = 'https://southamerica-west1-hanet-edu.cloudfunctions.net/getAppStatus';
const TIMEOUT_MS = 6000;
export const PAUSE_KINDS: AppPauseKind[] = ['maintenance', 'incident', 'closed'];
export const PAUSE_MESSAGE_MAX = 280;

/** The state as the servers say it, or null if they can't be asked (then HaNet stays as it was). */
export async function fetchAppStatus(): Promise<AppStatus | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(STATUS_URL, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json() as Partial<AppStatus>;
    if (typeof data.open !== 'boolean') return null;
    const status: AppStatus = {
      open: data.open,
      kind: data.kind && PAUSE_KINDS.includes(data.kind) ? data.kind : data.open ? null : 'maintenance',
      message: typeof data.message === 'string' ? data.message : null,
      until: typeof data.until === 'number' ? data.until : null,
    };
    setKnownStatus(status);
    return status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** HNT only: closes HaNet ({ open: false, kind, message, until }) or opens it ({ open: true }). */
export async function saveAppStatus(next: { open: true } | { open: false; kind: AppPauseKind; message: string | null; until: number | null }) {
  const result = await httpsCallable<typeof next, AppStatus>(functions, 'setAppStatus')(next);
  setKnownStatus(result.data);
  return result.data;
}

// The last state the app knows, for the screen and the team's notice.
let known: AppStatus | null = null;
const listeners = new Set<() => void>();

function setKnownStatus(status: AppStatus) {
  known = status;
  listeners.forEach(listener => listener());
}

export function useKnownAppStatus() {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => known,
    () => null,
  );
}

// What the screen shows: the real state, or the one being tried out from the HNT panel.
let shown: AppStatus | null = null;

export function pausedStatus() {
  return shown ?? known;
}

/** Opens PausedScreen as a preview with these values: its buttons only close it. */
export function previewPausedScreen(status: AppStatus) {
  shown = status;
  showAppError('paused', true);
}

export function endPausedPreview() {
  shown = null;
}
