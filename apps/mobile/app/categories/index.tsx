import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { useLedgers } from '@/src/context/LedgerContext';
import { KeyboardScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { FAB } from '@/src/components/ui/FAB';
import { EditToggle } from '@/src/components/ui/EditToggle';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import type { Category, TxNature } from '@fintrack/shared';

export default function CategoriesScreen() {
  const router = useRouter();
  const { editMode, setEditMode } = useAuth();
  const { activeLedgerId } = useLedgers();
  const [selectedNature, setSelectedNature] = useState<TxNature>('EXPENSE');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingSubFor, setAddingSubFor] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);

  const load = (mode: 'load' | 'refresh' = 'load') => {
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    setError(null);
    categoriesApi.list({ nature: selectedNature })
      .then((data) => setCategories(data || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load categories'))
      .finally(() => (mode === 'refresh' ? setRefreshing(false) : setLoading(false)));
  };

  useEffect(() => { load(); }, [selectedNature, activeLedgerId]);

  const deleteCategory = (id: number) => {
    Alert.alert('Delete', 'Delete category and all its sub-categories?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await categoriesApi.delete(id); load(); }
        catch { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  const deleteSubCategory = (categoryId: number, subId: number) => {
    Alert.alert('Delete', 'Delete this sub-category?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await categoriesApi.deleteSub(categoryId, subId); load(); }
        catch { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  const handleSubSubmit = async (catId: number) => {
    if (!newSubName.trim()) return;
    setSubSubmitting(true);
    try {
      await categoriesApi.createSub(catId, { name: newSubName.trim() });
      setAddingSubFor(null);
      setNewSubName('');
      load();
    } catch {
      Alert.alert('Error', 'Failed to create sub-category');
    } finally {
      setSubSubmitting(false);
    }
  };

  return (
    <KeyboardScreen>
      <ScreenHeader 
        title="Categories" 
        right={<EditToggle value={editMode} onValueChange={setEditMode} />} 
      />
      <ScrollView
        contentContainerClassName="p-4 pb-24"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      >



        {/* Nature tabs */}
        <View className="flex-row gap-2 mb-4">
          {(['EXPENSE', 'INCOME'] as TxNature[]).map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setSelectedNature(n)}
              className={`flex-1 py-1.5 rounded-lg items-center ${
                selectedNature === n ? 'bg-orange-600' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600'
              }`}
            >
              <Text className={`text-sm font-medium ${selectedNature === n ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="py-4" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : categories.length === 0 ? (
          <EmptyState icon="pricetags-outline" title="No categories yet" subtitle={editMode ? 'Tap + to add one' : undefined} />
        ) : (
          <View className="gap-3">
            {categories.map((cat) => (
              <View key={cat.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Category header */}
                <View className="flex-row justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                  <Text className="font-bold text-gray-800 dark:text-gray-100 text-sm italic">{cat.name}</Text>
                  <View className="flex-row gap-3">
                    {editMode && (
                      <TouchableOpacity
                        onPress={() => { setAddingSubFor(cat.id); setNewSubName(''); }}
                        className="bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-md border border-blue-100"
                      >
                        <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">+ Sub</Text>
                      </TouchableOpacity>
                    )}
                    {editMode && (
                      <TouchableOpacity onPress={() => deleteCategory(cat.id)}>
                        <Text className="text-xs text-red-500 font-medium">Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Sub-categories */}
                {(cat.sub_categories ?? []).length === 0 && addingSubFor !== cat.id ? (
                  <Text className="px-5 py-3 text-xs text-gray-400 dark:text-gray-500 italic">No sub-categories</Text>
                ) : (
                  (cat.sub_categories ?? []).map((sc) => (
                    <View key={sc.id} className="flex-row justify-between items-center px-5 py-2.5 border-b border-gray-50">
                      <Text className="text-sm text-gray-600 dark:text-gray-300 font-medium">{sc.name}</Text>
                      {editMode && (
                        <TouchableOpacity onPress={() => deleteSubCategory(cat.id, sc.id)}>
                          <Ionicons name="close" size={14} color="#fca5a5" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}

                {/* Inline add sub-category */}
                {addingSubFor === cat.id && (
                  <View className="flex-row items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20">
                    <TextInput
                      value={newSubName}
                      onChangeText={setNewSubName}
                      placeholder="Sub-category name"
                      placeholderTextColor="#9ca3af"
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => handleSubSubmit(cat.id)}
                      className="flex-1 px-2.5 py-1.5 border border-blue-300 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <TouchableOpacity
                      onPress={() => handleSubSubmit(cat.id)}
                      disabled={subSubmitting || !newSubName.trim()}
                      className={`px-3 py-1.5 rounded-md ${subSubmitting || !newSubName.trim() ? 'bg-blue-400' : 'bg-blue-600 dark:bg-blue-500'}`}
                    >
                      <Text className="text-xs text-white font-semibold">{subSubmitting ? '...' : 'Add'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAddingSubFor(null)}>
                      <Ionicons name="close" size={16} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {editMode && (
        <FAB
          onPress={() => router.push({ pathname: '/categories/new', params: { nature: selectedNature } })}
          accessibilityLabel="Add category"
        />
      )}
    </KeyboardScreen>
  );
}
