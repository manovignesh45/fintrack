import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { templatesApi } from '@/src/api/client';
import TransactionForm from '@/src/components/TransactionForm';
import type { TransactionFormData } from '@fintrack/shared';

export default function CreateTemplateScreen() {
  const router = useRouter();

  const handleSubmit = async (form: TransactionFormData) => {
    await templatesApi.create({
      title: form.title,
      amount: parseFloat(form.amount) || 0,
      nature: form.nature,
      source_account_id: parseInt(form.source_account_id),
      target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
      sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
      entity: form.entity,
      payment_method: form.payment_method || undefined,
      principal_amount: parseFloat(form.principal_amount) || 0,
      interest_amount: parseFloat(form.interest_amount) || 0,
    });
    router.back();
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-2">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#4b5563" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800">Create Template</Text>
      </View>
      <TransactionForm onSubmit={handleSubmit} submitLabel="Save Template" />
    </View>
  );
}
