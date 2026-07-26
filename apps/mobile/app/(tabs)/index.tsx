import 'react-native-gesture-handler';
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Gesture, GestureDetector, Directions, FlatList } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { transactionsApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useLedgers } from '@/src/context/LedgerContext';
import TransactionFilter, { TransactionFilterRef } from '@/src/components/TransactionFilter';
import { FAB } from '@/src/components/ui/FAB';
import { GettingStartedCard } from '@/src/components/ui/GettingStartedCard';
import type { TxNature, FilterState, Transaction } from '@fintrack/shared';
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const filterRef = useRef<TransactionFilterRef>(null);
  const router = useRouter();
  const { editMode } = useAuth();
  const { activeLedgerId, refreshLedgers } = useLedgers();

  const loadTransactions = useCallback(async (f: FilterState = filters, showSpinner = false) => {
    if (!activeLedgerId) return;
    if (showSpinner) setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (f.nature) params.nature = f.nature;
      if (f.date_from) params.date_from = f.date_from;
      if (f.date_to) params.date_to = f.date_to;
      if (f.search) params.search = f.search;
      if (f.category_id) params.category_id = f.category_id;
      if (f.sub_category_id) params.sub_category_id = f.sub_category_id;

      const data = await transactionsApi.list(params);
      setTransactions(data || []);
    } catch (err: any) {
      console.error("Transactions load error:", err);
      Alert.alert("API Error", err?.message || "Failed to load transactions");
      setTransactions([]);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeLedgerId, filters]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions(filters, false);
    }, [filters, loadTransactions])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!activeLedgerId) {
      await refreshLedgers();
    }
    await loadTransactions(filters, false);
    setRefreshing(false);
  }, [filters, loadTransactions, activeLedgerId, refreshLedgers]);

  useEffect(() => {
    loadTransactions(filters, true);
  }, [activeLedgerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (item: Transaction) => {
    Alert.alert('Delete', 'Delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (item.id) {
              await transactionsApi.delete(item.id);
              await loadTransactions(filters, true);
            }
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

  const renderItem = ({ item: t }: { item: Transaction }) => (
    <View className="bg-white dark:bg-gray-800 rounded-lg border p-3 mb-2 mx-4 border-gray-200 dark:border-gray-700">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-1.5">
            <Text className="font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>{t.title}</Text>
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {t.transaction_date} · {natureLabels[t.nature]}
          </Text>
          {t.nature === 'EMI_PAYMENT' && (
            <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              P: ₹{t.principal_amount.toLocaleString('en-IN')} + I: ₹{t.interest_amount.toLocaleString('en-IN')}
            </Text>
          )}
          {t.notes ? (
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
    <View className="px-4 pt-4 pb-2">
      <GettingStartedCard />

      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Transactions</Text>
        <TransactionFilter ref={filterRef} filters={filters} onChange={setFilters} />
      </View>

      {countActiveFilters(filters) > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mb-3">

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
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<Text className="text-gray-400 dark:text-gray-500 text-center py-8">No transactions yet</Text>}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <FAB onPress={() => router.push('/add')} accessibilityLabel="Add transaction" />
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
