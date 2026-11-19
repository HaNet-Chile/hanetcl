import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { cached, dropCached, peekCached, putCached } from './cache';
import { calendarDb, functions } from './firebase';
import { doorCall, warmDoor } from './door';

// Entradas (functions/tickets.js): single-use tickets for an institution
// event. The QR in the app changes every 30 seconds, like the HN-QR: the
// phone computes it from a key per ticket that the backend gives once, so it
// keeps working without internet. Shared as an image or printed, a ticket
// leaves the app with a fixed code instead.

export type TicketStatus = 'active' | 'link' | 'shared' | 'printed' | 'used' | 'voided';
export type TicketStyle = 'simple' | 'brand' | 'formal';

export type TicketEvent = {
  id: string;
  /** The institution's full name, for the printed ticket. */
  institutionName: string;
  title: string;
  startsAt: number | null;
  endsAt: number | null;
  venueName: string;
  address: string;
  city: string;
  imageUrl: string | null;
  palette: string[];
  authorName: string;
  cap: number | null;
  giftable: boolean;
  printable: boolean;
  style: TicketStyle;
  note: string;
};

export type Ticket = {
  id: string;
  eventId: string;
  number: number | null;
  holderName: string;
  courseId: string;
  status: TicketStatus;
  giftedFromName: string;
  giftedToName: string;
  issuedAt: number | null;
  usedAt: number | null;
  linkExpiresAt: number | null;
  receivedAt: number | null;
  event: TicketEvent;
};

export type GiftPreview = {
  ticket: Omit<Ticket, 'event'>;
  event: TicketEvent;
  fromName: string;
  organizer: string;
  mine: boolean;
};

export type DoorResult =
  | { result: 'valid' | 'used'; ticket: { ticketId: string; number: number | null; holderName: string; courseId: string; usedAt: number | null }; count: number; total: number }
  | { result: 'account'; name: string; courseId: string; tickets: DoorTicketRow[]; count: number; total: number };

export type DoorTicketRow = {
  ticketId: string;
  number: number | null;
  holderName: string;
  courseId: string;
  status: TicketStatus;
  usedAt: number | null;
};

const STEP_MS = 30_000;
const CACHE_KEY = 'tickets';
const keyName = (ticketId: string) => `hanet.ticketKey.${ticketId}`;
const memory = new Map<string, string>();

function call<In, Out>(name: string) {
  return async (input: In) => (await httpsCallable<In, Out>(functions, name)(input)).data;
}

/** The account's tickets, newest event first. Kept on the phone for offline. */
export async function listMyTickets(): Promise<Ticket[]> {
  const result = await cached(CACHE_KEY, () => call<void, { tickets: Ticket[] }>('listMyTickets')(undefined));
  return result.tickets;
}

export const TICKETS_CACHE_KEY = CACHE_KEY;

/** Updates one ticket in what the phone kept (after a gift, a share, the door). */
export function patchKeptTicket(id: string, patch: Partial<Ticket>) {
  const kept = peekCached<{ tickets: Ticket[] }>(CACHE_KEY);
  if (!kept) return;
  putCached(CACHE_KEY, { tickets: kept.tickets.map(ticket => (ticket.id === id ? { ...ticket, ...patch } : ticket)) });
}

/** Tickets the account can still use at the door, in the app. */
export function isLive(ticket: Pick<Ticket, 'status'>) {
  return ticket.status === 'active';
}

/** Whether the event is over (a day after it ends). */
export function isPast(event: Pick<TicketEvent, 'startsAt' | 'endsAt'>, now = Date.now()) {
  const end = event.endsAt ?? event.startsAt;
  return end !== null && now > end + 24 * 60 * 60 * 1000;
}

async function loadKey(ticketId: string, fresh = false): Promise<string | null> {
  if (!fresh && memory.has(ticketId)) return memory.get(ticketId) ?? null;
  let key: string | null = null;
  if (!fresh) {
    try {
      key = await AsyncStorage.getItem(keyName(ticketId));
    } catch {
      // Only a convenience: the backend gives it again.
    }
  }
  if (!key) {
    try {
      key = (await call<{ ticketId: string }, { key: string }>('getTicketKey')({ ticketId })).key;
      await AsyncStorage.setItem(keyName(ticketId), key).catch(() => undefined);
    } catch {
      return null;
    }
  }
  memory.set(ticketId, key);
  return key;
}

/** Forgets a ticket's key (after it was given away or shared). */
export async function forgetKey(ticketId: string) {
  memory.delete(ticketId);
  await AsyncStorage.removeItem(keyName(ticketId)).catch(() => undefined);
}

/** How long until the code changes, in milliseconds. */
export function msToNextTicketCode(now = Date.now()) {
  return STEP_MS - (now % STEP_MS);
}

