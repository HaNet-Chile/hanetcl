import { httpsCallable } from 'firebase/functions';
import { doorFunctions, functions } from './firebase';

// The door (validateTicket, checkInEventAttendee) runs in Santiago, next to
// the database, so each scan answers in a fraction of the time it took from
// Iowa. If the Santiago copy isn't there (not published yet, or a regional
// outage), the same call goes to Iowa.

let santiago = true;

function missing(error: unknown) {
  const code = (error as { code?: string })?.code ?? '';
  return code === 'functions/not-found' || code === 'functions/internal' || code === 'functions/unavailable';
}

export async function doorCall<In, Out>(name: string, input: In): Promise<Out> {
  if (santiago) {
    try {
      return (await httpsCallable<In, Out>(doorFunctions, name, { timeout: 15_000 })(input)).data;
    } catch (error) {
      if (!missing(error)) throw error;
      santiago = false;
    }
  }
  return (await httpsCallable<In, Out>(functions, name)(input)).data;
}

/**
 * Wakes the door's function when the scanner opens and leaves who scans and
 * the event ready on the server, so the first scan is as fast as the rest.
 * Answers the count so far; never throws.
 */
export async function warmDoor<Out>(name: string, input: Record<string, unknown>): Promise<Out | null> {
  try {
    return await doorCall<Record<string, unknown>, Out>(name, { ...input, warm: true });
  } catch {
    return null;
  }
}
