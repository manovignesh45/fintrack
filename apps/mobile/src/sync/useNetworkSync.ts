import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import { syncPendingTransactions } from './syncEngine';
import { syncQueue } from '@/src/db/transactionRepo';
import { useSyncStore } from '@/src/store/syncStore';

export function useNetworkSync() {
  const db = useSQLiteContext();
  const { setIsSyncing, setPendingCount, setLastSyncAt, setSyncError, setTriggerSync } = useSyncStore();
  const isSyncingRef = useRef(false);

  const triggerSync = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await syncPendingTransactions(db);
      if (result.failed > 0) {
        setSyncError(`${result.failed} transaction(s) failed to sync`);
      }
      setPendingCount(result.remaining);
      setLastSyncAt(new Date());
    } catch {
      setSyncError('Sync failed');
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  const refreshPendingCount = async () => {
    const count = await syncQueue.countPending(db);
    setPendingCount(count);
  };

  useEffect(() => {
    // Register triggerSync in store so any component can call it without re-registering listeners
    setTriggerSync(triggerSync);

    // Refresh count on mount
    refreshPendingCount();

    // Listen for network reconnection
    const unsubNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        triggerSync();
      } else {
        refreshPendingCount();
      }
    });

    // Sync when app comes to foreground
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        triggerSync();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      unsubNetInfo();
      appStateSub.remove();
    };
  }, []);

  return { triggerSync, refreshPendingCount };
}
