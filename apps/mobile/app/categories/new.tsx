import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesApi } from '@/src/api/client';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { Button } from '@/src/components/ui/Button';
import { useToast } from '@/src/context/ToastContext';
import type { TxNature } from '@fintrack/shared';

export default function CreateCategoryScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ nature?: string }>();
  const [name, setName] = useState('');
  const [nature, setNature] = useState<TxNature>((params.nature as TxNature) || 'EXPENSE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await categoriesApi.create({ name: name.trim(), nature });
      showToast('Category created');
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen
      contentContainerClassName="p-4"
      header={
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#4b5563" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Create Category</Text>
        </View>
      }
    >
      {error ? (
        <View className="bg-red-50 p-3 rounded-lg mb-4">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      ) : null}


      {/* Nature */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Transaction Type *</Text>
        <View className="flex-row gap-2">
          {(['EXPENSE', 'INCOME'] as TxNature[]).map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setNature(n)}
              className={`flex-1 py-2 rounded-lg items-center ${
                nature === n ? 'bg-orange-600' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600'
              }`}
            >
              <Text className={`text-sm font-medium ${nature === n ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Name */}
      <View className="mb-6">
        <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Category Name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Groceries, Shopping"
          placeholderTextColor="#9ca3af"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
        />
      </View>

      <Button title={submitting ? 'Creating...' : 'Create Category'} onPress={handleSubmit} loading={submitting} />
    </FormScreen>
  );
}
