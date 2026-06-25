import { create } from 'zustand';

interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncError: string | null;
  // Set by useNetworkSync on mount so any component can trigger a sync
  triggerSync: (() => Promise<void>) | null;
  setIsSyncing: (v: boolean) => void;
  setPendingCount: (n: number) => void;
  setLastSyncAt: (d: Date) => void;
  setSyncError: (e: string | null) => void;
  setTriggerSync: (fn: () => Promise<void>) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  syncError: null,
  triggerSync: null,
  setIsSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (n) => set({ pendingCount: n }),
  setLastSyncAt: (d) => set({ lastSyncAt: d }),
  setSyncError: (e) => set({ syncError: e }),
  setTriggerSync: (fn) => set({ triggerSync: fn }),
}));
