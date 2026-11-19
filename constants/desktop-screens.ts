// Every screen of the app and how it is drawn on a wide web window (beside
// the side navigation). `npm run desktop:check` keeps this list honest: it
// fails if a screen in app/ is missing here, if a page marked with a desktop
// layout doesn't use one, or if a sheet isn't opened as a sheet. A new screen
// enters this list in the same PR.
//
// Layouts:
// - wide: a page with columns or a grid, built with components/ui/wide-page.tsx.
// - reading: one centered column to read top to bottom (a list, a post, a form).
// - custom: its own desktop layout (the Home, ClassHall, the Hall, the search).
// - sheet: a form or detail opened as a sheet; on a wide window SheetFrame
//   draws it as a centered card, so it needs nothing of its own.
// - full: a full-screen moment, without the side navigation.
// - entry: the way in (welcome, sign-in, joining an institution), without the
//   side navigation.
// - native: not on the web.
// - none: never shown (the center tab, whose press opens the section's action).
// - todo: still the phone's column on a wide window.
//
// `via` names the file that holds the layout when the screen only renders a
// shared component. One screen per line, so the check can read it.

export type DesktopLayout = 'wide' | 'reading' | 'custom' | 'sheet' | 'full' | 'entry' | 'native' | 'none' | 'todo';

export type DesktopScreen = { layout: DesktopLayout; via?: string };

export const DESKTOP_SCREENS: Record<string, DesktopScreen> = {
  // Tabs
  '(tabs)/index': { layout: 'custom' },
  '(tabs)/calendar': { layout: 'wide', via: 'components/calendar/MonthYearViews.tsx' },
  '(tabs)/events': { layout: 'wide' },
  '(tabs)/feed': { layout: 'reading', via: 'components/feed/feed-screen.tsx' },
  '(tabs)/explore': { layout: 'wide' },
  '(tabs)/center': { layout: 'none' },

  // The way in
  'onboarding': { layout: 'entry' },
  'auth': { layout: 'entry' },
  'verify-email': { layout: 'entry' },
  'join-beta': { layout: 'entry' },
  'link-institution': { layout: 'entry' },

  // Calendar, Horario and events
  'schedule': { layout: 'wide', via: 'components/schedule/schedule-view.tsx' },
  'event-info': { layout: 'reading' },
  'create-event': { layout: 'sheet' },
  'day-change': { layout: 'sheet' },
  'event-detail': { layout: 'wide' },
  'event-form': { layout: 'sheet' },
  'event-options': { layout: 'sheet' },
  'event-checkin': { layout: 'full' },

  // Entradas
  'tickets/index': { layout: 'reading' },
  'tickets/detail': { layout: 'sheet' },
  'tickets/validated': { layout: 'full' },
  'tickets/arrival': { layout: 'full' },
  'tickets/receive': { layout: 'full' },
  'tickets/scan': { layout: 'full' },
  'feed-post': { layout: 'sheet' },
  'search': { layout: 'custom' },

  // ClassHall
  'classhall/index': { layout: 'custom' },
  'classhall/hall': { layout: 'custom' },
  'classhall/evaluation': { layout: 'wide' },
  'classhall/tasks': { layout: 'reading' },
  'classhall/task': { layout: 'wide' },
  'classhall/join': { layout: 'sheet' },
  'classhall/create': { layout: 'sheet' },
  'classhall/announce': { layout: 'sheet' },
  'classhall/evaluation-new': { layout: 'sheet' },
  'classhall/evaluation-form': { layout: 'sheet' },
  'classhall/grades': { layout: 'sheet' },
  'classhall/task-form': { layout: 'sheet' },
  'classhall/submit': { layout: 'sheet' },
  'classhall/submission': { layout: 'sheet' },

  // Notas
  'grades/index': { layout: 'wide' },
  'grades/subject': { layout: 'wide' },
  'grades/reveal': { layout: 'full' },

  // Aniversario
  'anniversary/index': { layout: 'wide' },
  'anniversary/activities': { layout: 'wide' },
  'anniversary/notices': { layout: 'reading', via: 'components/feed/feed-screen.tsx' },
  'anniversary/welcome': { layout: 'full' },
  'anniversary/setup': { layout: 'sheet' },
  'anniversary/activity': { layout: 'sheet' },
  'anniversary/detail': { layout: 'sheet' },
  'anniversary/result': { layout: 'sheet' },
  'anniversary/points': { layout: 'sheet' },
  'anniversary/deadline': { layout: 'sheet' },
  'anniversary/flash': { layout: 'sheet' },
  'anniversary/leads': { layout: 'sheet' },
  'anniversary/score': { layout: 'sheet' },

  // Herramientas
  // Organizar (Admin, CEE, HNT)
  'organize/index': { layout: 'wide' },
  'organize/events': { layout: 'reading' },
  'organize/event': { layout: 'wide' },
  'organize/tickets': { layout: 'reading' },
  'organize/new': { layout: 'sheet' },
  'organize/issue': { layout: 'sheet' },
  'organize/send': { layout: 'sheet' },
  'organize/scanners': { layout: 'sheet' },
  'organize/leads': { layout: 'sheet' },

  'tools/index': { layout: 'wide' },
  'tools/scale': { layout: 'wide' },
  'tools/grades': { layout: 'wide' },
  'tools/electividad/index': { layout: 'reading' },
  'tools/electividad/test': { layout: 'full' },
  'tools/electividad/reveal': { layout: 'full' },
  'tools/electividad/result': { layout: 'wide' },
  'tools/verbs/index': { layout: 'wide' },
  'tools/verbs/pick': { layout: 'reading' },
  'tools/verbs/play': { layout: 'full' },

  // Profile and Configuraciones
  'settings': { layout: 'wide' },
  'edit-profile': { layout: 'sheet' },
  'whats-new': { layout: 'reading' },
  'security': { layout: 'reading' },
  'licenses': { layout: 'reading' },
  'hnt-admin': { layout: 'reading' },
  'ui-showcase': { layout: 'reading' },
  'share': { layout: 'native' },
};

/** The URL of a screen's file: "(tabs)/index" is "/", "tools/index" is "/tools". */
export function screenPath(screen: string) {
  const path = screen.replace(/^\(tabs\)\//, '').replace(/(^|\/)index$/, '');
  return `/${path}`;
}

/** Screens drawn without the side navigation: the way in and the full-screen moments. */
export const NO_SIDE_NAV_ROUTES = Object.entries(DESKTOP_SCREENS)
  .filter(([, screen]) => screen.layout === 'full' || screen.layout === 'entry')
  .map(([screen]) => screenPath(screen));
