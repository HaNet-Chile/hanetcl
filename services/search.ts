import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { claimedCourse, useRole, useSession } from './auth-service';
import { peekCached, putCached, restoreCached, watchCached } from './cache';
import { listMyHalls } from './classhall-service';
import type { Hall } from './classhall-service';
import { eventWhen, listEvents } from './events-service';
import type { EventList } from './events-service';
import { listFeed } from './feed-service';
import type { Feed } from './feed-service';
import { fetchCalendarEvents, restoreCalendarEvents } from './ical-service';
import type { CalendarEvent } from './ical-service';
import { HALL_PLANS } from '@/constants/subjects';
import { capitalize, monthsShort, t, weekdaysShort } from '@/i18n';

// The Home's search. It looks through what the phone already has of this
// account (the sections of the app, its classes, the course's Calendar, the
// events and the feed), so it answers while typing, works without internet
// and asks the backend for nothing new. It never finds people.

type IconName = keyof typeof Ionicons.glyphMap;

export type SearchKind = 'section' | 'hall' | 'calendar' | 'event' | 'post';

export type SearchItem = {
  key: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  /** Other words it answers to; never shown. */
  keywords?: string;
  icon: IconName;
  href: Href;
  /** When it happens, for what has a date: what comes first goes first. */
  at?: number;
};

export type SearchGroup = { kind: SearchKind; label: string; items: SearchItem[] };

/** The order of the groups in the results, and their titles. */
const GROUPS: { kind: SearchKind; label: string }[] = [
  { kind: 'section', label: t('services.search.enHanet') },
  { kind: 'hall', label: t('services.search.tusClases') },
  { kind: 'calendar', label: 'Calendar' },
  { kind: 'event', label: t('layout.eventos') },
  { kind: 'post', label: t('layout.feed') },
];

const PER_GROUP = 5;
const DAY = 86_400_000;

/** Lower case and without accents, so "matematica" finds "Matemática". */
export function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('es');
}

type Section = Omit<SearchItem, 'kind' | 'key'> & { key: string; only?: 'student' | 'hnt' };

const sections = (): Section[] => [
  { key: 'calendar', title: 'Calendar', subtitle: t('services.search.laAgendaDeTuCurso'), keywords: t('services.search.calendarioAgendaPruebasEvaluacionesTareas'), icon: 'calendar-outline', href: '/calendar' },
  { key: 'schedule', title: t('common.horario'), subtitle: t('services.search.tusClasesDeLaSemana'), keywords: t('services.search.bloquesRecreoAlmuerzoClasesHora'), icon: 'time-outline', href: '/schedule' },
  { key: 'classhall', title: 'ClassHall', subtitle: t('services.search.tusClasesTareasYMateriales'), keywords: t('services.search.clasesAsignaturasRamosMateriasHall'), icon: 'school-outline', href: '/classhall' },
  { key: 'grades', title: t('classhall.evaluation.notas'), subtitle: t('services.search.tusCalificacionesYPromedios'), keywords: t('services.search.calificacionesPromedioSemestreDestaparRaspar'), icon: 'ribbon-outline', href: '/grades', only: 'student' },
  { key: 'events', title: t('layout.eventos'), subtitle: t('services.search.enTuInstitucionYCerca'), keywords: t('services.search.panoramasCiudadEntradasConciertosActividades'), icon: 'sparkles-outline', href: '/events' },
  { key: 'feed', title: t('layout.feed'), subtitle: t('services.search.comunicadosDeTuInstitucion'), keywords: t('services.search.comunidadAvisosPublicacionesVotacionesNoticias'), icon: 'chatbubble-outline', href: '/feed' },
  { key: 'anniversary', title: t('common.aniversario'), subtitle: t('services.search.alianzasActividadesYPuntos'), keywords: t('services.search.alianzasMarcadorPuntajeSemana'), icon: 'trophy-outline', href: '/anniversary' },
  { key: 'tools', title: t('common.herramientas'), subtitle: t('services.search.recursosParaTuAnoEscolar'), keywords: t('services.search.utilidadesRecursos'), icon: 'construct-outline', href: '/tools' },
  { key: 'scale', title: t('tools.scale.escalaDeNotas'), subtitle: t('services.search.dePuntosANota'), keywords: t('services.search.puntajeExigenciaTablaConversion'), icon: 'stats-chart-outline', href: '/tools/scale' },
  { key: 'calculator', title: t('tools.grades.calculadoraDeNotas'), subtitle: t('services.search.tuPromedioYCuantoNecesitas'), keywords: t('services.search.promedioCalcularPonderacionExamen'), icon: 'calculator-outline', href: '/tools/grades' },
  { key: 'electividad', title: t('tools.electividad.hanetElectividad'), subtitle: t('services.search.testDeInteresesParaElegir'), keywords: t('services.search.electivosTestVocacionalInteresesAreas'), icon: 'compass-outline', href: '/tools/electividad', only: 'student' },
  { key: 'notifications', title: t('components.notifications.notificationsPanel.notificaciones'), subtitle: t('services.search.loUltimoQueTeLlego'), keywords: t('services.search.avisosPush'), icon: 'notifications-outline', href: { pathname: '/', params: { abrir: 'notificaciones' } } },
  { key: 'profile', title: t('layout.perfil'), subtitle: t('services.search.tuHanetIdYTu'), keywords: t('services.search.cuentaQrCodigoFotoBlobatar'), icon: 'person-outline', href: '/explore' },
  { key: 'settings', title: t('common.configuraciones'), subtitle: t('services.search.notificacionesPrivacidadEIconoDe'), keywords: t('services.search.ajustesOpcionesCerrarSesionPrivacidad'), icon: 'settings-outline', href: '/settings' },
  { key: 'whats-new', title: t('settings.novedades'), subtitle: t('services.search.queCambioEnCadaVersion'), keywords: t('services.search.versionCambiosActualizacion'), icon: 'megaphone-outline', href: '/whats-new' },
  { key: 'hnt', title: t('index.panelHnt'), subtitle: t('services.search.institucionesPersonasYRoles'), keywords: t('services.search.administracionEquipo'), icon: 'shield-checkmark-outline', href: '/hnt-admin', only: 'hnt' },
];

