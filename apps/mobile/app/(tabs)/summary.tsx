import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { summaryApi } from '@/src/api/client';
import { useLedgers } from '@/src/context/LedgerContext';
import type { SummaryResponse } from '@fintrack/shared';

function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN');
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}



export default function SummaryScreen() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isCurrentMonth = month === currentMonth();
  const { activeLedgerId } = useLedgers();

  useEffect(() => {
    setLoading(true);
    summaryApi.get(month)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month, activeLedgerId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await summaryApi.get(month);
      setData(result);
    } catch {
      // keep existing data on network failure
    } finally {
      setRefreshing(false);
    }
  }, [month]);

  const totalIncome = data?.total_income ?? 0;
  const totalExpense = data?.total_expense ?? 0;
  const totalEmi = data?.total_emi ?? 0;
  const totalOut = totalExpense + totalEmi;
  const totalNet = data?.net_flow ?? 0;

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerClassName="p-4 pb-8"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Month navigation */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Monthly Summary</Text>
        <View className="flex-row items-center gap-1">
          <TouchableOpacity
            onPress={() => setMonth(prevMonth)}
            className="w-8 h-8 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          >
            <Ionicons name="chevron-back" size={16} color="#6b7280" />
          </TouchableOpacity>
          <View className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            <Text className="text-xs font-medium text-gray-600 dark:text-gray-300">{monthLabel(month)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setMonth(nextMonth)}
            disabled={isCurrentMonth}
            className={`w-8 h-8 items-center justify-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${isCurrentMonth ? 'opacity-30' : ''}`}
          >
            <Ionicons name="chevron-forward" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <Text className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">{monthLabel(month)}</Text>

      {loading ? (
        <View className="items-center justify-center py-12">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : !data || (data.total_income === 0 && data.total_expense === 0 && data.total_emi === 0) ? (
        <View className="items-center py-12">
          <Text className="text-3xl mb-2">📭</Text>
          <Text className="text-sm text-gray-400 dark:text-gray-500">No transactions for {monthLabel(month)}</Text>
        </View>
      ) : (
        <>
          {/* Grand total banner */}
          <View className="bg-blue-600 dark:bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4">
            <Text className="text-xs font-semibold uppercase text-blue-200 mb-3">Grand Total</Text>
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text className="text-xs text-blue-200 mb-1">Income</Text>
                <Text className="text-sm font-bold text-green-300">{fmt(totalIncome)}</Text>
              </View>
              <View className="flex-1 items-center border-x border-blue-500">
                <Text className="text-xs text-blue-200 mb-1">Total Out</Text>
                <Text className="text-sm font-bold text-red-300">{fmt(totalOut)}</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-xs text-blue-200 mb-1">Net</Text>
                <Text className={`text-sm font-bold ${totalNet >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {totalNet >= 0 ? '+' : '-'}{fmt(totalNet)}
                </Text>
              </View>
            </View>
          </View>

          {/* Breakdown Details */}
          <View className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
            <View className="flex-row items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
              <Text className="text-sm font-bold text-gray-700 dark:text-gray-200">Breakdown</Text>
            </View>
            <View className="px-4 py-3 gap-2">
              {totalIncome > 0 && (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2 h-2 rounded-full bg-green-500" />
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Income</Text>
                  </View>
                  <Text className="text-sm font-semibold text-green-600">{fmt(totalIncome)}</Text>
                </View>
              )}
              {totalExpense > 0 && (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2 h-2 rounded-full bg-red-400" />
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Expense</Text>
                  </View>
                  <Text className="text-sm font-semibold text-red-500">{fmt(totalExpense)}</Text>
                </View>
              )}
              {totalEmi > 0 && (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2 h-2 rounded-full bg-orange-400" />
                    <Text className="text-sm text-gray-500 dark:text-gray-400">EMI Payments</Text>
                  </View>
                  <Text className="text-sm font-semibold text-orange-500">{fmt(totalEmi)}</Text>
                </View>
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
