import { httpsCallable } from 'firebase/functions';
import { Linking, Platform } from 'react-native';
import { cached, dropCached, peekCached } from './cache';
import { functions } from './firebase';
import type { HnEvent } from './events-service';

// Organizar (app/organize): one place for what Admin, CEE and HNT run from
// the phone. The events come from listOrganizedEvents (functions/events.js);
// tickets from functions/tickets.js.

/** Who sees Organizar. Directiva stays out for now (its course has the Calendar). */
export const ORGANIZER_ROLES = ['Admin', 'CEE', 'HNT'];
/** Who can suspend classes or send everyone home early (functions/day-changes.js). */
export const DAY_CHANGE_ROLES = ['Admin', 'HNT'];

export function canOrganize(role: string | null | undefined) {
  return !!role && ORGANIZER_ROLES.includes(role);
}

/**
 * The web panel (hanet-panel). While it isn't published this stays null and
 * the web opens Organizar like the phone does; once it is, the web's
 * Organizar button opens the panel in another tab.
 */
export const WEB_PANEL_URL: string | null = null;

/** On the web with the panel published, Organizar is the panel. */
export function opensWebPanel() {
  return Platform.OS === 'web' && !!WEB_PANEL_URL;
}

export function openWebPanel() {
  if (WEB_PANEL_URL) void Linking.openURL(WEB_PANEL_URL);
}

export type OrganizedEvents = {
  events: HnEvent[];
  role: string;
  /** HNT: city events (HaNet Eventos) are theirs too. */
  canRegional: boolean;
};

const KEY = 'organize:events';

export function listOrganizedEvents() {
  return cached(KEY, async () => (await httpsCallable<void, OrganizedEvents>(functions, 'listOrganizedEvents')()).data);
}

export function peekOrganizedEvents() {
  return peekCached<OrganizedEvents>(KEY);
}

/** Events whose door is open now (3 h before to 24 h after), soonest first. */
export function eventsToday(list: OrganizedEvents | undefined | null) {
  return (list?.events ?? []).filter(event => event.canCheckIn);
}

export type EventFilter = 'all' | 'institution' | 'private' | 'regional';

export function eventFilter(event: HnEvent): Exclude<EventFilter, 'all'> {
  if (event.kind === 'regional') return 'regional';
  return event.private ? 'private' : 'institution';
}

export type EventCourse = { id: string; students: number };
export type EventPerson = { uid: string; name: string };

/** The institution's courses with how many students each has (from the nómina). */
export function listEventCourses() {
  return cached('organize:courses', async () => (await httpsCallable<Record<string, never>, { courses: EventCourse[] }>(functions, 'listEventPeople')({})).data.courses);
}

/** The people of one course, to send one of them a ticket. */
export async function listCoursePeople(courseId: string) {
  return (await httpsCallable<{ courseId: string }, { people: EventPerson[] }>(functions, 'listEventPeople')({ courseId })).data.people;
}

/** The institution's docentes, to let some of them scan at the door. */
export async function listTeachers() {
  return (await httpsCallable<{ teachers: true }, { teachers: EventPerson[] }>(functions, 'listEventPeople')({ teachers: true })).data.teachers;
}

export type CourseLead = { courseId: string; uid: string; name: string };

/** Each course's Presidente de curso (functions/tickets.js), who receives its tickets. */
export function listCourseLeads() {
  return cached('organize:leads', async () => (await httpsCallable<void, { leads: CourseLead[] }>(functions, 'listCourseLeads')()).data.leads);
}

export async function setCourseLead(uid: string, on: boolean) {
  const result = (await httpsCallable<{ uid: string; on: boolean }, { on: boolean; courseId: string }>(functions, 'setCourseLead')({ uid, on })).data;
  dropCached('organize:leads');
  return result;
}

/** A docente's events whose door they may scan, without organizing them. */
export function listMyDoorEvents() {
  return cached('organize:door', async () => (await httpsCallable<void, { events: DoorEvent[] }>(functions, 'listMyDoorEvents')()).data.events);
}

export type DoorEvent = Pick<HnEvent, 'id' | 'title' | 'startsAt' | 'endsAt' | 'venueName' | 'imageUrl'>;

/** The door is open from 3 h before to 24 h after (as Pasar lista). */
export function doorOpen(event: Pick<HnEvent, 'startsAt' | 'endsAt'>, now = Date.now()) {
  const end = event.endsAt || event.startsAt;
  return now >= event.startsAt - 3 * 36e5 && now <= end + 24 * 36e5;
}
