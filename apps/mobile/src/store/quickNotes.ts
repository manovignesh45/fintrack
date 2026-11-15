import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { QuickNote, QuickNoteInput } from '@fintrack/shared';
import { quickNotesApi } from '@/src/api/client';

const STORAGE_KEY = 'fintrack_quick_notes_pending';

/** A note captured on this device that the server has not confirmed yet. */
export interface PendingQuickNote extends QuickNoteInput {
  client_id: string;
  ledger_id: string;
}

interface QuickNotesState {
  ledgerId: string | null;
  /** Notes saved on the server for the active ledger. */
  notes: QuickNote[];
  /** Not-yet-uploaded notes for every ledger; kept on the device across restarts. */
  pending: PendingQuickNote[];
  loading: boolean;
  /** Why the last upload or load failed, if it did. */
  error: string | null;
  /** Switches to a ledger, uploads anything waiting and reloads its notes. */
  refresh: (ledgerId: string | null) => Promise<void>;
  /** Stores notes on the device first, then uploads, so nothing is lost offline. */
  add: (inputs: QuickNoteInput[]) => Promise<void>;
  removePending: (clientId: string) => Promise<void>;
  /** Drops a server note locally after it was converted or deleted. */
  removeNote: (id: number) => void;
}

let hydrated: Promise<void> | null = null;
let running: Promise<void> | null = null;
let rerun = false;

async function persist(pending: PendingQuickNote[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // The in-memory queue still uploads; only survival across a restart is lost.
  }
}

export const useQuickNotes = create<QuickNotesState>((set, get) => {
  const hydrate = () => {
    hydrated ??= AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const stored: PendingQuickNote[] = raw ? JSON.parse(raw) : [];
        // Anything captured before hydration finished stays at the end.
        if (Array.isArray(stored) && stored.length) set((s) => ({ pending: [...stored, ...s.pending] }));
      })
      .catch(() => {});
    return hydrated;
  };

  /** Uploads the active ledger's queue (if any) and loads its notes. */
  const syncOnce = async () => {
    await hydrate();
    const ledgerId = get().ledgerId;
    if (!ledgerId) return;
    const batch = get().pending.filter((p) => p.ledger_id === ledgerId);
    try {
      const notes = batch.length
        ? await quickNotesApi.create(batch.map(({ ledger_id: _ledger, ...note }) => note))
        : await quickNotesApi.list();
      if (get().ledgerId !== ledgerId) return; // ledger switched mid-request
      const sent = new Set(batch.map((p) => p.client_id));
      const pending = get().pending.filter((p) => !sent.has(p.client_id));
      set({ notes: notes ?? [], pending, error: null });
      if (batch.length) await persist(pending);
    } catch (err) {
      // Pending notes stay queued; the server ignores a repeated client_id, so retrying is safe.
      if (get().ledgerId === ledgerId) set({ error: err instanceof Error ? err.message : 'Could not reach the server' });
    }
  };

  /** Runs syncs one at a time; a request made mid-sync triggers one more pass. */
  const sync = (): Promise<void> => {
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      set({ loading: true });
      try {
        do {
          rerun = false;
          await syncOnce();
        } while (rerun);
      } finally {
        running = null;
        set({ loading: false });
      }
    })();
    return running;
  };

  return {
    ledgerId: null,
    notes: [],
    pending: [],
    loading: false,
    error: null,

    refresh: async (ledgerId) => {
      if (get().ledgerId !== ledgerId) set({ ledgerId, notes: [], error: null });
      await sync();
    },

    add: async (inputs) => {
      const ledgerId = get().ledgerId;
      if (!ledgerId || inputs.length === 0) return;
      await hydrate();
      const queued = inputs.map((n) => ({ ...n, client_id: Crypto.randomUUID(), ledger_id: ledgerId }));
      const pending = [...get().pending, ...queued];
      set({ pending });
      await persist(pending);
      await sync();
    },

    removePending: async (clientId) => {
      const pending = get().pending.filter((p) => p.client_id !== clientId);
      set({ pending });
      await persist(pending);
    },

    removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
  };
});

/** Count and rupee total of everything still waiting to be turned into transactions. */
export function useQuickNotesSummary() {
  const ledgerId = useQuickNotes((s) => s.ledgerId);
  const notes = useQuickNotes((s) => s.notes);
  const pending = useQuickNotes((s) => s.pending);
  const mine = pending.filter((p) => p.ledger_id === ledgerId);
  return {
    count: notes.length + mine.length,
    total: [...notes, ...mine].reduce((sum, n) => sum + n.amount, 0),
  };
}
