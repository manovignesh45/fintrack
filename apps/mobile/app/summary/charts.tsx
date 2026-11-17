import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { summaryApi } from '@/src/api/client';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useLedgers } from '@/src/context/LedgerContext';
import type { SummaryResponse, CategoryBreakdown } from '@fintrack/shared';

function fmt(n: number) {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

function shortMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const RANGE_OPTIONS = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
];

export default function ChartsScreen() {
  const router = useRouter();
  const { activeLedgerId } = useLedgers();
  const [rangeMonths, setRangeMonths] = useState(6);
  const [rangeData, setRangeData] = useState<SummaryResponse[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const rangeTo = useMemo(() => currentMonth(), []);
  const rangeFrom = useMemo(() => addMonths(currentMonth(), -(rangeMonths - 1)), [rangeMonths]);

  const load = useCallback(async () => {
    if (!activeLedgerId) return;
    setLoading(true);
    try {
      const [trendRes, catRes] = await Promise.all([
        summaryApi.getRange(rangeFrom, rangeTo),
        summaryApi.getByCategory(rangeFrom, rangeTo, 'EXPENSE'),
      ]);
      setRangeData(trendRes || []);
      setCategoryData(catRes || []);
      if (trendRes && trendRes.length > 0) {
        setSelectedMonthIndex(trendRes.length - 1);
      }
    } catch {
      setRangeData([]);
      setCategoryData([]);
    } finally {
      setLoading(false);
    }
  }, [activeLedgerId, rangeFrom, rangeTo]);

  useEffect(() => {
    load();
  }, [load]);

  // Calculations for chart scaling
  const maxVal = useMemo(() => {
    let m = 0;
    for (const r of rangeData) {
      const inc = r.total_income + r.total_loan;
      const exp = r.total_expense + r.total_emi;
      if (inc > m) m = inc;
      if (exp > m) m = exp;
    }
    return m > 0 ? m : 1000;
  }, [rangeData]);

  const totalExpense = useMemo(() => {
    return categoryData.reduce((sum, c) => sum + c.total, 0);
  }, [categoryData]);

  const selectedMonth = selectedMonthIndex !== null ? rangeData[selectedMonthIndex] : null;

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <ScreenHeader title="Financial Charts" />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Preset Range Selector */}
        <View className="flex-row bg-gray-200 dark:bg-gray-800 rounded-xl p-1 mb-4">
          {RANGE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              onPress={() => setRangeMonths(opt.months)}
              className={`flex-1 py-1.5 rounded-lg items-center ${
                rangeMonths === opt.months
                  ? 'bg-white dark:bg-gray-700 shadow-xs'
                  : ''
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  rangeMonths === opt.months
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View className="py-20 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : rangeData.length === 0 ? (
          <View className="py-16 items-center justify-center">
            <Text className="text-3xl mb-2">📊</Text>
            <Text className="text-sm text-gray-400">No chart data for this period</Text>
          </View>
        ) : (
          <>
            {/* Monthly Trend Visual Chart */}
            <View className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm font-bold text-gray-800 dark:text-gray-100">Monthly Trend</Text>
                <View className="flex-row items-center gap-3">
                  <View className="flex-row items-center gap-1">
                    <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <Text className="text-[11px] text-gray-500 dark:text-gray-400">Income</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <Text className="text-[11px] text-gray-500 dark:text-gray-400">Expense</Text>
                  </View>
                </View>
              </View>

              {/* Chart Bars */}
              <View className="h-44 flex-row items-end justify-between pt-2 pb-1 border-b border-gray-100 dark:border-gray-700">
                {rangeData.map((row, idx) => {
                  const inc = row.total_income + row.total_loan;
                  const exp = row.total_expense + row.total_emi;
                  const incHeight = Math.max(4, Math.round((inc / maxVal) * 120));
                  const expHeight = Math.max(4, Math.round((exp / maxVal) * 120));
                  const isSelected = selectedMonthIndex === idx;

                  return (
                    <TouchableOpacity
                      key={row.month}
                      onPress={() => setSelectedMonthIndex(idx)}
                      className="flex-1 items-center justify-end h-full px-0.5"
                    >
                      <View className="flex-row items-end gap-1 mb-1">
                        {/* Income Bar */}
                        <View
                          className="w-3 rounded-t-sm bg-green-500 dark:bg-green-400"
                          style={{ height: incHeight, opacity: isSelected ? 1 : 0.75 }}
                        />
                        {/* Expense Bar */}
                        <View
                          className="w-3 rounded-t-sm bg-red-500 dark:bg-red-400"
                          style={{ height: expHeight, opacity: isSelected ? 1 : 0.75 }}
                        />
                      </View>
                      <Text
                        className={`text-[10px] ${
                          isSelected
                            ? 'font-bold text-blue-600 dark:text-blue-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {shortMonth(row.month)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selected Month Detail Banner */}
              {selectedMonth && (
                <View className="mt-3 p-2.5 bg-gray-50 dark:bg-gray-900/60 rounded-lg flex-row justify-between items-center">
                  <View>
                    <Text className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {shortMonth(selectedMonth.month)} Summary
                    </Text>
                    <Text className={`text-xs font-bold ${selectedMonth.net_flow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      Net: {selectedMonth.net_flow >= 0 ? '+' : '-'}{fmt(selectedMonth.net_flow)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                      Inc: {fmt(selectedMonth.total_income + selectedMonth.total_loan)}
                    </Text>
                    <Text className="text-[11px] text-red-500 font-medium">
                      Exp: {fmt(selectedMonth.total_expense + selectedMonth.total_emi)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Top Categories Spending Breakdown */}
            {categoryData.length > 0 && (
              <View className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <Text className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">
                  Expense by Category
                </Text>

                <View className="gap-3">
                  {categoryData.slice(0, 7).map((cat) => {
                    const pct = totalExpense > 0 ? Math.round((cat.total / totalExpense) * 100) : 0;
                    return (
                      <View key={cat.category_id}>
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className="text-xs font-medium text-gray-700 dark:text-gray-300" numberOfLines={1}>
                            {cat.category_name}
                          </Text>
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                              {fmt(cat.total)}
                            </Text>
                            <Text className="text-[10px] text-gray-400">({pct}%)</Text>
                          </View>
                        </View>
                        {/* Progress Bar */}
                        <View className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <View
                            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
