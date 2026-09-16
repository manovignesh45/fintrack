import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { accountsApi, categoriesApi, paymentMethodsApi } from '@/src/api/client';
import { SelectField } from '@/src/components/ui/SelectField';
import { Button } from '@/src/components/ui/Button';
import type { Account, Category, PaymentMethod, CommitmentInput, TxNature, Commitment } from '@fintrack/shared';
import { useColorScheme } from 'nativewind';

interface Props {
  initial?: Partial<Commitment>;
  onSubmit: (data: CommitmentInput) => Promise<void>;
  submitLabel: string;
}

export default function CommitmentForm({ initial, onSubmit, submitLabel }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [nature, setNature] = useState<TxNature>(initial?.nature || 'EXPENSE');
  const [amount, setAmount] = useState((initial?.amount || '').toString());
  const [dueDay, setDueDay] = useState((initial?.due_day || 1).toString());
  const [targetAccountId, setTargetAccountId] = useState(initial?.target_account_id?.toString() || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState(initial?.sub_category_id?.toString() || '');
  const [paymentMethodId, setPaymentMethodId] = useState(initial?.payment_method_id?.toString() || '');
  const [principalAmount, setPrincipalAmount] = useState((initial?.principal_amount || 0).toString());
  const [interestAmount, setInterestAmount] = useState((initial?.interest_amount || 0).toString());
  const [notes, setNotes] = useState(initial?.notes || '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

  useEffect(() => {
    accountsApi.list({ type: 'LIABILITY' }).then((a) => setAccounts(a || [])).catch(() => setAccounts([]));
    paymentMethodsApi.list().then((p) => setPaymentMethods(p || [])).catch(() => setPaymentMethods([]));
    categoriesApi.list({ nature: 'EXPENSE' }).then((c) => setCategories(c || [])).catch(() => setCategories([]));
  }, []);

  // Preselect category if subCategoryId exists
  useEffect(() => {
    if (subCategoryId && categories.length > 0 && !selectedCategoryId) {
      const parent = categories.find((c) => c.sub_categories?.some((sc) => sc.id.toString() === subCategoryId));
      if (parent) setSelectedCategoryId(parent.id.toString());
    }
  }, [subCategoryId, categories, selectedCategoryId]);

  // EMI Amount auto-calculation
  useEffect(() => {
    if (nature === 'EMI_PAYMENT') {
      const p = parseFloat(principalAmount) || 0;
      const i = parseFloat(interestAmount) || 0;
      setAmount((p + i).toString());
    }
  }, [principalAmount, interestAmount, nature]);

  // Loan account interest rate suggestion
  useEffect(() => {
    if (nature !== 'EMI_PAYMENT' || !targetAccountId) return;
    const loan = accounts.find((a) => a.id.toString() === targetAccountId);
    if (!loan || loan.interest_rate <= 0) return;
    const monthly = (loan.current_balance * loan.interest_rate) / 100 / 12;
    setInterestAmount(monthly.toFixed(2));
  }, [targetAccountId, nature, accounts]);

  const liabilityAccounts = accounts.filter((a) => a.type === 'LIABILITY' && a.is_active);
  const selectedCategory = categories.find((c) => c.id.toString() === selectedCategoryId);
  const availableSubCategories = selectedCategory?.sub_categories ?? [];

  const dueDayItems = Array.from({ length: 31 }, (_, i) => ({
    label: `Day ${i + 1} of every month`,
    value: (i + 1).toString(),
  }));

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a name for the commitment');
      return;
    }
    const numAmount = parseFloat(amount || '0');
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        nature,
        amount: numAmount,
        due_day: parseInt(dueDay, 10) || 1,
        source_account_id: 1,
        target_account_id: nature === 'EMI_PAYMENT' && targetAccountId ? parseInt(targetAccountId, 10) : null,
        sub_category_id: nature === 'EXPENSE' && subCategoryId ? parseInt(subCategoryId, 10) : null,
        payment_method_id: paymentMethodId ? parseInt(paymentMethodId, 10) : null,
        principal_amount: nature === 'EMI_PAYMENT' ? parseFloat(principalAmount) || 0 : 0,
        interest_amount: nature === 'EMI_PAYMENT' ? parseFloat(interestAmount) || 0 : 0,
        notes: notes.trim() || undefined,
        is_active: isActive,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save commitment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="p-4">
      {error ? (
        <View className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 rounded-lg mb-4">
          <Text className="text-red-600 dark:text-red-300 text-xs font-medium">{error}</Text>
        </View>
      ) : null}

      {/* Type Selector: Expense vs EMI */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Commitment Type *</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => setNature('EXPENSE')}
            className={`flex-1 py-2.5 rounded-lg items-center border ${
              nature === 'EXPENSE'
                ? 'bg-blue-600 border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
            }`}
          >
            <Text className={`text-xs font-semibold ${nature === 'EXPENSE' ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
              Recurring Bill / Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setNature('EMI_PAYMENT')}
            className={`flex-1 py-2.5 rounded-lg items-center border ${
              nature === 'EMI_PAYMENT'
                ? 'bg-blue-600 border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
            }`}
          >
            <Text className={`text-xs font-semibold ${nature === 'EMI_PAYMENT' ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
              Loan EMI
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Name */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Name / Merchant *</Text>
        <TextInput
          placeholder="e.g. House Rent, Netflix, Car Loan EMI"
          placeholderTextColor={placeholderColor}
          value={name}
          onChangeText={setName}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </View>

      {/* Due Day */}
      <SelectField
        label="Due Day of Month *"
        selectedValue={dueDay}
        onValueChange={setDueDay}
        items={dueDayItems}
      />

      {/* Loan Account (for EMI) */}
      {nature === 'EMI_PAYMENT' && (
        <SelectField
          label="Linked Loan Account *"
          selectedValue={targetAccountId}
          onValueChange={setTargetAccountId}
          placeholder={{ label: 'Select loan account', value: '' }}
          items={liabilityAccounts.map((a) => ({
            label: `${a.name} — ₹${a.current_balance.toLocaleString('en-IN')} outstanding`,
            value: a.id.toString(),
          }))}
        />
      )}

      {/* Amount or EMI split */}
      {nature === 'EXPENSE' ? (
        <View className="mb-4">
          <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monthly Amount (₹) *</Text>
          <TextInput
            placeholder="e.g. 15000"
            placeholderTextColor={placeholderColor}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </View>
      ) : (
        <View className="mb-4">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Principal (₹)</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={placeholderColor}
                value={principalAmount}
                onChangeText={setPrincipalAmount}
                keyboardType="decimal-pad"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Interest (₹)</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={placeholderColor}
                value={interestAmount}
                onChangeText={setInterestAmount}
                keyboardType="decimal-pad"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </View>
          </View>
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total EMI: ₹{(parseFloat(principalAmount || '0') + parseFloat(interestAmount || '0')).toLocaleString('en-IN')}
          </Text>
        </View>
      )}

      {/* Category / Sub-category (for Expense) */}
      {nature === 'EXPENSE' && (
        <View className="mb-4 flex-row gap-2">
          <SelectField
            containerClassName="flex-1"
            label="Category"
            selectedValue={selectedCategoryId}
            onValueChange={(catId) => {
              setSelectedCategoryId(catId);
              setSubCategoryId('');
            }}
            placeholder={{ label: 'Select category', value: '' }}
            items={categories.map((c) => ({ label: c.name, value: c.id.toString() }))}
          />
          <SelectField
            containerClassName="flex-1"
            label="Sub-category"
            selectedValue={subCategoryId}
            onValueChange={setSubCategoryId}
            enabled={!!selectedCategoryId}
            placeholder={{ label: selectedCategoryId ? 'Select sub-category' : 'Select category first', value: '' }}
            items={availableSubCategories.map((sc) => ({ label: sc.name, value: sc.id.toString() }))}
          />
        </View>
      )}

      {/* Payment Method */}
      <SelectField
        label="Payment Method (Optional)"
        selectedValue={paymentMethodId}
        onValueChange={setPaymentMethodId}
        placeholder={{ label: 'No specific payment method', value: '' }}
        items={paymentMethods.map((pm) => ({ label: pm.name, value: pm.id.toString() }))}
      />

      {/* Notes */}
      <View className="mb-4">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes (Optional)</Text>
        <TextInput
          placeholder="e.g. Account number, contract ID"
          placeholderTextColor={placeholderColor}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </View>

      {/* Active Toggle */}
      <View className="flex-row items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <View>
          <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">Active Commitment</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {isActive ? 'Tracks monthly payment status' : 'Temporarily paused'}
          </Text>
        </View>
        <Switch value={isActive} onValueChange={setIsActive} />
      </View>

      <Button
        title={submitting ? 'Saving...' : submitLabel}
        onPress={handleSubmit}
        loading={submitting}
      />
    </View>
  );
}
