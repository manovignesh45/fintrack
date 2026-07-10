import { useCallback, useEffect, useState } from 'react';

interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Full reload with the loading spinner. */
  reload: () => Promise<void>;
  /** Pull-to-refresh reload without the full-screen spinner. */
  refresh: () => Promise<void>;
  setData: (data: T) => void;
}

/**
 * Loads async data with distinct loading / refreshing / error states so screens
 * can tell "load failed" apart from "no data" instead of silently showing an
 * empty list on error.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (mode: 'load' | 'refresh') => {
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setData(await fetcher());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      mode === 'refresh' ? setRefreshing(false) : setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run('load');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => run('load'),
    refresh: () => run('refresh'),
    setData,
  };
}
