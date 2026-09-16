import 'react-native-gesture-handler';
import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Gesture, GestureDetector, Directions, FlatList } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesApi, paymentMethodsApi, tagsApi, transactionsApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useLedgers } from '@/src/context/LedgerContext';
import TransactionFilter, { TransactionFilterRef } from '@/src/components/TransactionFilter';
import { FAB } from '@/src/components/ui/FAB';
import { GettingStartedCard } from '@/src/components/ui/GettingStartedCard';
import type { TxNature, FilterState, Transaction, Tag, Category, PaymentMethod } from '@fintrack/shared';
import { DEFAULT_FILTERS, countActiveFilters, DATE_PRESET_LABELS } from '@fintrack/shared';

const natureColors: Record<TxNature, string> = {
  INCOME: 'text-green-600 dark:text-green-400',
  EXPENSE: 'text-red-600 dark:text-red-400',
  TRANSFER: 'text-blue-600 dark:text-blue-400',
  EMI_PAYMENT: 'text-orange-600 dark:text-orange-400',
  LOAN_DISBURSEMENT: 'text-green-800 dark:text-green-300',
};

const natureLabels: Record<TxNature, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  EMI_PAYMENT: 'EMI Payment',
  LOAN_DISBURSEMENT: 'Loan Disbursement',
};

