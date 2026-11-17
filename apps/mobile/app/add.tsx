import { useMemo, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { transactionsApi } from '@/src/api/client';
import { quickNoteToForm, type QuickNote, type TransactionFormData } from '@fintrack/shared';
import TransactionForm from '@/src/components/TransactionForm';
import { FormScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { useToast } from '@/src/context/ToastContext';
import { useQuickNotes } from '@/src/store/quickNotes';

function formToPayload(form: TransactionFormData) {
  return {
    title: form.title,
    amount: parseFloat(form.amount),
    nature: form.nature,
    source_account_id: parseInt(form.source_account_id) || 0,
    target_account_id: form.target_account_id ? parseInt(form.target_account_id) : undefined,
    sub_category_id: form.sub_category_id ? parseInt(form.sub_category_id) : undefined,
    
    payment_method_id: form.payment_method_id ? parseInt(form.payment_method_id) : undefined,
    notes: form.notes || undefined,
    principal_amount: parseFloat(form.principal_amount) || 0,
    interest_amount: parseFloat(form.interest_amount) || 0,
    transaction_date: form.transaction_date,
    warranty_until: form.warranty_until || undefined,
    warranty_notes: form.warranty_notes || undefined,
    tag_ids: form.tag_ids && form.tag_ids.length > 0 ? form.tag_ids : undefined,
  };
}

export default function AddTransactionScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const params = useLocalSearchParams<{ template?: string; note?: string }>();
  const removeNote = useQuickNotes((s) => s.removeNote);
  // Opened from a quick note: the form starts from it and saving converts it.
  const note = useMemo(() => (params.note ? (JSON.parse(params.note) as QuickNote) : undefined), [params.note]);
  const initialData = useMemo(
    () => (note ? quickNoteToForm(note) : params.template ? (JSON.parse(params.template) as TransactionFormData) : undefined),
    [note, params.template]
  );

  const handleSubmit = async (form: TransactionFormData) => {
    const payload = formToPayload(form);
    await transactionsApi.create(note ? { ...payload, quick_note_id: note.id } : payload);
    if (note) removeNote(note.id);
    showToast('Transaction added');
    router.back();
  };

  return (
    <FormScreen
      ref={scrollRef}
      header={<ScreenHeader title={note ? 'Add from Quick Note' : 'Add Transaction'} />}
    >
      <TransactionForm scrollRef={scrollRef} initial={initialData} onSubmit={handleSubmit} submitLabel="Add Transaction" />
    </FormScreen>
  );
}
