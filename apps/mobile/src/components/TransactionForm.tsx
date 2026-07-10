import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Pressable } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { accountsApi, categoriesApi, paymentMethodsApi } from '@/src/api/client';
import type { Account, Category, TransactionFormData, PaymentMethod } from '@fintrack/shared';
import { NATURES, emptyTransactionForm } from '@fintrack/shared';
import { useColorScheme } from 'nativewind';
import { useAuth } from '@/src/context/AuthContext';

interface Props {
  initial?: TransactionFormData;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  submitLabel: string;
}

export default function TransactionForm({ initial, onSubmit, submitLabel }: Props) {
  const { editMode } = useAuth();
  const [form, setForm] = useState<TransactionFormData>(initial ?? emptyTransactionForm());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Custom Modal State
  const [promptConfig, setPromptConfig] = useState<{
    visible: boolean;
    title: string;
    placeholder: string;
    configurePath?: '/categories' | '/payment-methods';
    onSubmit: (val: string) => Promise<void>;
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [promptSubmitting, setPromptSubmitting] = useState(false);
  
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const pickerColor = isDark ? '#f3f4f6' : '#1f2937';
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

  useEffect(() => {
    accountsApi.list({ type: 'LIABILITY' }).then((data) => setAccounts(data || [])).catch(() => setAccounts([]));
    paymentMethodsApi.list().then((data) => setPaymentMethods(data || [])).catch(() => setPaymentMethods([]));
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
  }, [form.nature]);

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
      setForm((f) => ({ ...f, payment_method_id: '' }));
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

  const handleCreateCategory = () => {
    setPromptConfig({
      visible: true,
      title: `New ${form.nature.toLowerCase()} category`,
      placeholder: 'Category Name',
      configurePath: '/categories',
      onSubmit: async (val) => {
        const newCat = await categoriesApi.create({ name: val, nature: form.nature });
        setCategories([...categories, newCat]);
        handleCategoryChange(newCat.id.toString());
      },
    });
  };

  const handleCreateSubCategory = () => {
    if (!selectedCategoryId) return;
    setPromptConfig({
      visible: true,
      title: 'New sub-category',
      placeholder: 'Sub-category Name',
      configurePath: '/categories',
      onSubmit: async (val) => {
        await categoriesApi.createSub(parseInt(selectedCategoryId), { name: val });
        const updatedCats = await categoriesApi.list({ nature: form.nature });
        setCategories(updatedCats || []);
        const newSc = updatedCats.find(c => c.id.toString() === selectedCategoryId)?.sub_categories?.find(sc => sc.name.toLowerCase() === val.toLowerCase());
        if (newSc) set('sub_category_id', newSc.id.toString());
      },
    });
  };

  const handleCreatePaymentMethod = () => {
    setPromptConfig({
      visible: true,
      title: 'New payment method',
      placeholder: 'Method Name (e.g. Credit Card)',
      configurePath: '/payment-methods',
      onSubmit: async (val) => {
        const newPm = await paymentMethodsApi.create({ name: val });
        setPaymentMethods([...paymentMethods, newPm]);
        set('payment_method_id', newPm.id.toString());
      },
    });
  };

  return (
    <>
    <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8" keyboardShouldPersistTaps="handled">
      {error ? (
        <View className="bg-red-50 p-2 rounded mb-3">
          <Text className="text-red-600 text-sm">{error}</Text>
        </View>
      ) : null}



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
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400">Category *</Text>
              {editMode && (
                <TouchableOpacity onPress={handleCreateCategory}>
                  <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">+ Add</Text>
                </TouchableOpacity>
              )}
            </View>
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
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400">Sub-category</Text>
              {selectedCategoryId && editMode ? (
                <TouchableOpacity onPress={handleCreateSubCategory}>
                  <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">+ Add</Text>
                </TouchableOpacity>
              ) : null}
            </View>
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
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-xs text-gray-500 dark:text-gray-400">Payment Method</Text>
            {editMode && (
              <TouchableOpacity onPress={handleCreatePaymentMethod}>
                <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
          <View className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
            <Picker
              mode="dropdown"
              style={{ color: pickerColor, backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
              dropdownIconColor={pickerColor}
              selectedValue={form.payment_method_id}
              onValueChange={(v) => set('payment_method_id', v)}
            >
              <Picker.Item label="No payment method" value="" />
              {paymentMethods.map((pm) => (
                <Picker.Item key={pm.id} label={pm.name} value={pm.id.toString()} />
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

    {/* Custom Prompt Modal */}
    {promptConfig?.visible && (
      <Pressable 
        onPress={() => {
          setPromptConfig(null);
          setPromptValue('');
        }}
        className="absolute inset-0 bg-black/50 justify-center p-4 z-50"
      >
        <Pressable 
          className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-200 dark:border-gray-700"
        >
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{promptConfig.title}</Text>
          <TextInput
            value={promptValue}
            onChangeText={setPromptValue}
            placeholder={promptConfig.placeholder}
            placeholderTextColor={placeholderColor}
            autoFocus
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white mb-4"
          />
          <View className="flex-row justify-between items-center">
            {promptConfig.configurePath ? (
              <TouchableOpacity onPress={() => router.push(promptConfig.configurePath!)}>
                <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">Configure more</Text>
              </TouchableOpacity>
            ) : <View />}
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  setPromptConfig(null);
                  setPromptValue('');
                }}
                className="px-4 py-2 rounded-lg"
              >
                <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!promptValue.trim()) return;
                  setPromptSubmitting(true);
                  try {
                    await promptConfig.onSubmit(promptValue.trim());
                    setPromptConfig(null);
                    setPromptValue('');
                  } catch (err: any) {
                    setError(err.message || 'Failed to create');
                  } finally {
                    setPromptSubmitting(false);
                  }
                }}
                disabled={promptSubmitting || !promptValue.trim()}
                className={`px-4 py-2 rounded-lg ${promptSubmitting || !promptValue.trim() ? 'bg-blue-400' : 'bg-blue-600'}`}
              >
                <Text className="text-sm font-medium text-white">{promptSubmitting ? '...' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    )}
    </>
  );
}
