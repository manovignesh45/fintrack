import { useState, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import type { Account, Category } from '@fintrack/shared';
import { accountsApi, categoriesApi } from '@/src/api/client';
import { accountRepo, categoryRepo } from '@/src/db/referenceDataRepo';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function isCacheStale(syncedAt: Date | null): boolean {
  if (!syncedAt) return true;
  return Date.now() - syncedAt.getTime() > CACHE_TTL_MS;
}

export function useReferenceData() {
  const db = useSQLiteContext();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // 1. Immediately serve from SQLite cache (works offline)
      const cachedAccounts = await accountRepo.getAll(db);
      const cachedCategories = await categoryRepo.getAll(db);

      if (!cancelled) {
        setAccounts(cachedAccounts);
        setCategories(cachedCategories);
      }

      // 2. Background-refresh if online and cache is stale
      const [accountsSyncedAt, catSyncedAt] = await Promise.all([
        accountRepo.getSyncedAt(db),
        categoryRepo.getSyncedAt(db),
      ]);

      const stale = isCacheStale(accountsSyncedAt) || isCacheStale(catSyncedAt);
      if (!cancelled) setIsStale(stale);

      if (!stale) return;

      const netState = await NetInfo.fetch();
      if (!netState.isConnected) return;

      try {
        const [freshAccounts, freshCategories] = await Promise.all([
          accountsApi.list(),
          categoriesApi.list(),
        ]);

        await Promise.all([
          accountRepo.upsertAll(db, freshAccounts ?? []),
          categoryRepo.upsertAll(db, freshCategories ?? []),
        ]);

        if (!cancelled) {
          setAccounts(freshAccounts ?? []);
          setCategories(freshCategories ?? []);
          setIsStale(false);
        }
      } catch {
        // Network fetch failed — keep stale cache, no crash
      }
    };

    load();
    return () => { cancelled = true; };
  }, [db]);

  return { accounts, categories, isStale };
}