/** The QR's value for this moment, or null without a key (no internet the first time). */
export async function ticketQrValue(ticketId: string, now = Date.now()): Promise<string | null> {
  const key = await loadKey(ticketId);
  if (!key) return null;
  const step = Math.floor(now / STEP_MS);
  const digest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${key}:${step}`);
  return `hanet://ticket/${ticketId}?c=${digest.slice(0, 10)}`;
}

/**
 * Calls `onUsed` the moment the ticket is used at the door. Listens to the
 * ticket live; if the rules don't allow it yet, asks every few seconds.
 */
export function watchTicketUsed(ticketId: string, onUsed: (usedAt: number) => void): () => void {
  let stopped = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  const startPolling = () => {
    if (poll || stopped) return;
    poll = setInterval(() => {
      call<{ ticketId: string }, { status: TicketStatus; usedAt: number | null }>('getTicketStatus')({ ticketId })
        .then(result => {
          if (!stopped && result.status === 'used') {
            stop();
            onUsed(result.usedAt ?? Date.now());
          }
        })
        .catch(() => undefined);
    }, 3000);
  };
  const unsubscribe = onSnapshot(
    doc(calendarDb, 'hnTickets', ticketId),
    snapshot => {
      const data = snapshot.data();
      if (!stopped && data?.status === 'used') {
        stop();
        onUsed(typeof data.usedAt?.toMillis === 'function' ? data.usedAt.toMillis() : Date.now());
      }
    },
    () => startPolling(),
  );
  function stop() {
    stopped = true;
    unsubscribe();
    if (poll) clearInterval(poll);
  }
  return stop;
}

export async function giftTicket(ticketId: string) {
  const result = await call<{ ticketId: string }, { url: string; expiresAt: number }>('giftTicket')({ ticketId });
  await forgetKey(ticketId);
  patchKeptTicket(ticketId, { status: 'link', linkExpiresAt: result.expiresAt });
  return result;
}

export async function cancelGift(ticketId: string) {
  await call<{ ticketId: string }, { status: TicketStatus }>('cancelGift')({ ticketId });
  await forgetKey(ticketId);
  patchKeptTicket(ticketId, { status: 'active', linkExpiresAt: null });
}

export async function shareTicket(ticketId: string, kind: 'image' | 'print') {
  const result = await call<{ ticketId: string; kind: string }, { code: string; qr: string }>('shareTicket')({ ticketId, kind });
  await forgetKey(ticketId);
  patchKeptTicket(ticketId, { status: kind === 'print' ? 'printed' : 'shared' });
  return result;
}

export const previewGift = (token: string) => call<{ token: string }, GiftPreview>('previewGift')({ token });

export async function acceptGift(token: string) {
  const result = await call<{ token: string }, { ticketId: string }>('acceptGift')({ token });
  dropCached(CACHE_KEY);
  return result;
}

export const validateTicket = (input: { eventId: string; qr?: string; ticketId?: string }) =>
  doorCall<typeof input, DoorResult>('validateTicket', input);

/** Opening the scanner: wakes the door and answers "Llegaron" so far. */
export const warmTicketDoor = (eventId: string) =>
  warmDoor<{ warm: true; count: number; total: number | null }>('validateTicket', { eventId });

// What the door reads, so anything else is turned away without asking the server.
const DOOR_QR = [
  /^hanet:\/\/ticket\/[A-Za-z0-9]{12,40}\?c=[0-9a-f]{10}$/,
  /^hanet:\/\/t\/[2-9A-Z]{4}-?[2-9A-Z]{4}$/,
  /^hanet:\/\/id\//,
  /^[2-9A-Z]{4}-?[2-9A-Z]{4}$/,
];

/** Whether a scanned or typed value can be a HaNet ticket (or HN-QR). */
export function looksLikeTicket(value: string) {
  const raw = value.trim();
  return DOOR_QR.some(pattern => pattern.test(raw) || pattern.test(raw.toUpperCase()));
}

/** The token of a gift link, from the whole link or the token alone. */
export function giftToken(value: string | undefined | null) {
  if (!value) return null;
  const match = /[?&]t=([A-Za-z0-9_-]{16,40})/.exec(value);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{16,40}$/.test(value) ? value : null;
}

// Which tickets this phone already showed arriving (app/tickets/arrival.tsx).
const SEEN_KEY = 'hanet.ticketsSeen';

export async function unseenTickets(tickets: Ticket[]): Promise<Ticket[]> {
  let seen: string[] = [];
  try {
    seen = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) ?? '[]');
  } catch {
    // Nothing kept: everything counts as new once.
  }
  const known = new Set(seen);
  return tickets.filter(ticket => ticket.status === 'active' && !known.has(ticket.id));
}

export async function markTicketsSeen(ids: string[]) {
  try {
    const seen: string[] = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) ?? '[]');
    const next = [...new Set([...seen, ...ids])].slice(-300);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // Only a convenience: at worst the arrival plays again.
  }
}
