import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { accountsApi, tallyApi } from '@/src/api/client';
import type { Account, TallyResponse } from '@fintrack/shared';

export default function TallyScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actualBalance, setActualBalance] = useState('');
  const [result, setResult] = useState<TallyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    accountsApi.list({ type: 'LIABILITY' }).then((a) => {
      const list = a || [];
      setAccounts(list);
      if (list.length > 0) setSelectedId(list[0].id);
    }).catch(() => setAccounts([]));
  }, []);

  const handleCheck = async () => {
    if (!selectedId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await tallyApi.check(selectedId, parseFloat(actualBalance));
      setResult(res);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900" contentContainerClassName="p-4 pb-8" keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center gap-2 mb-4">
        <TouchableOpacity onPress={() => router.back()} className="flex-row items-center">
          <Ionicons name="arrow-back" size={20} color="#3b82f6" />
          <Text className="text-lg font-semibold text-blue-600 dark:text-blue-400 ml-1">More</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-400 dark:text-gray-500">›</Text>
        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100">Loan Reconciliation</Text>
      </View>

      <Text className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">
        Compare FinTrack's outstanding balance with your lender's actual statement.
      </Text>

      <View className="gap-3">
        <View className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
          <Picker
            selectedValue={selectedId}
            onValueChange={(v) => { setSelectedId(v); setResult(null); }}
          >
            {accounts.map((a) => (
              <Picker.Item key={a.id} label={a.name} value={a.id} />
            ))}
          </Picker>
        </View>

        <TextInput
          placeholder="Enter outstanding balance from lender's statement (₹)"
          value={actualBalance}
          onChangeText={setActualBalance}
          keyboardType="decimal-pad"
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
        />

        <TouchableOpacity
          onPress={handleCheck}
          disabled={loading}
          className={`w-full py-3 rounded-lg items-center ${loading ? 'bg-blue-400' : 'bg-blue-600 dark:bg-blue-50 dark:bg-blue-900/20'}`}
        >
          <Text className="text-white font-medium">{loading ? 'Checking...' : 'Check Tally'}</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <View className={`rounded-lg border p-4 gap-2 mt-4 ${
          result.difference === 0 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
        }`}>
          <Text className="font-semibold text-gray-800 dark:text-gray-100">{result.account_name}</Text>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">FinTrack Outstanding</Text>
              <Text className="font-medium">₹{result.calculated_balance.toLocaleString('en-IN')}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">Lender's Statement</Text>
              <Text className="font-medium">₹{result.actual_balance.toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <Text className={`text-sm font-semibold ${
            result.difference === 0
              ? 'text-green-700'
              : result.difference > 0
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-red-700'
          }`}>
            {result.difference === 0
              ? '✅ Perfectly balanced!'
              : result.difference > 0
              ? `↑ Surplus of ₹${Math.abs(result.difference).toLocaleString('en-IN')} — possible untracked income`
              : `↓ Deficit of ₹${Math.abs(result.difference).toLocaleString('en-IN')} — unaccounted transactions found`}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
