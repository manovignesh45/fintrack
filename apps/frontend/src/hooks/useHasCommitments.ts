import { useEffect, useState } from 'react';
import { commitmentsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLedgers } from '../context/LedgerContext';
import { subscribeCacheInvalidation } from './useCachedList';

export function useHasCommitments() {
  const { isAuthenticated } = useAuth();
  const { activeLedgerId } = useLedgers();
  const [hasCommitments, setHasCommitments] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !activeLedgerId) {
      return;
    }

    let cancelled = false;

    const check = () => {
      commitmentsApi
        .list()
        .then((res) => {
          if (!cancelled) {
            setHasCommitments(Boolean(res?.items && res.items.length > 0));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHasCommitments(false);
          }
        });
    };

    check();

    const unsub = subscribeCacheInvalidation((prefix) => {
      if (prefix.startsWith('commitments')) {
        check();
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [isAuthenticated, activeLedgerId]);

  return isAuthenticated && activeLedgerId ? hasCommitments : false;
}
