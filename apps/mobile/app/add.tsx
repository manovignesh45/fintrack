import { useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { transactionsApi } from '@/src/api/client';
import type { TransactionFormData } from '@fintrack/shared';
import TransactionForm from '@/src/components/TransactionForm';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
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
      header={<ScreenHeader title="Add Transaction" />}
    >
      <TransactionForm scrollRef={scrollRef} initial={initialData} onSubmit={handleSubmit} submitLabel="Add Transaction" />
    </FormScreen>
  );
}
