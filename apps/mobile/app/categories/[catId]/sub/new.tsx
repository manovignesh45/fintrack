import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesApi } from '@/src/api/client';
import type { Category } from '@fintrack/shared';

export default function CreateSubCategoryScreen() {
  const router = useRouter();
  const { catId } = useLocalSearchParams<{ catId: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!catId) return;
    categoriesApi.list()
      .then((cats) => {
        const cat = cats.find((c: Category) => c.id === parseInt(catId));
        if (cat) setCategory(cat);
        else setError('Category not found');
      })
      .catch(() => setError('Failed to load category'))
      .finally(() => setLoading(false));
  }, [catId]);

  const handleSubmit = async () => {
    if (!name.trim() || !catId) return;
    setSubmitting(true);
    setError('');
    try {
      await categoriesApi.createSub(parseInt(catId), { name: name.trim() });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sub-category');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!category) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-red-500">{error || 'Not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900" contentContainerClassName="p-4" keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center gap-3 mb-6">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#4b5563" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Create Sub-category</Text>
      </View>

      {/* Parent category info */}
      <View className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 mb-4">
        <Text className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1 uppercase">Parent Category</Text>
        <Text className="text-sm font-bold text-blue-800">{category.name}</Text>
        <View className="flex-row gap-2 mt-2">
          <View className="bg-blue-100 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase">{category.entity}</Text>
          </View>
          <View className="bg-orange-100 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] text-orange-700 font-bold uppercase">{category.nature}</Text>
          </View>
        </View>
      </View>

      {error ? (
        <View className="bg-red-50 p-3 rounded-lg mb-4">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      ) : null}

      <View className="mb-6">
        <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Sub-category Name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Milk, Fruits, Clothes"
          autoFocus
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
        />
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        className={`w-full py-3 rounded-lg items-center ${submitting ? 'bg-blue-400' : 'bg-blue-600 dark:bg-blue-50 dark:bg-blue-900/200'}`}
      >
        <Text className="text-white font-semibold">{submitting ? 'Creating...' : 'Create Sub-category'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
