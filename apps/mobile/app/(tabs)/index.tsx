import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { transactionsApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import TransactionFilter from '@/src/components/TransactionFilter';
import type { Transaction, TxNature, FilterState } from '@fintrack/shared';
import { DEFAULT_FILTERS, countActiveFilters } from '@fintrack/shared';

const natureColors: Record<TxNature, string> = {
  INCOME: 'text-green-600',
  EXPENSE: 'text-red-600',
  TRANSFER: 'text-blue-600',
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
  const router = useRouter();
  const { editMode } = useAuth();

  const load = useCallback(async (f: FilterState = filters) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (f.entity) params.entity = f.entity;
      if (f.nature) params.nature = f.nature;
      if (f.date_from) params.date_from = f.date_from;
      if (f.date_to) params.date_to = f.date_to;
      if (f.search) params.search = f.search;
      if (f.category_id) params.category_id = f.category_id;
      if (f.sub_category_id) params.sub_category_id = f.sub_category_id;
      const data = await transactionsApi.list(params);
      setTransactions(data || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(filters); }, [filters]);

  const summary = transactions.reduce(
    (acc, t) => {
      if (t.nature === 'INCOME' || t.nature === 'LOAN_DISBURSEMENT') acc.income += t.amount;
      else if (t.nature === 'EXPENSE' || t.nature === 'EMI_PAYMENT') acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const handleDelete = (id: number) => {
    Alert.alert('Delete', 'Delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await transactionsApi.delete(id);
            load(filters);
          } catch {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item: t }: { item: Transaction }) => (
    <View className="bg-white rounded-lg border border-gray-200 p-3 mb-2 mx-4">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="font-medium text-gray-800" numberOfLines={1}>{t.title}</Text>
          <Text className="text-xs text-gray-500">
            {t.transaction_date} · {natureLabels[t.nature]} · {t.entity}
            {t.payment_method ? ` · ${t.payment_method}` : ''}
          </Text>
          {t.nature === 'EMI_PAYMENT' && (
            <Text className="text-xs text-gray-500">
              P: ₹{t.principal_amount.toLocaleString('en-IN')} + I: ₹{t.interest_amount.toLocaleString('en-IN')}
            </Text>
          )}
          {t.notes ? <Text className="text-xs text-gray-400 mt-1">{t.notes}</Text> : null}
        </View>
        <View className="items-end">
          <Text className={`font-semibold ${natureColors[t.nature]}`}>
            {(t.nature === 'INCOME' || t.nature === 'LOAN_DISBURSEMENT') ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
          </Text>
          {editMode && (
            <View className="flex-row gap-2 mt-1">
              <TouchableOpacity onPress={() => router.push(`/edit/${t.id}`)}>
                <Text className="text-xs text-blue-500">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(t.id)}>
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
        <Text className="text-lg font-semibold text-gray-800">Transactions</Text>
        <TransactionFilter filters={filters} onChange={setFilters} />
      </View>

      {countActiveFilters(filters) > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          {filters.entity ? <FilterPill label={filters.entity} onRemove={() => setFilters((f) => ({ ...f, entity: '' }))} /> : null}
          {filters.nature ? <FilterPill label={filters.nature} onRemove={() => setFilters((f) => ({ ...f, nature: '' }))} /> : null}
          {filters.date_from ? <FilterPill label={`From ${filters.date_from}`} onRemove={() => setFilters((f) => ({ ...f, date_from: '' }))} /> : null}
          {filters.date_to ? <FilterPill label={`To ${filters.date_to}`} onRemove={() => setFilters((f) => ({ ...f, date_to: '' }))} /> : null}
          {filters.search ? <FilterPill label={`"${filters.search}"`} onRemove={() => setFilters((f) => ({ ...f, search: '' }))} /> : null}
        </View>
      )}

      {!loading && transactions.length > 0 && (
        <View className="flex-row bg-white p-3 rounded-lg border border-gray-200 mb-2">
          <View className="flex-1 items-center">
            <Text className="text-[10px] text-gray-500 font-medium uppercase">Income</Text>
            <Text className="text-sm font-bold text-green-600">₹{summary.income.toLocaleString('en-IN')}</Text>
          </View>
          <View className="flex-1 items-center border-x border-gray-100">
            <Text className="text-[10px] text-gray-500 font-medium uppercase">Expense</Text>
            <Text className="text-sm font-bold text-red-600">₹{summary.expense.toLocaleString('en-IN')}</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[10px] text-gray-500 font-medium uppercase">Diff</Text>
            <Text className={`text-sm font-bold ${summary.income - summary.expense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{(summary.income - summary.expense).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
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
          ListEmptyComponent={<Text className="text-gray-400 text-center py-8">No transactions yet</Text>}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity
        onPress={() => router.push('/add')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg items-center justify-center"
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View className="flex-row items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full">
      <Text className="text-xs text-blue-700 font-medium">{label}</Text>
      <TouchableOpacity onPress={onRemove}>
        <Ionicons name="close-circle" size={14} color="#1d4ed8" />
      </TouchableOpacity>
    </View>
  );
}
