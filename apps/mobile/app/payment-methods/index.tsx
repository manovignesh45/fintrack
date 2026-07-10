import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paymentMethodsApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import type { PaymentMethod } from '@fintrack/shared';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { editMode, setEditMode } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    paymentMethodsApi.list()
      .then((data) => setPaymentMethods(data || []))
      .catch(() => setPaymentMethods([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (id: number) => {
    Alert.alert('Delete', 'Delete this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await paymentMethodsApi.delete(id); load(); }
        catch { Alert.alert('Error', 'Failed to delete. It might be in use.'); }
      }},
    ]);
  };

  const handleAddSubmit = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await paymentMethodsApi.create({ name: newName.trim() });
      setIsAdding(false);
      setNewName('');
      load();
    } catch {
      Alert.alert('Error', 'Failed to create payment method');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <ScrollView contentContainerClassName="p-4 pb-24">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
              <Ionicons name="arrow-back" size={20} color="#3b82f6" />
              <Text className="text-lg font-semibold text-blue-600 dark:text-blue-400 ml-1">More</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500">›</Text>
            <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Payment Methods</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs text-gray-500 dark:text-gray-400">Edit</Text>
            <TouchableOpacity
              onPress={() => setEditMode(!editMode)}
              className={`w-9 h-5 rounded-full justify-center ${editMode ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-300'}`}
            >
              <View className={`w-4 h-4 bg-white dark:bg-gray-800 rounded-full ${editMode ? 'ml-[18px]' : 'ml-0.5'}`} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="py-4" />
        ) : (
          <View className="gap-3">
            {paymentMethods.map((pm) => (
              <View key={pm.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-row justify-between items-center px-4 py-3 shadow-sm">
                <Text className="font-medium text-gray-800 dark:text-gray-100 text-base">{pm.name}</Text>
                {editMode && (
                  <TouchableOpacity onPress={() => handleDelete(pm.id)}>
                    <Text className="text-xs text-red-500 font-medium">Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {paymentMethods.length === 0 && !isAdding && (
              <Text className="text-gray-400 dark:text-gray-500 text-center py-4">No payment methods yet</Text>
            )}

            {isAdding && (
              <View className="flex-row items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Method Name (e.g. Credit Card)"
                  placeholderTextColor="#9ca3af"
                  autoFocus
                  className="flex-1 px-2.5 py-1.5 border border-blue-300 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-white"
                />
                <TouchableOpacity
                  onPress={handleAddSubmit}
                  disabled={submitting || !newName.trim()}
                  className={`px-3 py-1.5 rounded-md ${submitting || !newName.trim() ? 'bg-blue-400' : 'bg-blue-600 dark:bg-blue-500'}`}
                >
                  <Text className="text-xs text-white font-semibold">{submitting ? '...' : 'Add'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsAdding(false)} className="px-2">
                  <Ionicons name="close" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {editMode && !isAdding && (
        <TouchableOpacity
          onPress={() => { setIsAdding(true); setNewName(''); }}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 dark:bg-blue-500 rounded-full shadow-lg items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}
