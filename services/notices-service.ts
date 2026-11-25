import { httpsCallable } from 'firebase/functions';
import { cached, dropCached, peekCached } from './cache';
import { functions } from './firebase';

// Organizar's notifications (functions/notices.js): a short notice to the
// whole liceo, a jornada, courses, a group or a few students. It rings their
// phones and stays in their notifications section.

/** Who can pick students by name and keep groups. The CEE can't: it is students too. */
export const FULL_NOTICE_ROLES = ['Admin', 'HNT'];

export function canPickStudents(role: string | null | undefined) {
  return !!role && FULL_NOTICE_ROLES.includes(role);
}

export const NOTICE_MAX = 200;

export type NoticeAudience =
  | { kind: 'all'; staff?: boolean }
  | { kind: 'jornada'; jornada: 'manana' | 'tarde'; staff?: boolean }
  | { kind: 'courses'; courseIds: string[] }
  | { kind: 'leads' }
  | { kind: 'directivas' }
  | { kind: 'group'; groupId: string }
  | { kind: 'students'; uids: string[] };

/** Where tapping it leads: nowhere (it stays in Notificaciones), the Calendar or an event. */
export type NoticeLink = null | 'calendar' | { eventId: string };

export type NoticeInput = { audience: NoticeAudience; body: string; link?: NoticeLink };

export type SentNotice = {
  id: string;
  from: string;
  label: string;
  body: string;
  reached: number;
  at: number;
  url: string | null;
  /** Only Admin and HNT see who sent each one. */
  senderName: string | null;
  senderRole: string | null;
};

export type GroupMember = { uid: string; name: string; courseId: string | null };
export type NoticeGroup = { id: string; name: string; members: GroupMember[]; updatedAt: number };

const send = httpsCallable<NoticeInput & { dryRun?: boolean }, { reached: number; id?: string }>(functions, 'sendNotice');

/** How many people it would reach, without sending anything. */
export async function countNotice(input: NoticeInput) {
  return (await send({ ...input, dryRun: true })).data.reached;
}

export async function sendNotice(input: NoticeInput) {
  const result = (await send(input)).data;
  dropCached(HISTORY_KEY);
  return result.reached;
}

const HISTORY_KEY = 'organize:notices';

export type NoticeHistory = {
  notices: SentNotice[];
  /** The Espacio this person's notices come from ("CEE LCH Temuco"). */
  from: string;
};

export function listNotices() {
  return cached(HISTORY_KEY, async () => (await httpsCallable<void, NoticeHistory>(functions, 'listNotices')()).data);
}

export function peekNotices() {
  return peekCached<NoticeHistory>(HISTORY_KEY);
}

const GROUPS_KEY = 'organize:noticeGroups';

export function listNoticeGroups() {
  return cached(GROUPS_KEY, async () => (await httpsCallable<void, { groups: NoticeGroup[] }>(functions, 'listNoticeGroups')()).data.groups);
}

export function peekNoticeGroups() {
  return peekCached<NoticeGroup[]>(GROUPS_KEY);
}

export async function saveNoticeGroup(group: { id?: string; name: string; uids: string[] }) {
  const result = (await httpsCallable<typeof group, { id: string }>(functions, 'saveNoticeGroup')(group)).data;
  dropCached(GROUPS_KEY);
  return result.id;
}

export async function deleteNoticeGroup(id: string) {
  await httpsCallable<{ id: string }, { ok: boolean }>(functions, 'deleteNoticeGroup')({ id });
  dropCached(GROUPS_KEY);
}
