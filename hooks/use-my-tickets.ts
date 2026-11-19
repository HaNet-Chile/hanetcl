import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useCached } from '@/services/cache';
import { useSession } from '@/services/auth-service';
import { TICKETS_CACHE_KEY, listMyTickets } from '@/services/tickets-service';
import type { Ticket } from '@/services/tickets-service';

/**
 * The account's tickets: what the phone kept shows at once and each visit
 * reloads them behind it. `tickets` is undefined until something is known.
 */
export function useMyTickets() {
  const { user } = useSession();
  const kept = useCached<{ tickets: Ticket[] }>(user ? TICKETS_CACHE_KEY : null);
  const [loaded, setLoaded] = useState<{ uid: string; tickets: Ticket[] } | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    if (!user) return () => undefined;
    let active = true;
    listMyTickets()
      .then(tickets => {
        if (!active) return;
        setLoaded({ uid: user.uid, tickets });
        setFailed(false);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [user]);

  useFocusEffect(reload);

  const tickets = loaded && loaded.uid === user?.uid ? loaded.tickets : kept?.tickets;
  return { tickets, failed, reload };
}
