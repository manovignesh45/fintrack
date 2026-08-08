import { useCallback, useEffect, useState } from 'react';

// Module-level cache so data fetched on a page survives that page's
// unmount/remount when React Router navigates away and back, letting the
// next visit render instantly instead of flashing a loading state.
const cache = new Map<string, unknown>();

// Drop every cached entry whose key starts with `prefix`, so a write on one
// page (e.g. paying a commitment, which also creates a transaction) doesn't
// leave another page rendering stale data from its own cache key.
export function invalidateCache(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function useCachedList<T>(key: string, fetcher: () => Promise<T | null | undefined>, fallback: T) {
  const [data, setData] = useState<T>(() => (cache.has(key) ? (cache.get(key) as T) : fallback));
  const [loading, setLoading] = useState(() => !cache.has(key));

  const reload = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    return fetcher()
      .then((result) => {
        const value = result ?? fallback;
        cache.set(key, value);
        setData(value);
        return value;
      })
      .catch(() => {
        if (!cache.has(key)) setData(fallback);
      })
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    reload(!cache.has(key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, setData, loading, reload } as const;
}