function getWarrantyStatus(dateStr?: string) {
  if (!dateStr) return null;
  const today = new Date().toISOString().split('T')[0];
  if (dateStr >= today) {
    return { label: 'Active', isExpired: false, badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400' };
  }
  return { label: 'Expired', isExpired: true, badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400' };
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
      if (f.tag_id) params.tag_id = f.tag_id;

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
    if (activeLedgerId) {
      categoriesApi.list().then((c) => setCategories(c || [])).catch(() => setCategories([]));
      paymentMethodsApi.list().then((p) => setPaymentMethods(p || [])).catch(() => setPaymentMethods([]));
      tagsApi.list().then((t) => setTags(t || [])).catch(() => setTags([]));
    }
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

  const renderItem = ({ item: t }: { item: Transaction }) => {
    const isExpanded = expandedId === t.id;
    const isPositive = t.nature === 'INCOME' || t.nature === 'LOAN_DISBURSEMENT';
    const warranty = getWarrantyStatus(t.warranty_until);

    let catName: string | undefined;
    let subName: string | undefined;
    if (t.sub_category_id) {
      for (const cat of categories) {
        const sub = cat.sub_categories?.find((s) => s.id === t.sub_category_id);
        if (sub) {
          catName = cat.name;
          subName = sub.name;
          break;
        }
      }
    }

    const pmName = t.payment_method_id
      ? paymentMethods.find((p) => p.id === t.payment_method_id)?.name
      : null;

    return (
      <View
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2 mx-4"
        style={isExpanded ? { borderColor: '#3b82f6' } : undefined}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setExpandedId(isExpanded ? null : t.id)}
        >
          {/* Top Row: Title + Indicators & Amount */}
          <View className="flex-row justify-between items-start mb-1">
            <View className="flex-1 flex-row items-center gap-1.5 mr-3">
              <Text className="font-medium text-gray-800 dark:text-gray-100 flex-shrink" numberOfLines={1}>
                {t.title}
              </Text>
              {t.warranty_until ? <Text className="text-xs">🛡️</Text> : null}
              {t.tags && t.tags.length > 0 ? <Text className="text-xs">🏷️</Text> : null}
            </View>
            <Text className={`font-semibold ${natureColors[t.nature]}`}>
              {isPositive ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Subtitle Row: Date · Category / Nature [· Payment Method] & Expand Arrow */}
          <View className="flex-row justify-between items-center">
            <Text className="text-xs text-gray-500 dark:text-gray-400 flex-1 mr-2" numberOfLines={1}>
              {t.transaction_date} · {catName || natureLabels[t.nature]}
              {pmName ? ` · ${pmName}` : ''}
            </Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-[11px] text-gray-400 dark:text-gray-500">
                {isExpanded ? 'Hide' : 'Details'}
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color="#9ca3af"
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Expanded Details View */}
        {isExpanded && (
          <View className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 gap-2.5">
            {/* Nature Badge & Date */}
            <View className="flex-row items-center justify-between">
              <View className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {natureLabels[t.nature]}
                </Text>
              </View>
              <Text className="text-xs text-gray-400">{t.transaction_date}</Text>
            </View>

            {/* Classification: Category & Payment Method */}
            <View className="flex-row gap-2">
              <View className="flex-1 bg-gray-50 dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <Text className="text-[10px] font-semibold text-gray-400 uppercase">Category</Text>
                <Text className="text-xs font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {catName ? `${catName}${subName ? ` ↳ ${subName}` : ''}` : 'None'}
                </Text>
              </View>
              <View className="flex-1 bg-gray-50 dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
                <Text className="text-[10px] font-semibold text-gray-400 uppercase">Payment Method</Text>
                <Text className="text-xs font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                  {pmName || 'None'}
                </Text>
              </View>
            </View>

            {/* EMI Breakdown */}
            {t.nature === 'EMI_PAYMENT' && (
              <View className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 p-2.5 rounded-lg">
                <Text className="text-[10px] font-semibold text-orange-800 dark:text-orange-300 uppercase mb-1">
                  Loan EMI Breakdown
                </Text>
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-[10px] text-gray-500">Principal</Text>
                    <Text className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      ₹{(t.principal_amount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-[10px] text-gray-500">Interest</Text>
                    <Text className="text-xs font-bold text-orange-600 dark:text-orange-400">
                      ₹{(t.interest_amount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Tags */}
            {t.tags && t.tags.length > 0 && (
              <View>
                <Text className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Tags</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {t.tags.map((tg) => (
                    <View
                      key={tg.id}
                      className="flex-row items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-full"
                    >
                      <Text className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        🏷️ {tg.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Warranty & Guarantee */}
            {(t.warranty_until || t.warranty_notes) && (
              <View className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2.5 rounded-lg">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[10px] font-semibold text-gray-500 uppercase">
                    🛡️ Warranty / Guarantee
                  </Text>
                  {warranty && (
                    <View className={`px-2 py-0.5 rounded-full ${warranty.badgeClass}`}>
                      <Text className="text-[10px] font-semibold">{warranty.label}</Text>
                    </View>
                  )}
                </View>
                {t.warranty_until && (
                  <Text className="text-xs text-gray-700 dark:text-gray-300">
                    Valid Until: <Text className="font-semibold">{t.warranty_until}</Text>
                  </Text>
                )}
                {t.warranty_notes && (
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t.warranty_notes}
                  </Text>
                )}
              </View>
            )}

            {/* Notes */}
            {t.notes ? (
              <View className="bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-100 dark:border-gray-800">
                <Text className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Notes</Text>
                <Text className="text-xs text-gray-700 dark:text-gray-300">{t.notes}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View className="flex-row justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
              {t.id && (
                <TouchableOpacity
                  onPress={() => router.push(`/edit/${t.id}`)}
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 rounded"
                >
                  <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleDelete(t)}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-950 rounded"
              >
                <Text className="text-xs font-semibold text-red-600 dark:text-red-400">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

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
          {filters.category_id ? (
            <FilterPill
              label={categories.find((c) => String(c.id) === filters.category_id)?.name || `Cat #${filters.category_id}`}
              onRemove={() => setFilters((f) => ({ ...f, category_id: '', sub_category_id: '' }))}
            />
          ) : null}
          {filters.sub_category_id ? (
            <FilterPill label={`Sub #${filters.sub_category_id}`} onRemove={() => setFilters((f) => ({ ...f, sub_category_id: '' }))} />
          ) : null}
          {filters.tag_id ? (
            <FilterPill
              label={`🏷️ ${tags.find((tg) => String(tg.id) === filters.tag_id)?.name || `Tag #${filters.tag_id}`}`}
              onRemove={() => setFilters((f) => ({ ...f, tag_id: '' }))}
            />
          ) : null}
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
