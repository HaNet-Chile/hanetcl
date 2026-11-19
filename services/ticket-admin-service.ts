import { httpsCallable } from 'firebase/functions';
import { cached, dropCached } from './cache';
import { functions } from './firebase';

// Handing out and managing an event's tickets, for those who organize it
// (Organizar). The functions live in functions/tickets.js; the holder's side
// and the door scanner (app/tickets/) too.

export type TicketStatus = 'active' | 'link' | 'shared' | 'printed' | 'used' | 'voided';

export type TicketRow = {
  ticketId: string;
  number: number;
  holderUid: string | null;
  holderName: string;
  courseId: string;
  guestName: string;
  status: TicketStatus;
  giftedToName: string;
  issuedAt: number | null;
  usedAt: number | null;
};

export type TicketTotals = {
  issued: number;
  active: number;
  link: number;
  shared: number;
  printed: number;
  used: number;
  voided: number;
  gifted: number;
  cap: number | null;
};

export type TicketScanner = { uid: string; name: string };

export type EventTicketList = { rows: TicketRow[]; totals: TicketTotals; scanners?: TicketScanner[] };

export type IssueInput =
  | { eventId: string; mode: 'courses'; courseIds: string[]; perStudent: number; holder: 'student' | 'courseLead'; dryRun?: boolean }
  | { eventId: string; mode: 'single'; uid: string; count?: number; dryRun?: boolean }
  | { eventId: string; mode: 'guest'; guestName: string; dryRun?: boolean };

export type IssueResult = {
  count: number;
  issued: number;
  cap: number | null;
  remaining: number | null;
  /** People who already had a ticket and got no other. */
  skipped?: number;
  link?: { ticketId: string; url: string };
};

const key = (eventId: string) => `tickets:${eventId}`;

export function listEventTickets(eventId: string) {
  return cached(key(eventId), async () => (await httpsCallable<{ eventId: string }, EventTicketList>(functions, 'listEventTickets')({ eventId })).data);
}

export async function issueTickets(input: IssueInput) {
  const result = (await httpsCallable<IssueInput, IssueResult>(functions, 'issueTickets')(input)).data;
  if (!input.dryRun) dropCached(key(input.eventId));
  return result;
}

export async function voidTicket(eventId: string, ticketId: string, replace = false) {
  const result = (await httpsCallable<{ eventId: string; ticketId: string; replace: boolean }, { voided: true; replacement?: { ticketId: string; url?: string } }>(functions, 'voidTicket')({ eventId, ticketId, replace })).data;
  dropCached(key(eventId));
  return result;
}

/** A new link for a ticket; the previous one stops working. */
export async function resendTicketLink(eventId: string, ticketId: string) {
  const result = (await httpsCallable<{ ticketId: string }, { url: string }>(functions, 'resendTicketLink')({ ticketId })).data;
  dropCached(key(eventId));
  return result.url;
}

/** Who a row is for, as the list shows it. */
export function ticketHolder(row: TicketRow) {
  return row.holderName || row.guestName;
}

/** "Llegaron 212 de 300": `issued` already leaves out the voided ones. */
export function arrivals(totals: TicketTotals | undefined) {
  if (!totals) return { arrived: 0, of: 0 };
  return { arrived: totals.used, of: totals.issued };
}

/** Lets a docente scan at this event's door, or takes it back. */
export async function setTicketScanner(eventId: string, uid: string, on: boolean) {
  await httpsCallable<{ eventId: string; uid: string; on: boolean }, { on: boolean }>(functions, 'setTicketScanner')({ eventId, uid, on });
  dropCached(key(eventId));
}
