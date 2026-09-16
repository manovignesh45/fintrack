import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { commitmentsApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useLedgers } from '@/src/context/LedgerContext';
import { FAB } from '@/src/components/ui/FAB';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useToast } from '@/src/context/ToastContext';
import CommitmentPaySheet from '@/src/components/CommitmentPaySheet';
import { notifyCommitmentsChanged } from '@/src/hooks/useHasCommitments';
import type {
  CommitmentStatus,
  CommitmentsMonthResponse,
  PayCommitmentInput,
} from '@fintrack/shared';

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number);
  const next = new Date(y, m - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

export function getDueInfo(item: CommitmentStatus, month: string) {
  if (item.status === 'INACTIVE') {
    return { urgency: 'inactive', label: 'Paused' };
  }

  if (item.status === 'PAID') {
    let dateStr = '';
    if (item.payment?.paid_on) {
      const parts = item.payment.paid_on.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      }
    }
    return { urgency: 'paid', label: dateStr ? `Paid ${dateStr}` : 'Paid' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currMonth = currentMonthKey();
  const [y, m, d] = item.due_date.split('-').map(Number);
  const dueDate = new Date(y, m - 1, d);
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (month < currMonth || (month === currMonth && diffDays < 0)) {
    return {
      urgency: 'overdue',
      label: diffDays === -1 ? 'Due yesterday · overdue' : `${Math.abs(diffDays)} days overdue`,
      badge: 'Overdue',
    };
  }

  if (month === currMonth && diffDays <= 7) {
    let label = '';
    let badge = '';
    if (diffDays === 0) {
      label = 'Due today';
      badge = 'Today';
    } else if (diffDays === 1) {
      label = 'Due tomorrow';
      badge = 'Tomorrow';
    } else {
      label = `In ${diffDays} days (Due ${d})`;
    }
    return { urgency: 'due_soon', label, badge };
  }

  return { urgency: 'upcoming', label: `Due ${d} ${dueDate.toLocaleDateString('en-IN', { month: 'short' })}` };
}

interface Props {
  showHeader?: boolean;
}

export default function CommitmentsDashboard({ showHeader = false }: Props) {
  const router = useRouter();
  const { editMode } = useAuth();
  const { activeLedgerId } = useLedgers();
  const { showToast } = useToast();

  const [month, setMonth] = useState(currentMonthKey);
  const [data, setData] = useState<CommitmentsMonthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingItem, setPayingItem] = useState<CommitmentStatus | null>(null);

  const [collapsePaid, setCollapsePaid] = useState(false);
  const [collapseInactive, setCollapseInactive] = useState(true);

  const loadData = useCallback(async (showSpinner = false) => {
    if (!activeLedgerId) return;
    if (showSpinner) setLoading(true);
    try {
      const res = await commitmentsApi.list(month);
      setData(res);
    } catch {
      setData(null);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [activeLedgerId, month]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

  const items = data?.items || [];
  const overdue = useMemo(
    () => items.filter((i) => i.status === 'DUE' && getDueInfo(i, month).urgency === 'overdue'),
    [items, month]
  );
  const dueSoon = useMemo(
    () => items.filter((i) => i.status === 'DUE' && getDueInfo(i, month).urgency === 'due_soon'),
    [items, month]
  );
  const upcoming = useMemo(
    () => items.filter((i) => i.status === 'DUE' && getDueInfo(i, month).urgency === 'upcoming'),
    [items, month]
  );
  const paid = useMemo(() => items.filter((i) => i.status === 'PAID'), [items]);
  const inactive = useMemo(() => items.filter((i) => i.status === 'INACTIVE'), [items]);

  const totalCount = items.filter((i) => i.status !== 'INACTIVE').length;
  const paidCount = paid.length;
  const percentPaid = totalCount ? Math.round((paidCount / totalCount) * 100) : 0;

  const handlePayConfirm = async (input: PayCommitmentInput) => {
    if (!payingItem) return;
    await commitmentsApi.pay(payingItem.id, input);
    notifyCommitmentsChanged();
    showToast(`Marked "${payingItem.name}" as paid`);
    await loadData(false);
  };

  const handleUnpay = (item: CommitmentStatus) => {
    Alert.alert('Undo Payment?', `Mark "${item.name}" as unpaid for this month?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo Payment',
        style: 'destructive',
        onPress: async () => {
          try {
            await commitmentsApi.unpay(item.id, month);
            notifyCommitmentsChanged();
            showToast(`Marked "${item.name}" as unpaid`);
            await loadData(false);
          } catch {
            Alert.alert('Error', 'Failed to undo payment');
          }
        },
      },
    ]);
  };

  const handleDelete = (item: CommitmentStatus) => {
    Alert.alert('Delete Commitment', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await commitmentsApi.delete(item.id);
            notifyCommitmentsChanged();
            showToast('Commitment deleted');
            await loadData(false);
          } catch {
            Alert.alert('Error', 'Failed to delete commitment');
          }
        },
      },
    ]);
  };

  const renderCommitmentCard = (item: CommitmentStatus) => {
    const dueInfo = getDueInfo(item, month);
    const isEmi = item.nature === 'EMI_PAYMENT';
    const isPaid = item.status === 'PAID';

    return (
      <View
        key={item.id}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-2"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{item.name}</Text>
              {isEmi && (
                <View className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                  <Text className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">EMI</Text>
                </View>
              )}
              {dueInfo.badge && (
                <View
                  className={`px-1.5 py-0.5 rounded ${
                    dueInfo.urgency === 'overdue'
                      ? 'bg-red-100 dark:bg-red-900/40'
                      : 'bg-amber-100 dark:bg-amber-900/40'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-semibold ${
                      dueInfo.urgency === 'overdue'
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {dueInfo.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {dueInfo.label} · Due day {item.due_day}
            </Text>
          </View>

          <View className="items-end">
            <Text className="text-sm font-bold text-gray-900 dark:text-gray-100">
              ₹{item.amount.toLocaleString('en-IN')}
            </Text>
            {isEmi && item.principal_amount > 0 && (
              <Text className="text-[10px] text-gray-400">
                P: ₹{item.principal_amount.toLocaleString('en-IN')} + I: ₹{item.interest_amount.toLocaleString('en-IN')}
              </Text>
            )}
          </View>
        </View>

        {/* Card Footer Actions */}
        <View className="flex-row items-center justify-between pt-2 mt-2 border-t border-gray-100 dark:border-gray-700/60">
          <View className="flex-row items-center gap-2">
            {editMode && (
              <>
                <TouchableOpacity
                  onPress={() => router.push(`/commitments/${item.id}/edit` as any)}
                  className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/30"
                >
                  <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  className="px-2.5 py-1 rounded bg-red-50 dark:bg-red-900/30"
                >
                  <Text className="text-xs font-semibold text-red-600 dark:text-red-400">Del</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View className="ml-auto">
            {isPaid ? (
              <TouchableOpacity
                onPress={() => handleUnpay(item)}
                className="flex-row items-center gap-1 px-3 py-1 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                <Text className="text-xs font-semibold text-green-700 dark:text-green-300">Paid</Text>
              </TouchableOpacity>
            ) : item.status === 'DUE' ? (
              <TouchableOpacity
                onPress={() => setPayingItem(item)}
                className="px-4 py-1.5 bg-blue-600 dark:bg-blue-500 rounded-lg flex-row items-center gap-1 shadow-sm"
              >
                <Text className="text-xs font-semibold text-white">Pay</Text>
                <Ionicons name="chevron-forward" size={12} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <Text className="text-xs text-gray-400 italic">Inactive</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {showHeader && <ScreenHeader title="Monthly Commitments" />}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Month Selector */}
        <View className="flex-row items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 mb-4 shadow-xs">
          <TouchableOpacity
            onPress={() => setMonth((m) => shiftMonth(m, -1))}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700"
          >
            <Ionicons name="chevron-back" size={18} color="#4b5563" />
          </TouchableOpacity>

          <View className="items-center">
            <Text className="text-base font-bold text-gray-800 dark:text-gray-100">{monthLabel(month)}</Text>
            {month !== currentMonthKey() && (
              <TouchableOpacity onPress={() => setMonth(currentMonthKey())} className="mt-0.5">
                <Text className="text-xs text-blue-600 dark:text-blue-400 font-medium">Jump to Today</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setMonth((m) => shiftMonth(m, 1))}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700"
          >
            <Ionicons name="chevron-forward" size={18} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="py-12 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : (
          <>
            {/* Overview & Progress Card */}
            {data && totalCount > 0 && (
              <View className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
                <View className="flex-row items-baseline justify-between mb-2">
                  <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    ₹{data.paid_total.toLocaleString('en-IN')} / ₹{data.total.toLocaleString('en-IN')} paid
                  </Text>
                  <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {percentPaid}% ({paidCount}/{totalCount})
                  </Text>
                </View>

                {/* Progress Bar */}
                <View className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <View
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, percentPaid))}%` }}
                  />
                </View>

                {/* Stats Breakdown */}
                <View className="flex-row justify-between pt-3 mt-3 border-t border-gray-100 dark:border-gray-700">
                  <View className="items-center flex-1">
                    <Text className="text-[10px] text-gray-400 uppercase font-semibold">Total</Text>
                    <Text className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      ₹{data.total.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View className="items-center flex-1 border-x border-gray-100 dark:border-gray-700">
                    <Text className="text-[10px] text-gray-400 uppercase font-semibold">Paid</Text>
                    <Text className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{data.paid_total.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-[10px] text-gray-400 uppercase font-semibold">Remaining</Text>
                    <Text className="text-sm font-bold text-red-600 dark:text-red-400">
                      ₹{data.due_total.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {items.length === 0 ? (
              <View className="items-center justify-center py-16 px-4 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <Ionicons name="calendar-outline" size={48} color="#9ca3af" />
                <Text className="text-base font-semibold text-gray-700 dark:text-gray-300 mt-3">
                  No Commitments Yet
                </Text>
                <Text className="text-xs text-gray-400 text-center mt-1 max-w-xs">
                  Add recurring monthly bills, EMIs, and subscriptions to track due dates and payments effortlessly.
                </Text>
                {editMode && (
                  <TouchableOpacity
                    onPress={() => router.push('/commitments/new' as any)}
                    className="mt-4 px-4 py-2 bg-blue-600 rounded-lg"
                  >
                    <Text className="text-white text-xs font-semibold">+ Add Commitment</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {/* 1. OVERDUE */}
                {overdue.length > 0 && (
                  <View className="mb-4">
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <View className="w-2 h-2 rounded-full bg-red-500" />
                      <Text className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                        Overdue ({overdue.length})
                      </Text>
                    </View>
                    {overdue.map(renderCommitmentCard)}
                  </View>
                )}

                {/* 2. DUE SOON */}
                {dueSoon.length > 0 && (
                  <View className="mb-4">
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <View className="w-2 h-2 rounded-full bg-amber-500" />
                      <Text className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Due Soon ({dueSoon.length})
                      </Text>
                    </View>
                    {dueSoon.map(renderCommitmentCard)}
                  </View>
                )}

                {/* 3. UPCOMING */}
                {upcoming.length > 0 && (
                  <View className="mb-4">
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <View className="w-2 h-2 rounded-full bg-blue-500" />
                      <Text className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Upcoming ({upcoming.length})
                      </Text>
                    </View>
                    {upcoming.map(renderCommitmentCard)}
                  </View>
                )}

                {/* 4. PAID */}
                {paid.length > 0 && (
                  <View className="mb-4">
                    <TouchableOpacity
                      onPress={() => setCollapsePaid((c) => !c)}
                      className="flex-row items-center justify-between mb-2"
                    >
                      <View className="flex-row items-center gap-1.5">
                        <View className="w-2 h-2 rounded-full bg-emerald-500" />
                        <Text className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Paid ({paid.length})
                        </Text>
                      </View>
                      <Ionicons
                        name={collapsePaid ? 'chevron-down' : 'chevron-up'}
                        size={16}
                        color="#6b7280"
                      />
                    </TouchableOpacity>
                    {!collapsePaid && paid.map(renderCommitmentCard)}
                  </View>
                )}

                {/* 5. INACTIVE */}
                {inactive.length > 0 && (
                  <View className="mb-4">
                    <TouchableOpacity
                      onPress={() => setCollapseInactive((c) => !c)}
                      className="flex-row items-center justify-between mb-2"
                    >
                      <View className="flex-row items-center gap-1.5">
                        <View className="w-2 h-2 rounded-full bg-gray-400" />
                        <Text className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Inactive ({inactive.length})
                        </Text>
                      </View>
                      <Ionicons
                        name={collapseInactive ? 'chevron-down' : 'chevron-up'}
                        size={16}
                        color="#6b7280"
                      />
                    </TouchableOpacity>
                    {!collapseInactive && inactive.map(renderCommitmentCard)}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB to Add Commitment in Edit Mode */}
      {editMode && <FAB onPress={() => router.push('/commitments/new' as any)} />}

      {/* Payment Sheet */}
      <CommitmentPaySheet
        visible={Boolean(payingItem)}
        onClose={() => setPayingItem(null)}
        item={payingItem}
        month={month}
        onConfirm={handlePayConfirm}
      />
    </View>
  );
}
