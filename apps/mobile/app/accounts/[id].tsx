import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { accountsApi, transactionsApi } from '@/src/api/client';
import type { Account, Transaction } from '@fintrack/shared';

interface StatementRow {
  txn: Transaction;
  debit: number;
  credit: number;
  interest: number;
  balance: number;
}

function calculateStatement(
  transactions: Transaction[],
  initialBalance: number,
  accountId: number,
): StatementRow[] {
  if (transactions.length === 0) return [];

  const sorted = [...transactions].sort((a, b) => {
    const d = a.transaction_date.localeCompare(b.transaction_date);
    return d !== 0 ? d : a.id - b.id;
  });

  let runningBalance = initialBalance;
  const rows: StatementRow[] = [];

  for (const txn of sorted) {
    let debit = 0, credit = 0, interest = 0;
    const isSource = txn.source_account_id === accountId;
    const isTarget = txn.target_account_id === accountId;

    if (txn.nature === 'INCOME') {
      if (isSource || isTarget) { credit = txn.amount; runningBalance += txn.amount; }
    } else if (txn.nature === 'EXPENSE') {
      if (isSource) { debit = txn.amount; runningBalance -= txn.amount; }
    } else if (txn.nature === 'TRANSFER') {
      if (isSource) { debit = txn.amount; runningBalance -= txn.amount; }
      else if (isTarget) { credit = txn.amount; runningBalance += txn.amount; }
    } else if (txn.nature === 'EMI_PAYMENT') {
      if (isSource) { debit = txn.amount; runningBalance -= txn.amount; }
      else if (isTarget) { debit = txn.principal_amount; interest = txn.interest_amount; runningBalance -= txn.principal_amount; }
    } else if (txn.nature === 'LOAN_DISBURSEMENT') {
      if (isSource || isTarget) { credit = txn.amount; runningBalance += txn.amount; }
    }

    rows.push({ txn, debit, credit, interest, balance: runningBalance });
  }

  return rows.reverse();
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

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const natureColors: Record<string, string> = {
  INCOME: 'bg-green-100 text-green-700',
  EXPENSE: 'bg-red-100 text-red-700',
  TRANSFER: 'bg-blue-100 text-blue-700',
  EMI_PAYMENT: 'bg-orange-100 text-orange-700',
  LOAN_DISBURSEMENT: 'bg-purple-100 text-purple-700',
};

export default function AccountDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [openingBalanceAccount, setOpeningBalanceAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonth);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const [year, monthNum] = month.split('-').map(Number);
    const dateFrom = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
    const dateTo = new Date(year, monthNum, 0).toISOString().split('T')[0];
    const dayBeforeStart = new Date(year, monthNum - 1, 0).toISOString().split('T')[0];

    Promise.all([
      accountsApi.get(parseInt(id), { date_to: dateTo }),
      accountsApi.get(parseInt(id), { date_to: dayBeforeStart }),
      transactionsApi.list({ account_id: id, date_from: dateFrom, date_to: dateTo, per_page: '50' }),
    ])
      .then(([curr, start, txns]) => {
        setAccount(curr);
        setOpeningBalanceAccount(start);
        setTransactions(txns);
      })
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, month]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!account || !openingBalanceAccount) return null;

  const isCurrentMonth = month === currentMonth();
  const statementRows = calculateStatement(transactions, openingBalanceAccount.current_balance, account.id);
  const monthShort = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="pb-8">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#4b5563" />
          </TouchableOpacity>
          <View>
            <Text className="text-lg font-semibold text-gray-800">{account.name}</Text>
            <Text className="text-sm text-gray-500">{account.type}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          <TouchableOpacity onPress={() => setMonth(prevMonth)} className="w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200">
            <Ionicons name="chevron-back" size={14} color="#6b7280" />
          </TouchableOpacity>
          <View className="px-2 py-1 border border-gray-200 rounded-lg bg-white">
            <Text className="text-[10px] font-medium text-gray-600">{monthShort}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setMonth(nextMonth)}
            disabled={isCurrentMonth}
            className={`w-8 h-8 items-center justify-center rounded-lg bg-white border border-gray-200 ${isCurrentMonth ? 'opacity-30' : ''}`}
          >
            <Ionicons name="chevron-forward" size={14} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Balance card */}
      <View className="mx-4 bg-blue-600 rounded-lg p-4 mb-4">
        <View className="flex-row justify-between items-start">
          <View>
            <Text className="text-xs text-blue-200 uppercase font-semibold">Closing Balance ({monthShort})</Text>
            <Text className="text-2xl font-bold text-white mt-1">₹{account.current_balance.toLocaleString('en-IN')}</Text>
          </View>
          <View className="items-end">
            <Text className="text-xs text-blue-200">Opening Balance</Text>
            <Text className="text-lg font-semibold text-white">₹{openingBalanceAccount.current_balance.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>

      {/* Statement */}
      <View className="mx-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <View className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <Text className="text-sm font-semibold text-gray-700">Account Statement</Text>
        </View>

        {statementRows.length === 0 ? (
          <Text className="text-center text-gray-400 py-8">No transactions found</Text>
        ) : (
          <>
            {statementRows.map((row) => (
              <View key={row.txn.id} className="px-4 py-3 border-b border-gray-100">
                <View className="flex-row justify-between items-start mb-1">
                  <View className="flex-1 mr-2">
                    <Text className="font-medium text-gray-800 text-sm">{row.txn.title}</Text>
                    <Text className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(row.txn.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text className="font-semibold text-gray-800 text-sm">₹{row.balance.toLocaleString('en-IN')}</Text>
                </View>
                <View className="flex-row gap-2 flex-wrap">
                  {row.debit > 0 && (
                    <Text className="text-xs text-red-600">Debit: ₹{row.debit.toLocaleString('en-IN')}</Text>
                  )}
                  {row.interest > 0 && (
                    <Text className="text-xs text-orange-600">Interest: ₹{row.interest.toLocaleString('en-IN')}</Text>
                  )}
                  {row.credit > 0 && (
                    <Text className="text-xs text-green-600">Credit: ₹{row.credit.toLocaleString('en-IN')}</Text>
                  )}
                </View>
              </View>
            ))}

            {/* Opening balance row */}
            <View className="px-4 py-3 bg-blue-50 border-t-2 border-blue-200">
              <View className="flex-row justify-between">
                <Text className="font-medium text-gray-700">Balance Brought Forward</Text>
                <Text className="font-semibold text-gray-800">₹{openingBalanceAccount.current_balance.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
