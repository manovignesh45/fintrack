import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SelectField } from '@/src/components/ui/SelectField';
import { summaryApi } from '@/src/api/client';
import { useLedgers } from '@/src/context/LedgerContext';
import type { SummaryResponse } from '@fintrack/shared';

function fmt(n: number) {
  return '₹' + Math.abs(n).toLocaleString('en-IN');
}

function addMonths(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shortMonthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function rangeLabel(from: string, to: string) {
  return from === to ? shortMonthLabel(from) : `${shortMonthLabel(from)} – ${shortMonthLabel(to)}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const emptyTotals = { total_income: 0, total_expense: 0, total_emi: 0, total_loan: 0, net_flow: 0 };

function BreakdownRow({ color, label, value, valueClassName }: { color: string; label: string; value: number; valueClassName: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <View className={`w-2 h-2 rounded-full ${color}`} />
        <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      </View>
      <Text className={`text-sm font-semibold ${valueClassName}`}>{fmt(value)}</Text>
    </View>
  );
}

function BreakdownCard({ totals }: { totals: typeof emptyTotals }) {
  const totalOut = totals.total_expense + totals.total_emi;
  const isPositive = totals.net_flow >= 0;

  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
      <View className="flex-row items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <Text className="text-sm font-bold text-gray-700 dark:text-gray-200">Breakdown</Text>
        <View className={`px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
          <Text className={`text-xs font-semibold ${isPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {isPositive ? '+' : '-'}{fmt(totals.net_flow)}
          </Text>
        </View>
      </View>
      <View className="px-4 py-3 gap-2">
        {totals.total_income > 0 && (
          <BreakdownRow color="bg-green-500" label="Income" value={totals.total_income} valueClassName="text-green-600" />
        )}
        {totals.total_loan > 0 && (
          <BreakdownRow color="bg-purple-400" label="Loan Received" value={totals.total_loan} valueClassName="text-purple-500" />
        )}
        {totals.total_expense > 0 && (
          <BreakdownRow color="bg-red-400" label="Expense" value={totals.total_expense} valueClassName="text-red-500" />
        )}
        {totals.total_emi > 0 && (
          <BreakdownRow color="bg-orange-400" label="EMI Payments" value={totals.total_emi} valueClassName="text-orange-500" />
        )}
        {totalOut > 0 && (totals.total_income > 0 || totals.total_loan > 0) && (
          <View className="flex-row items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
            <Text className="text-xs text-gray-400">Total Out</Text>
            <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">{fmt(totalOut)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function CompareTable({ rows }: { rows: SummaryResponse[] }) {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <View className="flex-row bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-3 py-2">
        <Text className="flex-[1.2] text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">Month</Text>
        <Text className="flex-1 text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400 text-right">Income</Text>
        <Text className="flex-1 text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400 text-right">Expense</Text>
        <Text className="flex-1 text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400 text-right">EMI</Text>
        <Text className="flex-[1.1] text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400 text-right">Net</Text>
      </View>
      {[...rows].reverse().map((r, i) => (
        <View
          key={r.month}
          className={`flex-row px-3 py-2 ${i < rows.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}
        >
          <Text className="flex-[1.2] text-xs font-medium text-gray-700 dark:text-gray-300">{shortMonthLabel(r.month)}</Text>
          <Text className="flex-1 text-xs text-green-600 dark:text-green-400 text-right">
            {r.total_income + r.total_loan > 0 ? fmt(r.total_income + r.total_loan) : '—'}
          </Text>
          <Text className="flex-1 text-xs text-red-500 text-right">{r.total_expense > 0 ? fmt(r.total_expense) : '—'}</Text>
          <Text className="flex-1 text-xs text-orange-500 text-right">{r.total_emi > 0 ? fmt(r.total_emi) : '—'}</Text>
          <Text className={`flex-[1.1] text-xs font-semibold text-right ${r.net_flow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {r.net_flow >= 0 ? '+' : '-'}{fmt(r.net_flow)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function SummaryScreen() {
  const [rangeFrom, setRangeFrom] = useState(() => addMonths(currentMonth(), -11));
  const [rangeTo, setRangeTo] = useState(currentMonth);
  const [rangeData, setRangeData] = useState<SummaryResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { activeLedgerId } = useLedgers();

  const monthItems = useMemo(() => {
    const items = [];
    for (let i = 0; i < 36; i++) {
      const m = addMonths(currentMonth(), -i);
      items.push({ label: shortMonthLabel(m), value: m });
    }
    return items;
  }, []);

  const load = useCallback(() => {
    if (rangeFrom > rangeTo) return;
    setLoading(true);
    summaryApi.getRange(rangeFrom, rangeTo)
      .then(setRangeData)
      .catch(() => setRangeData(null))
      .finally(() => setLoading(false));
  }, [rangeFrom, rangeTo]);

  useEffect(() => { load(); }, [load, activeLedgerId]);

  const onRefresh = useCallback(async () => {
    if (rangeFrom > rangeTo) return;
    setRefreshing(true);
    try {
      const result = await summaryApi.getRange(rangeFrom, rangeTo);
      setRangeData(result);
    } catch {
      // keep existing data on network failure
    } finally {
      setRefreshing(false);
    }
  }, [rangeFrom, rangeTo]);

  const handleFromChange = (v: string) => {
    setRangeFrom(v);
    if (v > rangeTo) setRangeTo(v);
  };

  const handleToChange = (v: string) => {
    setRangeTo(v);
    if (v < rangeFrom) setRangeFrom(v);
  };

  const totals = (rangeData ?? []).reduce(
    (acc, r) => ({
      total_income: acc.total_income + r.total_income,
      total_expense: acc.total_expense + r.total_expense,
      total_emi: acc.total_emi + r.total_emi,
      total_loan: acc.total_loan + r.total_loan,
      net_flow: acc.net_flow + r.net_flow,
    }),
    emptyTotals
  );
  const totalExpense = totals.total_expense + totals.total_emi;
  const hasData = !!rangeData && rangeData.some((r) => r.total_income > 0 || r.total_expense > 0 || r.total_emi > 0 || r.total_loan > 0);
  const monthsWithData = (rangeData ?? []).filter((r) => r.total_income > 0 || r.total_expense > 0 || r.total_emi > 0 || r.total_loan > 0).length;
  const avgExpense = monthsWithData > 0 ? totalExpense / monthsWithData : 0;

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerClassName="p-4 pb-8"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Monthly Summary</Text>

      {/* Date range selection */}
      <View className="flex-row gap-2">
        <SelectField
          containerClassName="flex-1 mb-1"
          label="From"
          selectedValue={rangeFrom}
          onValueChange={handleFromChange}
          items={monthItems}
        />
        <SelectField
          containerClassName="flex-1 mb-1"
          label="To"
          selectedValue={rangeTo}
          onValueChange={handleToChange}
          items={monthItems}
        />
      </View>
      <TouchableOpacity
        onPress={() => {
          setRangeFrom(addMonths(currentMonth(), -11));
          setRangeTo(currentMonth());
        }}
        className="self-start px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 mb-4"
      >
        <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">Last 12 months</Text>
      </TouchableOpacity>

      {loading ? (
        <View className="items-center justify-center py-12">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : !hasData ? (
        <View className="items-center py-12">
          <Text className="text-3xl mb-2">📭</Text>
          <Text className="text-sm text-gray-400 dark:text-gray-500">No transactions in this range</Text>
        </View>
      ) : (
        <>
          {/* Grand total banner */}
          <View className="bg-blue-600 dark:bg-blue-900/20 rounded-xl p-4 mb-4">
            <Text className="text-xs font-semibold uppercase text-blue-200 mb-3">
              Grand Total · {rangeLabel(rangeFrom, rangeTo)}
            </Text>
            <View className="flex-row mb-3">
              <View className="flex-1 items-center">
                <Text className="text-xs text-blue-200 mb-1">Income</Text>
                <Text className="text-sm font-bold text-green-300">{fmt(totals.total_income + totals.total_loan)}</Text>
              </View>
              <View className="flex-1 items-center border-l border-blue-500">
                <Text className="text-xs text-blue-200 mb-1">Expense</Text>
                <Text className="text-sm font-bold text-red-300">{fmt(totalExpense)}</Text>
              </View>
            </View>
            <View className="flex-row pt-3 border-t border-blue-500">
              <View className="flex-1 items-center">
                <Text className="text-xs text-blue-200 mb-1">Avg Exp/mo</Text>
                <Text className="text-sm font-bold text-red-300">{fmt(avgExpense)}</Text>
              </View>
              <View className="flex-1 items-center border-l border-blue-500">
                <Text className="text-xs text-blue-200 mb-1">Net</Text>
                <Text className={`text-sm font-bold ${totals.net_flow >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {totals.net_flow >= 0 ? '+' : '-'}{fmt(totals.net_flow)}
                </Text>
              </View>
            </View>
          </View>

          {/* Breakdown */}
          <BreakdownCard totals={totals} />

          {/* Month-by-month comparison */}
          <CompareTable rows={rangeData!} />
        </>
      )}
    </ScrollView>
  );
}
