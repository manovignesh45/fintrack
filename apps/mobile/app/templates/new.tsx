import { useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { templatesApi } from '@/src/api/client';
import TransactionForm from '@/src/components/TransactionForm';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useToast } from '@/src/context/ToastContext';
import type { TransactionFormData } from '@fintrack/shared';

export default function CreateTemplateScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);

  const handleSubmit = async (form: TransactionFormData) => {
    await templatesApi.create({
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      nature: form.nature,
      source_account_id: parseInt(form.source_account_id),
      target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
      sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
      
      payment_method_id: form.payment_method_id ? parseInt(form.payment_method_id) : undefined,
      principal_amount: parseFloat(form.principal_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
    });
    showToast('Template saved');
    router.back();
  };

  return (
    <FormScreen
      ref={scrollRef}
      header={<ScreenHeader title="Create Template" />}
    >
      <TransactionForm scrollRef={scrollRef} onSubmit={handleSubmit} submitLabel="Save Template" />
    </FormScreen>
  );
}
