import { useEffect, useState, useCallback } from 'react';
import { View, Text, SectionList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { templatesApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import type { TransactionTemplate } from '@fintrack/shared';

const natureLabels: Record<string, string> = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  TRANSFER: 'Transfer',
  EMI_PAYMENT: 'EMI',
  LOAN_DISBURSEMENT: 'Loan',
};

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { editMode } = useAuth();

  const load = () => {
    setLoading(true);
    templatesApi.list()
      .then((data) => setTemplates(data || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await templatesApi.list();
      setTemplates(data || []);
    } catch {
      // keep existing data on network failure
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleUse = (t: TransactionTemplate) => {
    router.push({
      pathname: '/add',
      params: {
        template: JSON.stringify({
          title: t.title,
          amount: t.amount.toString(),
          nature: t.nature,
          source_account_id: t.source_account_id.toString(),
          target_account_id: t.target_account_id?.toString() || '',
          sub_category_id: t.sub_category_id?.toString() || '',
          payment_method: t.payment_method || '',
          principal_amount: t.principal_amount.toString(),
          interest_amount: t.interest_amount.toString(),
          transaction_date: new Date().toISOString().split('T')[0],
        }),
      },
    });
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete', 'Delete this template?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await templatesApi.delete(id);
            load();
          } catch {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item: t }: { item: TransactionTemplate }) => (
    <View className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2 mx-4">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="font-medium text-gray-800 dark:text-gray-100 text-sm">{t.title}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {natureLabels[t.nature] ?? t.nature} · ₹{t.amount.toLocaleString('en-IN')}
            {t.payment_method ? ` · ${t.payment_method}` : ''}
          </Text>
        </View>
        <View className="flex-row gap-2 ml-3">
          <TouchableOpacity
            onPress={() => handleUse(t)}
            className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 rounded"
          >
            <Text className="text-white text-xs font-medium">Use</Text>
          </TouchableOpacity>
          {editMode && (
            <TouchableOpacity
              onPress={() => handleDelete(t.id)}
              className="px-3 py-1.5 bg-red-100 rounded"
            >
              <Text className="text-red-600 text-xs font-medium">Del</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <SectionList
          sections={Object.entries(
            templates.reduce((acc, t) => {
              const group = natureLabels[t.nature] || t.nature;
              if (!acc[group]) acc[group] = [];
              acc[group].push(t);
              return acc;
            }, {} as Record<string, TransactionTemplate[]>)
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([title, data]) => ({ title, data }))}
          keyExtractor={(t) => t.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <View className="px-4 py-2 mt-2">
              <Text className="text-xs font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">{title}</Text>
            </View>
          )}
          ListHeaderComponent={
            <View className="px-4 pb-2 pt-2">
              <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Templates</Text>
            </View>
          }
          ListEmptyComponent={
            <Text className="text-gray-400 dark:text-gray-500 text-center py-8">
              No templates yet. Create one or save from the transaction form.
            </Text>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {editMode && (
        <TouchableOpacity
          onPress={() => router.push('/templates/new')}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 dark:bg-blue-500 rounded-full shadow-lg items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}