const STAFF = ['Profesor', 'Admin', 'HNT']; // i18n-ignore

/** "Lun 17 nov.", with "Hoy" and "Mañana" for the days at hand. */
function dayLabel(date: Date, now: number) {
  const today = new Date(now).setHours(0, 0, 0, 0);
  const days = Math.round((new Date(date).setHours(0, 0, 0, 0) - today) / DAY);
  if (days === 0) return t('common.hoy2');
  if (days === 1) return t('common.manana');
  return `${capitalize(weekdaysShort()[date.getDay()])} ${date.getDate()} ${monthsShort()[date.getMonth()]}.`;
}

/** The first line of a post, without its Markdown marks. */
function firstLine(body: string) {
  const line = body.split('\n').find(text => text.trim()) ?? '';
  return line.replace(/[#*_`>~]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
}

export type SearchSources = {
  role: string | null;
  halls?: Hall[];
  calendar?: CalendarEvent[];
  institutionEvents?: EventList;
  regionalEvents?: EventList;
  feed?: Feed;
};

/** Everything the search can find for this account, from what is loaded. */
export function buildSearchIndex({ role, halls, calendar, institutionEvents, regionalEvents, feed }: SearchSources, now = Date.now()): SearchItem[] {
  const student = !!role && !STAFF.includes(role);
  const items: SearchItem[] = sections()
    .filter(section => !section.only || (section.only === 'student' ? student : role === 'HNT'))
    .map(({ only, ...section }) => ({ ...section, key: `section:${section.key}`, kind: 'section' as const }));

  for (const hall of halls ?? []) {
    items.push({
      key: `hall:${hall.id}`,
      kind: 'hall',
      title: hall.subject,
      subtitle: [hall.isTeacher ? hall.courseId : hall.teacherName, hall.plan === 'comun' ? '' : HALL_PLANS.find(plan => plan.value === hall.plan)?.label].filter(Boolean).join(' · '),
      keywords: `${hall.teacherName} ${hall.courseId}`,
      icon: 'school-outline',
      href: { pathname: '/classhall/hall', params: { id: hall.id } },
    });
  }

  // What already happened stays findable for a month ("¿cuándo fue la prueba?").
  for (const event of calendar ?? []) {
    if (event.cancelled || event.endDate.getTime() < now - 30 * DAY) continue;
    items.push({
      key: `calendar:${event.id}`,
      kind: 'calendar',
      title: event.title,
      subtitle: [dayLabel(event.startDate, now), event.subject, event.eventType].filter(Boolean).join(' · '),
      keywords: event.description,
      icon: event.taskId ? 'document-text-outline' : 'calendar-outline',
      href: { pathname: '/event-info', params: { id: event.id, canEdit: '0' } },
      at: event.startDate.getTime(),
    });
  }

  for (const event of [...(institutionEvents?.events ?? []), ...(regionalEvents?.events ?? [])]) {
    if ((event.endsAt ?? event.startsAt) < now) continue;
    items.push({
      key: `event:${event.id}`,
      kind: 'event',
      title: event.title,
      subtitle: [capitalize(eventWhen(event)), event.venueName || event.city].filter(Boolean).join(' · '),
      keywords: `${event.category} ${event.city} ${event.description}`,
      icon: 'sparkles-outline',
      href: { pathname: '/event-detail', params: { id: event.id } },
      at: event.startsAt,
    });
  }

  for (const post of feed?.posts ?? []) {
    const title = firstLine(post.body) || (post.event && !post.event.missing ? post.event.title : '') || post.poll?.options.map(option => option.text).join(' / ') || '';
    if (!title) continue;
    items.push({
      key: `post:${post.id}`,
      kind: 'post',
      title,
      subtitle: [post.space.name, post.createdAt ? dayLabel(new Date(post.createdAt), now) : ''].filter(Boolean).join(' · '),
      keywords: `${post.body} ${post.tags.join(' ')}`,
      icon: 'chatbubble-outline',
      href: { pathname: '/feed', params: { post: post.id } },
      at: post.createdAt ?? undefined,
    });
  }

  return items;
}

/**
 * How well an item answers the words typed: every word has to be somewhere
 * in it, and a title that starts with them beats one that only holds them,
 * which beats a match in the words nobody sees.
 */
function score(item: SearchItem, words: string[]) {
  const title = fold(item.title);
  const subtitle = fold(item.subtitle ?? '');
  const keywords = fold(item.keywords ?? '');
  let total = 0;
  for (const word of words) {
    if (title.startsWith(word)) total += 8;
    else if (title.includes(` ${word}`)) total += 6;
    else if (title.includes(word)) total += 4;
    else if (subtitle.includes(word)) total += 2;
    else if (keywords.includes(word)) total += 1;
    else return 0;
  }
  return total;
}

/** The results for what was typed, grouped; `top` is what Enter opens. */
export function searchIndex(index: SearchItem[], query: string, now = Date.now()): { groups: SearchGroup[]; top: SearchItem | null } {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return { groups: [], top: null };

  // Among equals, what comes next goes before what is further away or past.
  const distance = (item: SearchItem) => (item.at === undefined ? 0 : item.at >= now ? item.at - now : (now - item.at) + 365 * DAY);
  const ranked = index
    .map(item => ({ item, value: score(item, words) }))
    .filter(entry => entry.value > 0)
    .sort((a, b) => b.value - a.value || distance(a.item) - distance(b.item));

  // The group with the best answer goes first, so what Enter opens is on top.
  const best = (kind: SearchKind) => ranked.find(entry => entry.item.kind === kind)?.value ?? 0;
  const groups = GROUPS
    .map(group => ({ ...group, items: ranked.filter(entry => entry.item.kind === group.kind).slice(0, PER_GROUP).map(entry => entry.item) }))
    .filter(group => group.items.length > 0)
    .sort((a, b) => best(b.kind) - best(a.kind));
  return { groups, top: groups[0]?.items[0] ?? null };
}

/** The parts of a title, with the ones that match what was typed marked. */
export function matchParts(title: string, query: string): { text: string; match: boolean }[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [{ text: title, match: false }];
  // Folding keeps the length of each letter, so positions carry over.
  const folded = fold(title);
  if (folded.length !== title.length) return [{ text: title, match: false }];
  const marks = new Array<boolean>(title.length).fill(false);
  for (const word of words) {
    let from = folded.indexOf(word);
    while (from !== -1) {
      for (let index = from; index < from + word.length; index += 1) marks[index] = true;
      from = folded.indexOf(word, from + word.length);
    }
  }
  const parts: { text: string; match: boolean }[] = [];
  for (let index = 0; index < title.length; index += 1) {
    const last = parts[parts.length - 1];
    if (last && last.match === marks[index]) last.text += title[index];
    else parts.push({ text: title[index], match: marks[index] });
  }
  return parts;
}

/**
 * What the search recommends while nothing is typed: what this account has
 * coming (its next evaluation, an event), its classes and a couple of tools.
 * All of it is real and opens from the search.
 */
export function suggestionsFrom(index: SearchItem[], now = Date.now(), limit = 6): SearchItem[] {
  const upcoming = (kind: SearchKind) => index.filter(item => item.kind === kind && (item.at ?? 0) >= now).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  const section = (key: string) => index.find(item => item.key === `section:${key}`);
  const halls = index.filter(item => item.kind === 'hall');
  const picks = [
    upcoming('calendar')[0],
    halls[0],
    upcoming('event')[0],
    section('schedule'),
    halls[1],
    section('scale'),
    upcoming('calendar')[1],
    section('calculator'),
    section('electividad'),
    section('whats-new'),
  ].filter((item): item is SearchItem => !!item);
  return picks.filter((item, position) => picks.findIndex(other => other.title === item.title) === position).slice(0, limit);
}

const LIST_KEYS = ['halls', 'events:institution', 'events:regional', 'feed'] as const;
type Kept = { uid: string; courseId?: string | null; calendar?: CalendarEvent[]; halls?: { halls: Hall[] }; 'events:institution'?: EventList; 'events:regional'?: EventList; feed?: Feed };

/** The longest text that fits the Home's pill beside the app's name. */
const PILL_LENGTH = 22;

/** The suggestions as the pill's lines: only the ones short enough to read whole. */
export function pillSuggestions(index: SearchItem[], now = Date.now()) {
  return suggestionsFrom(index, now, 10).map(item => item.title).filter(title => title.length <= PILL_LENGTH).slice(0, 5);
}

/**
 * The index for the signed-in account, from the lists the phone keeps
 * (services/cache.ts): what it had right away, and each list again whenever a
 * load anywhere in the app replaces it. With `refresh` it also asks for them
 * itself; a load that fails just leaves that list as it was.
 */
export function useSearchIndex(refresh = false) {
  const { user } = useSession();
  const role = useRole();
  const uid = user?.uid ?? null;
  const [kept, setKept] = useState<Kept>({ uid: '' });
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!user) return;
    let active = true;
    let calendarKey = '';
    const put = (changes: Omit<Kept, 'uid'>) => {
      if (active) setKept(current => ({ ...(current.uid === user.uid ? current : {}), ...changes, uid: user.uid }));
    };
    const readCalendar = (courseId: string) => restoreCalendarEvents(courseId).then(events => { if (events) put({ calendar: events }); });

    for (const key of LIST_KEYS) void restoreCached(key).then(value => { if (value !== undefined) put({ [key]: value }); });
    void claimedCourse(user)
      .then(async courseId => {
        if (!courseId) return;
        calendarKey = `calendar:${courseId}`;
        await readCalendar(courseId);
        if (refresh) await fetchCalendarEvents(courseId);
      })
      .catch(() => undefined);
    if (refresh) {
      void listMyHalls().catch(() => undefined);
      void listEvents('institution').catch(() => undefined);
      void listEvents('regional').catch(() => undefined);
      void listFeed().catch(() => undefined);
    }

    const stop = watchCached(key => {
      if ((LIST_KEYS as readonly string[]).includes(key)) put({ [key]: peekCached(key) });
      else if (key === calendarKey) void readCalendar(key.slice('calendar:'.length));
    });
    return () => {
      active = false;
      stop();
    };
  }, [refresh, user]);

  const mine = uid && kept.uid === uid ? kept : null;
  const halls = mine?.halls?.halls;
  const calendar = mine?.calendar;
  const institutionEvents = mine?.['events:institution'];
  const regionalEvents = mine?.['events:regional'];
  const feed = mine?.feed;

  return useMemo(
    () => (uid ? buildSearchIndex({ role, halls, calendar, institutionEvents, regionalEvents, feed }, now) : []),
    [calendar, feed, halls, institutionEvents, now, regionalEvents, role, uid],
  );
}

// The last things searched, kept with the account's lists (services/cache.ts),
// so they leave the phone when the session ends.
const RECENT_KEY = 'search:recent';
const MAX_RECENT = 6;

export async function recentSearches() {
  return (await restoreCached<string[]>(RECENT_KEY)) ?? [];
}

export function rememberSearch(query: string, current: string[]) {
  const text = query.trim();
  if (text.length < 2) return current;
  const next = [text, ...current.filter(item => fold(item) !== fold(text))].slice(0, MAX_RECENT);
  putCached(RECENT_KEY, next);
  return next;
}

export function clearRecentSearches() {
  putCached<string[]>(RECENT_KEY, []);
  return [];
}

export const SEARCH_PLACEHOLDER = t('services.search.buscarEnHanet');
