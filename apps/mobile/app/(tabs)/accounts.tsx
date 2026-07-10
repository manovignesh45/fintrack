import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { accountsApi } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import type { Account } from '@fintrack/shared';

export default function AccountsScreen() {
  const router = useRouter();
  const { editMode } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('0');
  const [newInterestRate, setNewInterestRate] = useState('0');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    accountsApi.list({ type: 'LIABILITY' })
      .then((data) => setAccounts(data || []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await accountsApi.list({ type: 'LIABILITY' });
      setAccounts(data || []);
    } catch {
      // keep existing data on network failure
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const liabilities = accounts.filter((a) => a.type === 'LIABILITY');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await accountsApi.create({
        name: newName,
        type: 'LIABILITY',
        initial_balance: parseFloat(newBalance) || 0,
        interest_rate: parseFloat(newInterestRate) || 0,
      });
      setNewName('');
      setNewBalance('0');
      setNewInterestRate('0');
      setShowAdd(false);
      load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (a: Account) => {
    try {
      await accountsApi.update(a.id, { is_active: !a.is_active });
      load();
    } catch {
      Alert.alert('Error', 'Failed to update');
    }
  };

  const handleDelete = (a: Account) => {
    Alert.alert('Delete', `Delete "${a.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await accountsApi.delete(a.id);
            load();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item: a }: { item: Account }) => (
    <TouchableOpacity
      onPress={() => router.push(`/accounts/${a.id}`)}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2 mx-4 ${!a.is_active ? 'opacity-50' : ''}`}
      activeOpacity={0.7}
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <Text className="font-medium text-gray-800 dark:text-gray-100 text-sm">{a.name}</Text>
          {editMode && (
            <TouchableOpacity
              onPress={() => handleDelete(a)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={14} color="#d1d5db" />
            </TouchableOpacity>
          )}
        </View>
        <Text className="font-semibold text-orange-600">
          Outstanding: ₹{a.current_balance.toLocaleString('en-IN')}
        </Text>
      </View>
      <View className="flex-row justify-between items-center mt-2">
        <View className="flex-row gap-3">
          <Text className="text-xs text-gray-400 dark:text-gray-500">Total: ₹{a.initial_balance.toLocaleString('en-IN')}</Text>
          {a.interest_rate > 0 && (
            <Text className="text-xs font-medium text-orange-500">{a.interest_rate}% p.a.</Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{a.is_active ? 'Active' : 'Inactive'}</Text>
          <Switch
            value={a.is_active}
            onValueChange={() => handleToggle(a)}
            trackColor={{ false: '#d1d5db', true: '#2563eb' }}
            thumbColor="white"
            style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={liabilities}
          keyExtractor={(a) => a.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={
            <View className="px-4 pb-2 pt-2">
              <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Loan Accounts</Text>
              {showAdd && editMode && (
                <View className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mt-3 gap-2">
                  <TextInput
                    placeholder="Loan name (e.g. SBI Home Loan)"
                    value={newName}
                    onChangeText={setNewName}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
                  />
                  <View>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Total Loan Amount (₹)</Text>
                    <TextInput
                      placeholder="e.g. 200000"
                      value={newBalance}
                      onChangeText={setNewBalance}
                      keyboardType="decimal-pad"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
                    />
                  </View>
                  <View>
                    <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Interest Rate (% per year)</Text>
                    <TextInput
                      placeholder="e.g. 12.5"
                      value={newInterestRate}
                      onChangeText={setNewInterestRate}
                      keyboardType="decimal-pad"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleAdd}
                    disabled={saving}
                    className={`w-full py-2 rounded items-center ${saving ? 'bg-blue-400' : 'bg-blue-600 dark:bg-blue-50 dark:bg-blue-900/20'}`}
                  >
                    <Text className="text-white text-sm font-medium">{saving ? 'Adding...' : 'Add Loan Account'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowAdd(false)}
                    className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded items-center"
                  >
                    <Text className="text-gray-600 dark:text-gray-300 text-sm font-medium">Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <Text className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No loan accounts yet.</Text>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {editMode && (
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 dark:bg-blue-50 dark:bg-blue-900/20 rounded-full shadow-lg items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
}
