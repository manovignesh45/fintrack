import { useEffect, useState } from 'react';
import { commitmentsApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useLedgers } from '@/src/context/LedgerContext';

type CommitmentsListener = () => void;
const listeners = new Set<CommitmentsListener>();

export function subscribeCommitmentsChange(listener: CommitmentsListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyCommitmentsChanged() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error('Error notifying commitments listener', e);
    }
  }
}

export function useHasCommitments() {
  const { isAuthenticated } = useAuth();
  const { activeLedgerId } = useLedgers();
  const [hasCommitments, setHasCommitments] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !activeLedgerId) {
      setHasCommitments(false);
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

    const unsub = subscribeCommitmentsChange(check);

    return () => {
      cancelled = true;
      unsub();
    };
  }, [isAuthenticated, activeLedgerId]);

  return isAuthenticated && activeLedgerId ? hasCommitments : false;
}
