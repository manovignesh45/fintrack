import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { summaryApi } from '@/src/api/client';
import type { EntitySummary, SummaryResponse } from '@fintrack/shared';

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

function EntityCard({ e }: { e: EntitySummary }) {
  const totalOut = e.total_expense + e.total_emi;
  const isPositive = e.net_flow >= 0;

  return (
    <View className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
      <View className="flex-row items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <Text className="text-sm font-bold text-gray-700">{e.entity}</Text>
        <View className={`px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
          <Text className={`text-xs font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
            {isPositive ? '+' : '-'}{fmt(e.net_flow)}
          </Text>
        </View>
      </View>
      <View className="px-4 py-3 gap-2">
        {e.total_income > 0 && (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-green-500" />
              <Text className="text-sm text-gray-500">Income</Text>
            </View>
            <Text className="text-sm font-semibold text-green-600">{fmt(e.total_income)}</Text>
          </View>
        )}
        {e.total_expense > 0 && (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-red-400" />
              <Text className="text-sm text-gray-500">Expense</Text>
            </View>
            <Text className="text-sm font-semibold text-red-500">{fmt(e.total_expense)}</Text>
          </View>
        )}
        {e.total_emi > 0 && (
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-orange-400" />
              <Text className="text-sm text-gray-500">EMI Payments</Text>
            </View>
            <Text className="text-sm font-semibold text-orange-500">{fmt(e.total_emi)}</Text>
          </View>
        )}
        {totalOut > 0 && e.total_income > 0 && (
          <View className="flex-row items-center justify-between pt-1 border-t border-gray-100">
            <Text className="text-xs text-gray-400">Total Out</Text>
            <Text className="text-xs font-medium text-gray-500">{fmt(totalOut)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function SummaryScreen() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const isCurrentMonth = month === currentMonth();

  useEffect(() => {
    setLoading(true);
    summaryApi.get(month)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  const totalIncome = data?.entities.reduce((s, e) => s + e.total_income, 0) ?? 0;
  const totalExpense = data?.entities.reduce((s, e) => s + e.total_expense + e.total_emi, 0) ?? 0;
  const totalNet = totalIncome - totalExpense;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 pb-8">
      {/* Month navigation */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-lg font-semibold text-gray-800">Monthly Summary</Text>
        <View className="flex-row items-center gap-1">
          <TouchableOpacity
            onPress={() => setMonth(prevMonth)}
            className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200"
          >
            <Ionicons name="chevron-back" size={16} color="#6b7280" />
          </TouchableOpacity>
          <View className="px-3 py-1 border border-gray-200 rounded-lg bg-white">
            <Text className="text-xs font-medium text-gray-600">{monthLabel(month)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setMonth(nextMonth)}
            disabled={isCurrentMonth}
            className={`w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200 ${isCurrentMonth ? 'opacity-30' : ''}`}
          >
            <Ionicons name="chevron-forward" size={16} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <Text className="text-sm text-gray-500 mb-4">{monthLabel(month)}</Text>

      {loading ? (
        <View className="items-center justify-center py-12">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : !data || data.entities.length === 0 ? (
        <View className="items-center py-12">
          <Text className="text-3xl mb-2">📭</Text>
          <Text className="text-sm text-gray-400">No transactions for {monthLabel(month)}</Text>
        </View>
      ) : (
        <>
          {/* Grand total banner */}
          <View className="bg-blue-600 rounded-xl p-4 mb-4">
            <Text className="text-xs font-semibold uppercase text-blue-200 mb-3">Grand Total</Text>
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text className="text-xs text-blue-200 mb-1">Income</Text>
                <Text className="text-sm font-bold text-green-300">{fmt(totalIncome)}</Text>
              </View>
              <View className="flex-1 items-center border-x border-blue-500">
                <Text className="text-xs text-blue-200 mb-1">Expense</Text>
                <Text className="text-sm font-bold text-red-300">{fmt(totalExpense)}</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-xs text-blue-200 mb-1">Net</Text>
                <Text className={`text-sm font-bold ${totalNet >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {totalNet >= 0 ? '+' : '-'}{fmt(totalNet)}
                </Text>
              </View>
            </View>
          </View>

          {/* Entity breakdown */}
          {data.entities.map((e) => (
            <EntityCard key={e.entity} e={e} />
          ))}
        </>
      )}
    </ScrollView>
  );
}
