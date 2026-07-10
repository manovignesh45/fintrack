import { useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { transactionsApi } from '@/src/api/client';
import type { TransactionFormData } from '@fintrack/shared';
import TransactionForm from '@/src/components/TransactionForm';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { useToast } from '@/src/context/ToastContext';

function formToPayload(form: TransactionFormData) {
  return {
    title: form.title,
    amount: parseFloat(form.amount),
    nature: form.nature,
    source_account_id: parseInt(form.source_account_id) || 0,
    target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
    sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
    
    payment_method_id: form.payment_method_id ? parseInt(form.payment_method_id) : undefined,
    notes: form.notes || undefined,
    principal_amount: parseFloat(form.principal_amount) || 0,
    interest_amount: parseFloat(form.interest_amount) || 0,
    transaction_date: form.transaction_date,
  };
}

export default function AddTransactionScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ template?: string }>();
  const initialData = params.template ? JSON.parse(params.template) as TransactionFormData : undefined;

  const handleSubmit = async (form: TransactionFormData) => {
    const payload = formToPayload(form);
    await transactionsApi.create(payload);
    showToast('Transaction added');
    router.back();
  };

  return (
    <FormScreen
      ref={scrollRef}
      header={
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#4b5563" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Add Transaction</Text>
        </View>
      }
    >
      <TransactionForm scrollRef={scrollRef} initial={initialData} onSubmit={handleSubmit} submitLabel="Add Transaction" />
    </FormScreen>
  );
}
