import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { accountsApi, categoriesApi } from '@/src/api/client';
import type { Account, Category, TransactionFormData } from '@fintrack/shared';
import { ENTITIES, NATURES, PAYMENT_METHODS, emptyTransactionForm } from '@fintrack/shared';
import { useColorScheme } from 'nativewind';

interface Props {
  initial?: TransactionFormData;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  submitLabel: string;
}

export default function TransactionForm({ initial, onSubmit, submitLabel }: Props) {
  const [form, setForm] = useState<TransactionFormData>(initial ?? emptyTransactionForm());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const pickerColor = isDark ? '#f3f4f6' : '#1f2937';
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

  useEffect(() => {
    accountsApi.list({ type: 'LIABILITY' }).then((data) => setAccounts(data || [])).catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    categoriesApi.list({  nature: form.nature }).then((data) => setCategories(data || [])).catch(() => setCategories([]));
    setForm((f) => {
      if (initial?.sub_category_id === f.sub_category_id && f.sub_category_id !== '') {
        return f;
      }
      setSelectedCategoryId('');
      return { ...f, sub_category_id: '' };
    });
  }, [form.entity, form.nature]);

  useEffect(() => {
    if (form.sub_category_id && categories.length > 0) {
      const category = categories.find((c) =>
        c.sub_categories?.some((sc) => sc.id === parseInt(form.sub_category_id))
      );
      if (category) {
        setSelectedCategoryId(category.id.toString());
      }
    }
  }, [categories, form.sub_category_id]);

  useEffect(() => {
    if (form.nature === 'EMI_PAYMENT') {
      const p = parseFloat(form.principal_amount) || 0;
      const i = parseFloat(form.interest_amount) || 0;
      setForm((f) => ({ ...f, amount: (p + i).toString() }));
    }
  }, [form.principal_amount, form.interest_amount, form.nature]);

  useEffect(() => {
    if (form.nature !== 'EMI_PAYMENT' || !form.target_account_id) return;
    const account = accounts.find((a) => a.id.toString() === form.target_account_id);
    if (!account || account.interest_rate <= 0) return;
    const monthly = (account.current_balance * account.interest_rate) / 100 / 12;
    setForm((f) => ({ ...f, interest_amount: monthly.toFixed(2) }));
  }, [form.target_account_id, form.nature, accounts]);

  useEffect(() => {
    if (initial?.nature === form.nature && initial?.sub_category_id === form.sub_category_id) {
      return;
    }
    if (form.nature === 'TRANSFER' || form.nature === 'EMI_PAYMENT' || form.nature === 'LOAN_DISBURSEMENT') {
      setSelectedCategoryId('');
      setForm((f) => ({ ...f, sub_category_id: '' }));
    }
    if (form.nature === 'INCOME' || form.nature === 'TRANSFER' || form.nature === 'LOAN_DISBURSEMENT') {
      setForm((f) => ({ ...f, payment_method: '' }));
    }
  }, [form.nature]);

  const set = (field: keyof TransactionFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const liabilityAccounts = accounts.filter((a) => a.type === 'LIABILITY' && a.is_active);
  const selectedCategory = categories.find((c) => c.id.toString() === selectedCategoryId);
  const availableSubCategories = selectedCategory?.sub_categories ?? [];

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    set('sub_category_id', '');
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8" keyboardShouldPersistTaps="handled">
      {error ? (
        <View className="bg-red-50 p-2 rounded mb-3">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      ) : null}

      {/* Entity selector */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Entity *</Text>
        <View className="flex-row gap-2">
          {ENTITIES.map((e) => (
            <TouchableOpacity
              key={e}
              onPress={() => set('entity', e)}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                form.entity === e ? 'bg-blue-600 dark:bg-blue-500' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600'
              }`}
            >
              <Text className={`text-sm font-medium ${form.entity === e ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                {e}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Nature selector */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Transaction Type *</Text>
        <View className="flex-row flex-wrap gap-1">
          {NATURES.map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => set('nature', n)}
              className={`flex-1 min-w-[23%] py-2 rounded-lg items-center ${
                form.nature === n ? 'bg-blue-600 dark:bg-blue-500' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600'
              }`}
            >
              <Text className={`text-xs font-medium ${form.nature === n ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                {n === 'EMI_PAYMENT' ? 'EMI' : n === 'LOAN_DISBURSEMENT' ? 'LOAN' : n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Title */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Title *</Text>
        <TextInput
          placeholder="e.g. Groceries, Salary"
          placeholderTextColor={placeholderColor}
          value={form.title}
          onChangeText={(v) => set('title', v)}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
        />
      </View>

      {/* Loan Account */}
      {(form.nature === 'EMI_PAYMENT' || form.nature === 'LOAN_DISBURSEMENT') && (
        <View className="mb-4">
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Loan Account *</Text>
          <View className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            <Picker
              mode="dropdown"
              style={{ color: pickerColor, backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
              dropdownIconColor={pickerColor}
              selectedValue={form.nature === 'LOAN_DISBURSEMENT' ? form.source_account_id : form.target_account_id}
              onValueChange={(v) => {
                if (form.nature === 'LOAN_DISBURSEMENT') {
                  set('source_account_id', v);
                } else {
                  set('target_account_id', v);
                }
              }}
            >
              <Picker.Item label="Select loan account" value="" />
              {liabilityAccounts.map((a) => (
                <Picker.Item
                  key={a.id}
                  label={`${a.name} — ₹${a.current_balance.toLocaleString('en-IN')} outstanding${a.interest_rate > 0 ? ` · ${a.interest_rate}% p.a.` : ''}`}
                  value={a.id.toString()}
                />
              ))}
            </Picker>
          </View>
        </View>
      )}

      {/* Amount */}
      {form.nature !== 'EMI_PAYMENT' && (
        <View className="mb-4">
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Amount (₹) *</Text>
          <TextInput
            placeholder="e.g. 1500.00"
            placeholderTextColor={placeholderColor}
            value={form.amount}
            onChangeText={(v) => set('amount', v)}
            keyboardType="decimal-pad"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          />
        </View>
      )}

      {/* EMI split */}
      {form.nature === 'EMI_PAYMENT' && (() => {
        const selectedLoan = accounts.find((a) => a.id.toString() === form.target_account_id);
        const suggestedInterest = selectedLoan && selectedLoan.interest_rate > 0
          ? (selectedLoan.current_balance * selectedLoan.interest_rate / 100 / 12)
          : null;
        return (
          <View className="mb-4">
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Principal (₹)</Text>
                <TextInput
                  value={form.principal_amount}
                  onChangeText={(v) => set('principal_amount', v)}
                  keyboardType="decimal-pad"
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">
                  Interest (₹){suggestedInterest !== null ? ` · ${selectedLoan!.interest_rate}% p.a.` : ''}
                </Text>
                <TextInput
                  value={form.interest_amount}
                  onChangeText={(v) => set('interest_amount', v)}
                  keyboardType="decimal-pad"
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                />
                {suggestedInterest !== null && (
                  <Text className="text-[10px] text-orange-500 mt-0.5">
                    Suggested ₹{suggestedInterest.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Text>
                )}
              </View>
            </View>
            <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
              Total EMI: ₹{(parseFloat(form.principal_amount || '0') + parseFloat(form.interest_amount || '0')).toLocaleString('en-IN')}
            </Text>
          </View>
        );
      })()}

      {/* Category / Sub-category */}
      {(form.nature === 'INCOME' || form.nature === 'EXPENSE') && (
        <View className="mb-4 flex-row gap-2">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Category</Text>
            <View className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              <Picker
                mode="dropdown"
                style={{ color: pickerColor, backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
                dropdownIconColor={pickerColor}
                selectedValue={selectedCategoryId}
                onValueChange={handleCategoryChange}
              >
                <Picker.Item label="Select category" value="" />
                {categories.map((c) => (
                  <Picker.Item key={c.id} label={c.name} value={c.id.toString()} />
                ))}
              </Picker>
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Sub-category</Text>
            <View className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              <Picker
                mode="dropdown"
                style={{ color: pickerColor, backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
                dropdownIconColor={pickerColor}
                selectedValue={form.sub_category_id}
                onValueChange={(v) => set('sub_category_id', v)}
                enabled={!!selectedCategoryId}
              >
                <Picker.Item label={selectedCategoryId ? 'Select sub-category' : 'Choose category first'} value="" />
                {availableSubCategories.map((sc) => (
                  <Picker.Item key={sc.id} label={sc.name} value={sc.id.toString()} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      )}

      {/* Payment method */}
      {(form.nature === 'EXPENSE' || form.nature === 'EMI_PAYMENT') && (
        <View className="mb-4">
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Payment Method</Text>
          <View className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            <Picker
              mode="dropdown"
              style={{ color: pickerColor, backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
              dropdownIconColor={pickerColor}
              selectedValue={form.payment_method}
              onValueChange={(v) => set('payment_method', v)}
            >
              <Picker.Item label="No payment method" value="" />
              {PAYMENT_METHODS.map((pm) => (
                <Picker.Item key={pm} label={pm} value={pm} />
              ))}
            </Picker>
          </View>
        </View>
      )}

      {/* Date */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Transaction Date *</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <Text className={`text-sm ${form.transaction_date ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
            {form.transaction_date || 'Select date'}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={form.transaction_date ? new Date(form.transaction_date + 'T00:00:00') : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                const d = selectedDate.toISOString().split('T')[0];
                set('transaction_date', d);
              }
            }}
          />
        )}
      </View>

      {/* Notes */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">Notes</Text>
        <TextInput
          placeholder="Additional notes (optional)"
          placeholderTextColor={placeholderColor}
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          multiline
          numberOfLines={2}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
        />
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        className={`w-full py-3 rounded-lg items-center ${submitting ? 'bg-blue-400' : 'bg-blue-600 dark:bg-blue-500'}`}
      >
        <Text className="text-white font-medium">{submitting ? 'Saving...' : submitLabel}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
