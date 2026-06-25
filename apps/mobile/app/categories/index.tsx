import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { categoriesApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import type { Category, EntityType, TxNature } from '@fintrack/shared';
import { ENTITIES } from '@fintrack/shared';

export default function CategoriesScreen() {
  const router = useRouter();
  const { editMode } = useAuth();
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('PERSONAL');
  const [selectedNature, setSelectedNature] = useState<TxNature>('EXPENSE');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingSubFor, setAddingSubFor] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    categoriesApi.list({ entity: selectedEntity, nature: selectedNature })
      .then((data) => setCategories(data || []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [selectedEntity, selectedNature]);

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
    <View className="flex-1 bg-gray-50">
      <ScrollView contentContainerClassName="p-4 pb-24">
        <View className="flex-row items-center gap-3 mb-4">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#4b5563" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">Categories</Text>
        </View>

        {/* Entity tabs */}
        <View className="flex-row gap-2 mb-3">
          {ENTITIES.map((e) => (
            <TouchableOpacity
              key={e}
              onPress={() => setSelectedEntity(e)}
              className={`flex-1 py-1.5 rounded-lg items-center ${
                selectedEntity === e ? 'bg-blue-600' : 'bg-white border border-gray-300'
              }`}
            >
              <Text className={`text-sm font-medium ${selectedEntity === e ? 'text-white' : 'text-gray-600'}`}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Nature tabs */}
        <View className="flex-row gap-2 mb-4">
          {(['EXPENSE', 'INCOME'] as TxNature[]).map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setSelectedNature(n)}
              className={`flex-1 py-1.5 rounded-lg items-center ${
                selectedNature === n ? 'bg-orange-600' : 'bg-white border border-gray-300'
              }`}
            >
              <Text className={`text-sm font-medium ${selectedNature === n ? 'text-white' : 'text-gray-600'}`}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="py-4" />
        ) : categories.length === 0 ? (
          <Text className="text-gray-400 text-center py-4">No categories yet</Text>
        ) : (
          <View className="gap-3">
            {categories.map((cat) => (
              <View key={cat.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Category header */}
                <View className="flex-row justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <Text className="font-bold text-gray-800 text-sm italic">{cat.name}</Text>
                  <View className="flex-row gap-3">
                    {editMode && (
                      <TouchableOpacity
                        onPress={() => { setAddingSubFor(cat.id); setNewSubName(''); }}
                        className="bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100"
                      >
                        <Text className="text-xs font-semibold text-blue-600">+ Sub</Text>
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
                  <Text className="px-5 py-3 text-xs text-gray-400 italic">No sub-categories</Text>
                ) : (
                  (cat.sub_categories ?? []).map((sc) => (
                    <View key={sc.id} className="flex-row justify-between items-center px-5 py-2.5 border-b border-gray-50">
                      <Text className="text-sm text-gray-600 font-medium">{sc.name}</Text>
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
                  <View className="flex-row items-center gap-2 px-4 py-2.5 bg-blue-50">
                    <TextInput
                      value={newSubName}
                      onChangeText={setNewSubName}
                      placeholder="Sub-category name"
                      autoFocus
                      className="flex-1 px-2.5 py-1.5 border border-blue-300 rounded-md text-sm bg-white"
                    />
                    <TouchableOpacity
                      onPress={() => handleSubSubmit(cat.id)}
                      disabled={subSubmitting || !newSubName.trim()}
                      className={`px-3 py-1.5 rounded-md ${subSubmitting || !newSubName.trim() ? 'bg-blue-400' : 'bg-blue-600'}`}
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
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/categories/new',
            params: { entity: selectedEntity, nature: selectedNature },
          })}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}
