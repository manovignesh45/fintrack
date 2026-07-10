import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paymentMethodsApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { KeyboardScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { FAB } from '@/src/components/ui/FAB';
import { EditToggle } from '@/src/components/ui/EditToggle';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ErrorState } from '@/src/components/ui/ErrorState';
import { useToast } from '@/src/context/ToastContext';
import type { PaymentMethod } from '@fintrack/shared';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { editMode, setEditMode } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = (mode: 'load' | 'refresh' = 'load') => {
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    setError(null);
    paymentMethodsApi.list()
      .then((data) => setPaymentMethods(data || []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load payment methods'))
      .finally(() => (mode === 'refresh' ? setRefreshing(false) : setLoading(false)));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (id: number) => {
    Alert.alert('Delete', 'Delete this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await paymentMethodsApi.delete(id); showToast('Payment method deleted'); load(); }
        catch { Alert.alert('Error', 'Failed to delete. It might be in use.'); }
      }},
    ]);
  };

  const handleAddSubmit = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await paymentMethodsApi.create({ name: newName.trim() });
      showToast('Payment method added');
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
    <KeyboardScreen>
      <ScreenHeader 
        title="Payment Methods" 
        right={<EditToggle value={editMode} onValueChange={setEditMode} />} 
      />
      <ScrollView
        contentContainerClassName="p-4 pb-24"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      >

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="py-4" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load()} />
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
              <EmptyState icon="card-outline" title="No payment methods yet" subtitle={editMode ? 'Tap + to add one' : undefined} />
            )}

            {isAdding && (
              <View className="flex-row items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Method Name (e.g. Credit Card)"
                  placeholderTextColor="#9ca3af"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddSubmit}
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
        <FAB onPress={() => { setIsAdding(true); setNewName(''); }} accessibilityLabel="Add payment method" />
      )}
    </KeyboardScreen>
  );
}
