import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { CalendarEvent } from './ical-service';

// The Calendar's notice on the Home ("3 días · Próx. eval."): which kinds of
// events of the course it may show. Each person picks them in Configuraciones;
// it is a setting of this phone, kept here only. The notice shows the soonest
// event among the chosen kinds.

const KEY = 'hanet.homeCalendarTypes';

// The Calendar's event types as they are saved (app/create-event.tsx): data, not labels.
// i18n-ignore-next-line
export const HOME_CALENDAR_TYPES = ['Evaluación sumativa', 'Evaluación formativa', 'Taller', 'Tarea', 'Entrega', 'Remedial', 'Actividad', 'Otro'] as const;
export type HomeCalendarType = (typeof HOME_CALENDAR_TYPES)[number];

/** What counts toward school work goes by default; activities and the rest are opt-in. */
// i18n-ignore-next-line
export const DEFAULT_HOME_CALENDAR_TYPES: HomeCalendarType[] = ['Evaluación sumativa', 'Evaluación formativa', 'Taller', 'Tarea', 'Entrega', 'Remedial'];

let chosen: HomeCalendarType[] = DEFAULT_HOME_CALENDAR_TYPES;
const listeners = new Set<() => void>();

function set(next: HomeCalendarType[]) {
  // In the list's own order, so the same choice is always the same value.
  chosen = HOME_CALENDAR_TYPES.filter(type => next.includes(type));
  listeners.forEach(listener => listener());
}

// Kept as { chosen, known }: the kinds the phone already knew when the person
// chose. A kind added later ("Entrega", 2026-11-25) starts as its default.
// An older phone kept only the chosen list, from before "Entrega".
// i18n-ignore-next-line
const KNOWN_BEFORE_ENTREGA = ['Evaluación sumativa', 'Evaluación formativa', 'Taller', 'Tarea', 'Remedial', 'Actividad', 'Otro'];

const isType = (type: unknown): type is HomeCalendarType => HOME_CALENDAR_TYPES.includes(type as HomeCalendarType);

void AsyncStorage.getItem(KEY)
  .then(value => {
    if (value === null) return;
    const kept = JSON.parse(value) as unknown;
    const saved = Array.isArray(kept) ? { chosen: kept, known: KNOWN_BEFORE_ENTREGA } : kept as { chosen?: unknown; known?: unknown };
    if (!Array.isArray(saved?.chosen)) return;
    const known = Array.isArray(saved.known) ? saved.known : HOME_CALENDAR_TYPES;
    const added = DEFAULT_HOME_CALENDAR_TYPES.filter(type => !known.includes(type));
    set([...saved.chosen.filter(isType), ...added]);
  })
  .catch(() => undefined);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The kinds of events the Home's Calendar notice shows on this phone. */
export function useHomeCalendarTypes() {
  return useSyncExternalStore(subscribe, () => chosen, () => chosen);
}

export function setHomeCalendarTypes(types: HomeCalendarType[]) {
  set(types);
  AsyncStorage.setItem(KEY, JSON.stringify({ chosen, known: HOME_CALENDAR_TYPES })).catch(() => undefined);
}

/**
 * The kind an event counts as. Older events have other spellings or no type
 * at all: an "Evaluación …" that is not formativa counts as sumativa, and
 * whatever is not in the list is "Otro".
 */
export function homeCalendarType(event: Pick<CalendarEvent, 'eventType'>): HomeCalendarType {
  const type = event.eventType?.trim() ?? '';
  const known = HOME_CALENDAR_TYPES.find(item => item.toLocaleLowerCase('es') === type.toLocaleLowerCase('es'));
  if (known) return known;
  // i18n-ignore-next-line
  if (type.toLocaleLowerCase('es').startsWith('evaluaci')) return 'Evaluación sumativa';
  return 'Otro'; // i18n-ignore
}
