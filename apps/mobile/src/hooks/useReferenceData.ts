import { useState, useEffect } from 'react';
import type { Account, Category } from '@fintrack/shared';
import { accountsApi, categoriesApi } from '@/src/api/client';

export function useReferenceData() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [freshAccounts, freshCategories] = await Promise.all([
          accountsApi.list(),
          categoriesApi.list(),
        ]);

        if (!cancelled) {
          setAccounts(freshAccounts ?? []);
          setCategories(freshCategories ?? []);
        }
      } catch {
        // Network fetch failed
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return { accounts, categories, isStale: false };
}
