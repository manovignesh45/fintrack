import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { transactionsApi } from '@/src/api/client';
import TransactionForm from '@/src/components/TransactionForm';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useToast } from '@/src/context/ToastContext';
import type { Transaction, TransactionFormData } from '@fintrack/shared';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [initial, setInitial] = useState<TransactionFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    transactionsApi
      .get(parseInt(id))
      .then((t: Transaction) => {
        setInitial({
          title: t.title,
          amount: t.amount.toString(),
          nature: t.nature,
          source_account_id: t.source_account_id.toString(),
          target_account_id: t.target_account_id?.toString() ?? '',
          sub_category_id: t.sub_category_id?.toString() ?? '',
          payment_method_id: t.payment_method_id?.toString() ?? '',
          notes: t.notes ?? '',
          principal_amount: t.principal_amount.toString(),
          interest_amount: t.interest_amount.toString(),
          transaction_date: t.transaction_date,
        });
      })
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (form: TransactionFormData) => {
    if (!id) return;
    await transactionsApi.update(parseInt(id), {
      title: form.title,
      amount: parseFloat(form.amount),
      nature: form.nature,
      source_account_id: parseInt(form.source_account_id) || 1,
      target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
      sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
      
      payment_method_id: form.payment_method_id ? parseInt(form.payment_method_id) : undefined,
      notes: form.notes || undefined,
      principal_amount: parseFloat(form.principal_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
      transaction_date: form.transaction_date,
    });
    showToast('Transaction updated');
    router.back();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!initial) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-red-500">Transaction not found</Text>
      </View>
    );
  }

  return (
    <FormScreen
      ref={scrollRef}
      header={<ScreenHeader title="Edit Transaction" />}
    >
      <TransactionForm scrollRef={scrollRef} initial={initial} onSubmit={handleSubmit} submitLabel="Update Transaction" />
    </FormScreen>
  );
}
