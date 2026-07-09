import 'react-native-gesture-handler';
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Gesture, GestureDetector, Directions, FlatList } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { transactionsApi, accountsApi } from '@/src/api/client';
import { transactionRepo } from '@/src/db/transactionRepo';
import { accountRepo } from '@/src/db/referenceDataRepo';
import { useAuth } from '@/src/context/AuthContext';
import { useSyncStore } from '@/src/store/syncStore';
import { SyncStatusBar } from '@/src/components/SyncStatusBar';
import TransactionFilter, { TransactionFilterRef } from '@/src/components/TransactionFilter';
import type { TxNature, FilterState } from '@fintrack/shared';
import type { LocalTransaction } from '@/src/db/localTypes';
import { DEFAULT_FILTERS, countActiveFilters, DATE_PRESET_LABELS } from '@fintrack/shared';

const natureColors: Record<TxNature, string> = {
  INCOME: 'text-green-600',
  EXPENSE: 'text-red-600',
  TRANSFER: 'text-blue-600 dark:text-blue-400',
  EMI_PAYMENT: 'text-orange-600',
  LOAN_DISBURSEMENT: 'text-green-800',
};

const natureLabels: Record<TxNature, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  EMI_PAYMENT: 'EMI Payment',
  LOAN_DISBURSEMENT: 'Loan Disbursement',
};

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const filterRef = useRef<TransactionFilterRef>(null);
  const router = useRouter();
  const db = useSQLiteContext();
  const { editMode, user } = useAuth();
  const { setPendingCount } = useSyncStore();

  const loadFromDb = useCallback(async (f: FilterState = filters) => {
    try {
      const data = await transactionRepo.getAll(db, f, user?.id);
      setTransactions(data);
      const pending = await transactionRepo.countPending(db);
      setPendingCount(pending);
    } catch {
      setTransactions([]);
    }
  }, [db, filters, user?.id]);

  // Silently reload from SQLite on focus (returning from add screen, switching tabs)
  // Does not touch loading state — spinner is controlled by the login effect below
  useFocusEffect(
    useCallback(() => {
      loadFromDb(filters);
    }, [filters, loadFromDb])
  );

  const seedTransactions = useCallback(async (serverTx: Awaited<ReturnType<typeof transactionsApi.list>>) => {
    if (!serverTx?.length) return;
    for (const tx of serverTx) {
      await db.runAsync(
        `INSERT OR IGNORE INTO transactions
          (id, local_id, user_id, title, amount, nature, source_account_id,
           target_account_id, sub_category_id, entity, payment_method, notes,
           principal_amount, interest_amount, transaction_date, created_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          tx.id, `server_${tx.id}`, tx.user_id, tx.title, tx.amount, tx.nature,
          tx.source_account_id, tx.target_account_id ?? null, tx.sub_category_id ?? null,
          tx.entity, tx.payment_method ?? null, tx.notes ?? null,
          tx.principal_amount, tx.interest_amount, tx.transaction_date, tx.created_at,
        ],
      );
    }
  }, [db]);

  // Pull-to-refresh: fetch filtered page from server → seed SQLite → reload list
  // Network calls happen BEFORE any DB writes to avoid holding a write lock during I/O
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const params: Record<string, string> = {};
      if (filters.entity) params.entity = filters.entity;
      if (filters.nature) params.nature = filters.nature;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.search) params.search = filters.search;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.sub_category_id) params.sub_category_id = filters.sub_category_id;

      const [serverTx, accts] = await Promise.all([
        transactionsApi.list(params),
        accountsApi.list(),
      ]);
      await seedTransactions(serverTx);
      if (accts) await accountRepo.upsertAll(db, accts);
    } catch {
      // Network unavailable — just reload from SQLite
    }

    const { syncPendingTransactions } = await import('@/src/sync/syncEngine');
    syncPendingTransactions(db).catch(() => {});

    await loadFromDb(filters);
    setRefreshing(false);
  }, [db, filters, loadFromDb, seedTransactions]);

  // On login: fetch ALL transactions (no date filter) + accounts, seed SQLite, then show list.
  // Separate from onRefresh because onRefresh uses current filters (date-limited).
  // Data was wiped on logout, so we need a full re-seed from the server here.
  useEffect(() => {
    if (!user?.id) return;
    const loginSync = async () => {
      setLoading(true);
      try {
        const [serverTx, accts] = await Promise.all([
          transactionsApi.list({}),
          accountsApi.list(),
        ]);
        await seedTransactions(serverTx);
        if (accts) await accountRepo.upsertAll(db, accts);
      } catch {
        // Network unavailable on login — show whatever is in SQLite
      }
      await loadFromDb(filters);
      setLoading(false);
    };
    loginSync();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (item: LocalTransaction) => {
    Alert.alert('Delete', 'Delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (item.id) {
              await transactionsApi.delete(item.id);
            }
            await transactionRepo.softDelete(db, item.local_id);
            await loadFromDb(filters);
          } catch {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  const summary = transactions.reduce(
    (acc, t) => {
      if (t.nature === 'INCOME' || t.nature === 'LOAN_DISBURSEMENT') acc.income += t.amount;
      else if (t.nature === 'EXPENSE' || t.nature === 'EMI_PAYMENT') acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const renderItem = ({ item: t }: { item: LocalTransaction }) => (
    <View className={`bg-white dark:bg-gray-800 rounded-lg border p-3 mb-2 mx-4 ${t.sync_status === 'failed' ? 'border-red-300' : 'border-gray-200 dark:border-gray-700'}`}>
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-1.5">
            <Text className="font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>{t.title}</Text>
            {t.sync_status === 'pending' && (
              <Ionicons name="time-outline" size={12} color="#9ca3af" />
            )}
            {t.sync_status === 'failed' && (
              <Ionicons name="alert-circle-outline" size={12} color="#ef4444" />
            )}
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {t.transaction_date} · {natureLabels[t.nature]} · {t.entity}
            {t.payment_method ? ` · ${t.payment_method}` : ''}
          </Text>
          {t.nature === 'EMI_PAYMENT' && (
            <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              P: ₹{t.principal_amount.toLocaleString('en-IN')} + I: ₹{t.interest_amount.toLocaleString('en-IN')}
            </Text>
          )}
          {t.sync_error ? (
            <Text className="text-xs text-red-500 mt-0.5">{t.sync_error}</Text>
          ) : t.notes ? (
            <Text className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t.notes}</Text>
          ) : null}
        </View>
        <View className="items-end">
          <Text className={`font-semibold ${natureColors[t.nature]}`}>
            {(t.nature === 'INCOME' || t.nature === 'LOAN_DISBURSEMENT') ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
          </Text>
          {editMode && (
            <View className="flex-row gap-2 mt-1">
              {t.id && (
                <TouchableOpacity onPress={() => router.push(`/edit/${t.id}`)}>
                  <Text className="text-xs text-blue-500">Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDelete(t)}>
                <Text className="text-xs text-red-500">Del</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const ListHeader = () => (
    <View className="px-4 pb-2">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Transactions</Text>
        <TransactionFilter ref={filterRef} filters={filters} onChange={setFilters} />
      </View>

      {countActiveFilters(filters) > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          {filters.entity ? <FilterPill label={filters.entity} onRemove={() => setFilters((f) => ({ ...f, entity: '' }))} /> : null}
          {filters.nature ? <FilterPill label={filters.nature} onRemove={() => setFilters((f) => ({ ...f, nature: '' }))} /> : null}
          {filters.datePreset && filters.datePreset !== 'custom' ? (
            <FilterPill label={DATE_PRESET_LABELS[filters.datePreset as keyof typeof DATE_PRESET_LABELS] ?? 'Date Range'} onRemove={() => setFilters((f) => ({ ...f, datePreset: '', date_from: '', date_to: '' }))} />
          ) : (
            <>
              {filters.date_from ? <FilterPill label={`From ${filters.date_from}`} onRemove={() => setFilters((f) => ({ ...f, date_from: '', datePreset: 'custom' }))} /> : null}
              {filters.date_to ? <FilterPill label={`To ${filters.date_to}`} onRemove={() => setFilters((f) => ({ ...f, date_to: '', datePreset: 'custom' }))} /> : null}
            </>
          )}
          {filters.search ? <FilterPill label={`"${filters.search}"`} onRemove={() => setFilters((f) => ({ ...f, search: '' }))} /> : null}
        </View>
      )}

      {!loading && transactions.length > 0 && (
        <View className="flex-row bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 mb-2">
          <View className="flex-1 items-center">
            <Text className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">Income</Text>
            <Text className="text-sm font-bold text-green-600">₹{summary.income.toLocaleString('en-IN')}</Text>
          </View>
          <View className="flex-1 items-center border-x border-gray-100 dark:border-gray-800">
            <Text className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">Expense</Text>
            <Text className="text-sm font-bold text-red-600">₹{summary.expense.toLocaleString('en-IN')}</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 font-medium uppercase">Diff</Text>
            <Text className={`text-sm font-bold ${summary.income - summary.expense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{(summary.income - summary.expense).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const flingUp = Gesture.Fling()
    .direction(Directions.UP)
    .onEnd(() => {
      filterRef.current?.open();
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={flingUp}>
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <SyncStatusBar />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.local_id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<Text className="text-gray-400 dark:text-gray-500 text-center py-8">No transactions yet</Text>}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <TouchableOpacity
        onPress={() => router.push('/add')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 dark:bg-blue-500 rounded-full shadow-lg items-center justify-center"
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
    </GestureDetector>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View className="flex-row items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full">
      <Text className="text-xs text-blue-700 dark:text-blue-300 font-medium">{label}</Text>
      <TouchableOpacity onPress={onRemove}>
        <Ionicons name="close-circle" size={14} color="#1d4ed8" />
      </TouchableOpacity>
    </View>
  );
}
