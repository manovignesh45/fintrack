import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { templatesApi } from '@/src/api/client';
import TransactionForm from '@/src/components/TransactionForm';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useToast } from '@/src/context/ToastContext';
import type { TransactionTemplate, TransactionFormData } from '@fintrack/shared';

export default function EditTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const [initial, setInitial] = useState<TransactionFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    templatesApi
      .get(parseInt(id, 10))
      .then((t: TransactionTemplate) => {
        setInitial({
          title: t.title,
          amount: t.amount.toString(),
          nature: t.nature,
          source_account_id: t.source_account_id.toString(),
          target_account_id: t.target_account_id?.toString() ?? '',
          sub_category_id: t.sub_category_id?.toString() ?? '',
          payment_method_id: t.payment_method_id?.toString() ?? '',
          notes: '',
          principal_amount: t.principal_amount.toString(),
          interest_amount: t.interest_amount.toString(),
          transaction_date: new Date().toISOString().split('T')[0],
          warranty_until: '',
          warranty_notes: '',
          tag_ids: [],
        });
      })
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleSubmit = async (form: TransactionFormData) => {
    if (!id) return;
    await templatesApi.update(parseInt(id, 10), {
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      nature: form.nature,
      source_account_id: parseInt(form.source_account_id, 10) || 1,
      target_account_id: form.target_account_id ? parseInt(form.target_account_id, 10) : undefined,
      sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id, 10) : undefined,
      payment_method_id: form.payment_method_id ? parseInt(form.payment_method_id, 10) : undefined,
      principal_amount: parseFloat(form.principal_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
    });
    showToast('Template updated');
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
        <Text className="text-red-500">Template not found</Text>
      </View>
    );
  }

  return (
    <FormScreen
      ref={scrollRef}
      header={<ScreenHeader title="Edit Template" />}
    >
      <TransactionForm
        scrollRef={scrollRef}
        initial={initial}
        onSubmit={handleSubmit}
        submitLabel="Update Template"
      />
    </FormScreen>
  );
}
