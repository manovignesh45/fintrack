import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SectionList,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  parseQuickNoteLine,
  parseQuickNotes,
  canQuickConvert,
  quickNoteToTransaction,
  formatQuickNoteDate,
  localDateString,
  type QuickNote,
} from '@fintrack/shared';
import { quickNotesApi, transactionsApi } from '@/src/api/client';
import { useLedgers } from '@/src/context/LedgerContext';
import { useToast } from '@/src/context/ToastContext';
import { useThemeColors } from '@/src/theme/colors';
import { KeyboardScreen } from '@/src/components/ui/FormScreen';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Button } from '@/src/components/ui/Button';
import { useQuickNotes, useQuickNotesSummary, type PendingQuickNote } from '@/src/store/quickNotes';

type Row = { kind: 'saved'; note: QuickNote } | { kind: 'pending'; note: PendingQuickNote };

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function suggestionLabel(note: QuickNote): string | null {
  const s = note.suggestion;
  if (!s) return null;
  const parts = [s.category_name, s.sub_category_name].filter(Boolean).join(' › ');
  const label = parts || (s.nature === 'INCOME' ? 'Income' : 'Expense');
  return s.payment_method_name && s.nature === 'EXPENSE' ? `${label} · ${s.payment_method_name}` : label;
}

export default function QuickNotesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { showToast } = useToast();
  const { activeLedgerId } = useLedgers();
  const { notes, pending, loading, error, refresh, add, removePending, removeNote } = useQuickNotes();
  const { count, total } = useQuickNotesSummary();

  const inputRef = useRef<TextInputInstance>(null);
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState('');
  const [date, setDate] = useState(localDateString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  useFocusEffect(
    useCallback(() => {
      refresh(activeLedgerId);
    }, [activeLedgerId, refresh])
  );

  const today = localDateString();

  const sections = useMemo(() => {
    const rows: Row[] = [
      ...pending.filter((p) => p.ledger_id === activeLedgerId).map((note): Row => ({ kind: 'pending', note })),
      ...notes.map((note): Row => ({ kind: 'saved', note })),
    ];
    const byDate = new Map<string, Row[]>();
    for (const row of rows) {
      const list = byDate.get(row.note.note_date) ?? [];
      list.push(row);
      byDate.set(row.note.note_date, list);
    }
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([d, data]) => ({ date: d, total: data.reduce((sum, r) => sum + r.note.amount, 0), data }));
  }, [notes, pending, activeLedgerId]);

  const handleCapture = async () => {
    const note = parseQuickNoteLine(text);
    if (!note) {
      setInputError(text.trim() ? 'Add a name with the amount, e.g. "Maligai 85"' : '');
      return;
    }
    setText('');
    setInputError('');
    await add([{ ...note, note_date: date }]);
  };

  const handleConfirm = async (note: QuickNote) => {
    setBusyId(note.id);
    try {
      await transactionsApi.create(quickNoteToTransaction(note));
      removeNote(note.id);
      showToast(`Added ${note.title} · ${rupees(note.amount)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add transaction', 'error');
      refresh(activeLedgerId);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (row: Row) => {
    Alert.alert('Delete note?', `${row.note.title}${row.note.amount ? ` · ${rupees(row.note.amount)}` : ''}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (row.kind === 'pending') {
            await removePending(row.note.client_id);
            return;
          }
          try {
            await quickNotesApi.delete(row.note.id);
            removeNote(row.note.id);
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not delete note', 'error');
            refresh(activeLedgerId);
          }
        },
      },
    ]);
  };

  const parsedPaste = useMemo(() => parseQuickNotes(pasteText, today), [pasteText, today]);
  const pasteTotal = parsedPaste.notes.reduce((sum, n) => sum + n.amount, 0);

  const handlePasteSave = async () => {
    const batch = parsedPaste.notes;
    setPasteOpen(false);
    setPasteText('');
    await add(batch);
    showToast(`${batch.length} note${batch.length === 1 ? '' : 's'} added`);
  };

  const renderRow = ({ item: row }: { item: Row }) => {
    const { note } = row;
    const saved = row.kind === 'saved' ? row.note : null;
    const hint = saved ? suggestionLabel(saved) : null;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={!saved}
        onPress={() => saved && router.push({ pathname: '/add', params: { note: JSON.stringify(saved) } })}
        onLongPress={() => handleDelete(row)}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 mb-2 mx-4 flex-row items-center"
      >
        <View className="flex-1 mr-3">
          <Text className="font-medium text-gray-800 dark:text-gray-100" numberOfLines={1}>{note.title}</Text>
          {!saved ? (
            <View className="flex-row items-center gap-1 mt-0.5">
              <Ionicons name="cloud-offline-outline" size={12} color={colors.iconMuted} />
              <Text className="text-xs text-gray-500 dark:text-gray-400">Saved on this phone · waiting to sync</Text>
            </View>
          ) : (
            <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5" numberOfLines={1}>
              {hint ?? 'Tap to add details'}
            </Text>
          )}
        </View>
        <Text className={`font-semibold mr-3 ${note.amount ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
          {note.amount ? rupees(note.amount) : 'No amount'}
        </Text>
        {saved && canQuickConvert(saved) ? (
          <TouchableOpacity
            onPress={() => handleConfirm(saved)}
            disabled={busyId !== null}
            accessibilityLabel={`Add ${saved.title} as a transaction`}
            hitSlop={8}
            className="w-9 h-9 rounded-full bg-green-600 items-center justify-center"
          >
            {busyId === saved.id ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="checkmark" size={20} color="white" />}
          </TouchableOpacity>
        ) : saved ? (
          <Ionicons name="chevron-forward" size={18} color={colors.iconMuted} />
        ) : null}
        <TouchableOpacity onPress={() => handleDelete(row)} accessibilityLabel={`Delete ${note.title}`} hitSlop={8} className="ml-3">
          <Ionicons name="trash-outline" size={18} color={colors.iconMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardScreen>
      <ScreenHeader
        title="Quick Notes"
        right={
          <TouchableOpacity onPress={() => setPasteOpen(true)} className="flex-row items-center gap-1 px-2 py-1">
            <Ionicons name="clipboard-outline" size={16} color={colors.blue} />
            <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Paste list</Text>
          </TouchableOpacity>
        }
      />

      {/* Capture bar: type "name amount", press enter, repeat. */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center gap-2">
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={(v) => { setText(v); if (inputError) setInputError(''); }}
            placeholder="Maligai 85"
            placeholderTextColor={colors.placeholder}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={handleCapture}
            accessibilityLabel="Quick note: name and amount"
            className={`flex-1 px-3 py-3 border rounded-lg text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${inputError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
          />
          <TouchableOpacity
            onPress={handleCapture}
            disabled={!text.trim()}
            accessibilityLabel="Save note"
            className={`w-12 h-12 rounded-lg items-center justify-center ${text.trim() ? 'bg-blue-600 dark:bg-blue-500' : 'bg-blue-300 dark:bg-blue-900'}`}
          >
            <Ionicons name="arrow-up" size={22} color="white" />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center justify-between mt-2">
          {inputError ? (
            <Text className="text-xs text-red-500 flex-1 mr-2">{inputError}</Text>
          ) : (
            <Text className="text-xs text-gray-500 dark:text-gray-400 flex-1 mr-2">Name, then amount. Sort it into a transaction later.</Text>
          )}
          <TouchableOpacity onPress={() => setShowDatePicker(true)} className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <Ionicons name="calendar-outline" size={12} color={colors.icon} />
            <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">{formatQuickNoteDate(date, today)}</Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={new Date(date + 'T00:00:00')}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selected) setDate(localDateString(selected));
            }}
          />
        )}
      </View>

      {error && (
        <TouchableOpacity onPress={() => refresh(activeLedgerId)} className="mx-4 mb-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex-row items-center gap-2">
          <Ionicons name="cloud-offline-outline" size={16} color="#b45309" />
          <Text className="text-xs text-amber-800 dark:text-amber-300 flex-1">Not synced: {error}. Notes are kept on this phone. Tap to retry.</Text>
        </TouchableOpacity>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(row) => (row.kind === 'saved' ? `s${row.note.id}` : `p${row.note.client_id}`)}
        renderItem={renderRow}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await refresh(activeLedgerId); setRefreshing(false); }}
          />
        }
        ListHeaderComponent={
          count > 0 ? (
            <Text className="px-4 pb-1 text-sm text-gray-600 dark:text-gray-300">
              {count} to review · <Text className="font-semibold">{rupees(total)}</Text> not in your totals yet
            </Text>
          ) : undefined
        }
        renderSectionHeader={({ section }) => (
          <View className="flex-row justify-between px-4 pt-3 pb-1.5">
            <Text className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{formatQuickNoteDate(section.date, today)}</Text>
            <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400">{rupees(section.total)}</Text>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={colors.activityIndicator} className="py-8" />
          ) : (
            <EmptyState icon="flash-outline" title="Nothing to review" subtitle="Jot a spend above the moment it happens. Turn it into a transaction when you have time." />
          )
        }
      />

      {/* Paste a whole note (date lines + "name amount" lines) */}
      <Modal visible={pasteOpen} transparent animationType="slide" onRequestClose={() => setPasteOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-t-2xl p-4 pb-8">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-base font-semibold text-gray-800 dark:text-gray-100">Paste a list</Text>
              <TouchableOpacity onPress={() => setPasteOpen(false)} accessibilityLabel="Close" hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.icon} />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              One spend per line. A line with only a date (13/11/26) applies to the lines under it.
            </Text>
            <TextInput
              value={pasteText}
              onChangeText={setPasteText}
              placeholder={'13/11/26\nMaligai 85\nGarlic 300'}
              placeholderTextColor={colors.placeholder}
              multiline
              autoFocus
              textAlignVertical="top"
              style={{ height: 180 }}
              className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
            />
            <Text className="text-xs text-gray-600 dark:text-gray-300 mt-2">
              {parsedPaste.notes.length
                ? `${parsedPaste.notes.length} note${parsedPaste.notes.length === 1 ? '' : 's'} · ${rupees(pasteTotal)}`
                : 'No notes found yet'}
            </Text>
            {parsedPaste.skipped.length > 0 && (
              <Text className="text-xs text-amber-700 dark:text-amber-400 mt-1" numberOfLines={3}>
                Could not read {parsedPaste.skipped.length} line{parsedPaste.skipped.length === 1 ? '' : 's'}: {parsedPaste.skipped.join(', ')}
              </Text>
            )}
            <Button
              title={parsedPaste.notes.length ? `Add ${parsedPaste.notes.length} note${parsedPaste.notes.length === 1 ? '' : 's'}` : 'Add notes'}
              disabled={parsedPaste.notes.length === 0}
              onPress={handlePasteSave}
              className="mt-3"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardScreen>
  );
}
