import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesApi } from '@/src/api/client';
import type { TxNature } from '@fintrack/shared';

export default function CreateCategoryScreen() {
  const router = useRouter();
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
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900" contentContainerClassName="p-4" keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center gap-3 mb-6">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#4b5563" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Create Category</Text>
      </View>

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
          autoFocus
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
        />
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        className={`w-full py-3 rounded-lg items-center ${submitting ? 'bg-blue-400' : 'bg-blue-600 dark:bg-blue-500'}`}
      >
        <Text className="text-white font-semibold">{submitting ? 'Creating...' : 'Create Category'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
