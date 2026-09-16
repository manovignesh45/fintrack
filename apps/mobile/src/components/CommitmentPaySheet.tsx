import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import type { CommitmentStatus, PayCommitmentInput } from '@fintrack/shared';

interface CommitmentPaySheetProps {
  visible: boolean;
  onClose: () => void;
  item: CommitmentStatus | null;
  month: string;
  onConfirm: (data: PayCommitmentInput) => Promise<void>;
}

export default function CommitmentPaySheet({
  visible,
  onClose,
  item,
  month,
  onConfirm,
}: CommitmentPaySheetProps) {
  if (!visible || !item) return null;

  return (
    <PaySheetModalContent
      visible={visible}
      onClose={onClose}
      item={item}
      month={month}
      onConfirm={onConfirm}
    />
  );
}

function PaySheetModalContent({
  visible,
  onClose,
  item,
  month,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  item: CommitmentStatus;
  month: string;
  onConfirm: (data: PayCommitmentInput) => Promise<void>;
}) {
  const now = new Date();
  const todayLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const [amount, setAmount] = useState(item.amount.toString());
  const [txDate, setTxDate] = useState(todayLocalDate);
  const [notes, setNotes] = useState(item.notes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const placeholderColor = isDark ? '#9ca3af' : '#6b7280';

  useEffect(() => {
    setAmount(item.amount.toString());
    setTxDate(todayLocalDate);
    setNotes(item.notes || '');
    setError('');
  }, [item]);

  const isEmi = item.nature === 'EMI_PAYMENT';
  const numAmount = parseFloat(amount || '0');
  const principal = item.principal_amount || 0;
  const computedInterest = isEmi ? Math.max(0, numAmount - principal) : 0;

  const handleSubmit = async () => {
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    if (!txDate) {
      setError('Please enter a payment date');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onConfirm({
        month,
        amount: numAmount,
        transaction_date: txDate,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={submitting ? undefined : onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="bg-white dark:bg-gray-800 rounded-t-2xl max-h-[90%] p-5 border-t border-gray-200 dark:border-gray-700">
          {/* Drag handle */}
          <View className="items-center mb-3">
            <View className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
            <View className="flex-1 mr-2">
              <View className="flex-row items-center gap-2">
                <Text className="font-semibold text-gray-800 dark:text-gray-100 text-base" numberOfLines={1}>
                  Pay: {item.name}
                </Text>
                {isEmi && (
                  <View className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40">
                    <Text className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">EMI</Text>
                  </View>
                )}
              </View>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Due on {item.due_date} · Standard ₹{item.amount.toLocaleString('en-IN')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={submitting} className="p-1">
              <Ionicons name="close" size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView className="mt-4" keyboardShouldPersistTaps="handled">
            {error ? (
              <View className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg mb-4">
                <Text className="text-xs text-red-600 dark:text-red-300">{error}</Text>
              </View>
            ) : null}

            {/* Amount */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400">Amount to Record (₹) *</Text>
                {numAmount !== item.amount && (
                  <TouchableOpacity onPress={() => setAmount(item.amount.toString())}>
                    <Text className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                      Reset to ₹{item.amount.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={placeholderColor}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-base font-semibold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              />

              {/* EMI split preview */}
              {isEmi && (
                <View className="mt-2 p-2.5 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-100 dark:border-purple-900/40 flex-row justify-between text-xs">
                  <View>
                    <Text className="text-[10px] text-gray-500">Principal</Text>
                    <Text className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      ₹{principal.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] text-gray-500">Interest</Text>
                    <Text className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                      ₹{computedInterest.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Payment Date */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Payment Date *</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 flex-row items-center justify-between"
              >
                <Text className="text-sm text-gray-900 dark:text-white">{txDate}</Text>
                <Ionicons name="calendar-outline" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(txDate + 'T00:00:00')}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (d) {
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      setTxDate(`${y}-${m}-${day}`);
                    }
                  }}
                />
              )}
            </View>

            {/* Notes */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes (Optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Reference #, payment mode, etc."
                placeholderTextColor={placeholderColor}
                multiline
                numberOfLines={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View className="flex-row gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-xl items-center bg-gray-50 dark:bg-gray-900"
            >
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-blue-600 dark:bg-blue-500 rounded-xl items-center flex-row justify-center gap-1.5"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-sm font-semibold text-white">Record Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
