import type { GiftPreview, Ticket, TicketEvent } from '@/services/tickets-service';

// Made-up tickets for Sistema HaNet UI: the ticket screens open with
// `?demo=1` (arrival takes how many, `?demo=5`) so their animations can be
// tried without a real event. Nothing here reaches the backend.

export const DEMO_EVENT: TicketEvent = {
  id: 'ejemplo',
  institutionName: 'Liceo de ejemplo',
  title: 'Velada de Aniversario',
  startsAt: new Date(2027, 6, 8, 19, 0).getTime(),
  endsAt: null,
  venueName: 'Gimnasio',
  address: 'Entrada por calle Montt',
  city: '',
  imageUrl: null,
  palette: ['#EF2274'],
  authorName: 'Centro de Estudiantes',
  cap: 300,
  giftable: true,
  printable: true,
  style: 'simple',
  note: 'Trae tu credencial',
};

export function demoTickets(count = 1, event: TicketEvent = DEMO_EVENT): Ticket[] {
  return Array.from({ length: Math.max(1, Math.min(count, 20)) }, (_, index) => ({
    id: `demo-${index + 1}`,
    eventId: event.id,
    number: 141 + index,
    holderName: 'Tu nombre',
    courseId: '3° Medio B',
    status: 'active',
    giftedFromName: '',
    giftedToName: '',
    issuedAt: null,
    usedAt: null,
    linkExpiresAt: null,
    receivedAt: null,
    event,
  }));
}

/** A made-up QR that changes every 30 s, like the real one. */
export function demoQr(now = Date.now()) {
  const step = Math.floor(now / 30_000);
  return `hanet://ticket/demo?c=${(step * 2654435761 % 0xffffffffff).toString(16).padStart(10, '0')}`;
}

export function demoGiftPreview(): GiftPreview {
  const { event, ...ticket } = demoTickets(1)[0];
  return {
    ticket: { ...ticket, status: 'link', linkExpiresAt: Date.now() + 24 * 3600_000 },
    event,
    fromName: 'Martina R.',
    organizer: 'Centro de Estudiantes',
    mine: false,
  };
}

/** The `demo` search param as a count; 0 when the screen is real. */
export function demoCount(param: string | string[] | undefined) {
  const value = Number(Array.isArray(param) ? param[0] : param);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** What "Compartir como imagen" or "Descargar para imprimir" gets in the demo. */
export const DEMO_SHARE = { code: 'DEMO-2026', qr: 'hanet://t/DEMO-2026' };
