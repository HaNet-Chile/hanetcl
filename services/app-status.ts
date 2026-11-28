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
/**
 * institutionName: set when the pause is one liceo's (below), for the
 * closed screen's copy; the global one has none.
 */
export type AppStatus = { open: boolean; kind: AppPauseKind | null; message: string | null; until: number | null; institutionName?: string | null };

/**
 * "Cerrar HaNet en un liceo" (functions/app-status.js): HNT, or the liceo's
 * Admin from the web panel, closes HaNet for one institution. Its members get
 * PausedScreen; HNT and its Admin still get in, and its teachers when
 * `teachers` says so. It may start later (`from`) and opens by itself at
 * `until`. `closed` says whether it holds right now.
 */
export type InstitutionClosure = {
  closed: boolean;
  kind: AppPauseKind | null;
  message: string | null;
  from: number | null;
  until: number | null;
  teachers: boolean;
  name: string | null;
};

const STATUS_URL = 'https://southamerica-west1-hanet-edu.cloudfunctions.net/getAppStatus';
const TIMEOUT_MS = 6000;
export const PAUSE_KINDS: AppPauseKind[] = ['maintenance', 'incident', 'closed'];
export const PAUSE_MESSAGE_MAX = 280;

function closureFrom(value: unknown): InstitutionClosure | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<InstitutionClosure>;
  if (typeof data.closed !== 'boolean') return null;
  const number = (item: unknown) => (typeof item === 'number' ? item : null);
  return {
    closed: data.closed,
    kind: data.kind && PAUSE_KINDS.includes(data.kind) ? data.kind : data.closed ? 'closed' : null,
    message: typeof data.message === 'string' ? data.message : null,
    from: number(data.from),
    until: number(data.until),
    teachers: data.teachers === true,
    name: typeof data.name === 'string' ? data.name : null,
  };
}

/**
 * The state as the servers say it, or null if they can't be asked (then
 * HaNet stays as it was). With an institution, that liceo's closure comes
 * along (`institution`).
 */
export async function fetchAppStatus(institutionId?: string | null): Promise<(AppStatus & { institution?: InstitutionClosure | null }) | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = institutionId ? `${STATUS_URL}?i=${encodeURIComponent(institutionId)}` : STATUS_URL;
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json() as Partial<AppStatus> & { institution?: unknown };
    if (typeof data.open !== 'boolean') return null;
    const status: AppStatus = {
      open: data.open,
      kind: data.kind && PAUSE_KINDS.includes(data.kind) ? data.kind : data.open ? null : 'maintenance',
      message: typeof data.message === 'string' ? data.message : null,
      until: typeof data.until === 'number' ? data.until : null,
    };
    setKnownStatus(status);
    if (!institutionId) return status;
    const institution = closureFrom(data.institution);
    setKnownInstitution(institution);
    return { ...status, institution };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Forgets the liceo's closure, when the session ends. */
export function forgetInstitutionClosure() {
  if (knownInstitution) setKnownInstitution(null);
}

/** HNT only: closes HaNet ({ open: false, kind, message, until }) or opens it ({ open: true }). */
export async function saveAppStatus(next: { open: true } | { open: false; kind: AppPauseKind; message: string | null; until: number | null }) {
  const result = await httpsCallable<typeof next, AppStatus>(functions, 'setAppStatus')(next);
  setKnownStatus(result.data);
  return result.data;
}

// The last state the app knows, for the screen and the team's notice.
let known: AppStatus | null = null;
let knownInstitution: InstitutionClosure | null = null;
const listeners = new Set<() => void>();

function setKnownStatus(status: AppStatus) {
  known = status;
  listeners.forEach(listener => listener());
}

function setKnownInstitution(closure: InstitutionClosure | null) {
  knownInstitution = closure;
  listeners.forEach(listener => listener());
}

/** The signed-in account's liceo closure, as last asked (null: open or not asked). */
export function useKnownInstitutionClosure() {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => knownInstitution,
    () => null,
  );
}

/** Whether this role still gets in while its liceo is closed (exempt() in functions/app-status.js). */
export function passesInstitutionClosure(role: string | null | undefined, closure: InstitutionClosure) {
  return role === 'HNT' || role === 'Admin' || (role === 'Profesor' && closure.teachers);
}

/** A liceo's closure as the closed screen draws it. */
export function closureAsStatus(closure: Pick<InstitutionClosure, 'kind' | 'message' | 'until' | 'name'>): AppStatus {
  return { open: false, kind: closure.kind ?? 'closed', message: closure.message, until: closure.until, institutionName: closure.name ?? '' };
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
  if (shown) return shown;
  if (known && !known.open) return known;
  return knownInstitution?.closed ? closureAsStatus(knownInstitution) : known;
}

/** Opens PausedScreen as a preview with these values: its buttons only close it. */
export function previewPausedScreen(status: AppStatus) {
  shown = status;
  showAppError('paused', true);
}

export function endPausedPreview() {
  shown = null;
}
