import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { transactionRepo, syncQueue } from '@/src/db/transactionRepo';
import { useSyncStore } from '@/src/store/syncStore';
import type { TransactionFormData } from '@fintrack/shared';
import type { CreateTransactionPayload } from '@/src/db/localTypes';
import TransactionForm from '@/src/components/TransactionForm';

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formToPayload(form: TransactionFormData): CreateTransactionPayload {
  return {
    title: form.title,
    amount: parseFloat(form.amount),
    nature: form.nature,
    source_account_id: parseInt(form.source_account_id) || 0,
    target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
    sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
    
    payment_method: form.payment_method || undefined,
    notes: form.notes || undefined,
    principal_amount: parseFloat(form.principal_amount) || 0,
    interest_amount: parseFloat(form.interest_amount) || 0,
    transaction_date: form.transaction_date,
  };
}

export default function AddTransactionScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ template?: string }>();
  const initialData = params.template ? JSON.parse(params.template) as TransactionFormData : undefined;

  const handleSubmit = async (form: TransactionFormData) => {
    const localId = generateLocalId();
    const payload = formToPayload(form);

    // Always write to SQLite first — works offline
    await transactionRepo.insertPending(db, localId, payload);
    await syncQueue.enqueue(db, localId, 'CREATE', payload);

    // Attempt immediate sync if online (fire-and-forget)
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      useSyncStore.getState().setIsSyncing(true);
      import('@/src/sync/syncEngine').then(({ syncPendingTransactions }) => {
        syncPendingTransactions(db)
          .then((result) => {
            useSyncStore.getState().setPendingCount(result.remaining);
            useSyncStore.getState().setLastSyncAt(new Date());
          })
          .catch(() => {})
          .finally(() => {
            useSyncStore.getState().setIsSyncing(false);
          });
      });
    } else {
      const pending = await syncQueue.countPending(db);
      useSyncStore.getState().setPendingCount(pending);
    }

    router.back();
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-2">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#4b5563" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Add Transaction</Text>
      </View>
      <TransactionForm initial={initialData} onSubmit={handleSubmit} submitLabel="Add Transaction" />
    </View>
  );
}
