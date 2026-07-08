import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Platform, TouchableWithoutFeedback } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import type { FilterState, Category, TxNature } from '@fintrack/shared';
import {
  ENTITIES,
  DATE_PRESET_LABELS,
  getPresetDates,
  DEFAULT_FILTERS,
  countActiveFilters,
} from '@fintrack/shared';
import { categoriesApi } from '@/src/api/client';

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const TX_NATURES: { value: TxNature; label: string }[] = [
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'EMI_PAYMENT', label: 'EMI Payment' },
  { value: 'LOAN_DISBURSEMENT', label: 'Loan Disbursement' },
];

const STRUCTURAL_NATURES: TxNature[] = ['TRANSFER', 'EMI_PAYMENT', 'LOAN_DISBURSEMENT'];

export default function TransactionFilter({ filters, onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [local, setLocal] = useState<FilterState>(filters);
  const [showDateFrom, setShowDateFrom] = useState(false);
  const [showDateTo, setShowDateTo] = useState(false);
  const activeCount = countActiveFilters(filters);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (visible && !loaded.current) {
      loaded.current = true;
      setLoadingCats(true);
      categoriesApi.list().then((data) => {
        setCategories(data || []);
      }).catch(() => {
        setCategories([]);
      }).finally(() => setLoadingCats(false));
    }
  }, [visible]);

  const open = () => {
    setLocal(filters);
    setVisible(true);
  };

  const apply = () => {
    onChange(local);
    setVisible(false);
  };

  const reset = () => {
    onChange(DEFAULT_FILTERS);
    setVisible(false);
  };

  const set = (field: keyof FilterState, value: string) => {
    setLocal((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'entity') {
        next.nature = '';
        next.category_id = '';
        next.sub_category_id = '';
      }
      if (field === 'nature') {
        next.category_id = '';
        next.sub_category_id = '';
      }
      if (field === 'category_id') {
        next.sub_category_id = '';
      }
      if (field === 'datePreset') {
        if (value === 'custom' || !value) {
          // keep existing custom dates or clear
        } else {
          const dates = getPresetDates(value);
          next.date_from = dates.date_from;
          next.date_to = dates.date_to;
        }
      }
      return next;
    });
  };

  const availableNatures = local.entity
    ? Array.from(new Set([
        ...categories.filter((c) => c.entity === local.entity).map((c) => c.nature),
        ...STRUCTURAL_NATURES,
      ]))
    : TX_NATURES.map((n) => n.value);

  const filteredCategories = categories.filter((c) => {
    if (local.entity && c.entity !== local.entity) return false;
    if (local.nature && c.nature !== local.nature) return false;
    return true;
  });

  const selectedCategory = filteredCategories.find((c) => String(c.id) === local.category_id);
  const subCategories = selectedCategory?.sub_categories ?? [];

  return (
    <>
      <TouchableOpacity onPress={open} className="flex-row items-center px-2 py-1.5 rounded-lg bg-white border border-gray-300">
        <Ionicons name="filter-outline" size={16} color="#4b5563" />
        {activeCount > 0 && (
          <View className="ml-1 bg-blue-600 rounded-full w-4 h-4 items-center justify-center">
            <Text className="text-white text-[10px] font-bold">{activeCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View className="flex-1 justify-end">
          <TouchableWithoutFeedback onPress={() => setVisible(false)}>
            <View className="absolute inset-0 bg-black/40" />
          </TouchableWithoutFeedback>
          
          <View className="bg-white rounded-t-2xl max-h-[90%] flex flex-col shadow-2xl">
            {/* Drag handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 bg-gray-300 rounded-full" />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-800">Filter Transactions</Text>
              <TouchableOpacity onPress={() => setVisible(false)} className="p-1">
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView className="shrink p-4" keyboardShouldPersistTaps="handled">
              {/* Search */}
              <View className="mb-4">
                <Text className="text-xs font-medium text-gray-500 mb-1">Search</Text>
                <TextInput
                  placeholder="Search title or notes…"
                  value={local.search}
                  onChangeText={(v) => set('search', v)}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </View>

              {/* Entity */}
              <View className="mb-4">
                <Text className="text-xs font-medium text-gray-500 mb-1">Entity</Text>
                <View className="flex-row flex-wrap gap-2">
                  <TouchableOpacity
                    onPress={() => set('entity', '')}
                    className={`px-3 py-1.5 rounded-full border ${!local.entity ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}
                  >
                    <Text className={`text-sm ${!local.entity ? 'text-white' : 'text-gray-600'}`}>All</Text>
                  </TouchableOpacity>
                  {ENTITIES.map((e) => (
                    <TouchableOpacity
                      key={e}
                      onPress={() => set('entity', e)}
                      className={`px-3 py-1.5 rounded-full border ${local.entity === e ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}
                    >
                      <Text className={`text-sm ${local.entity === e ? 'text-white' : 'text-gray-600'}`}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Transaction Type */}
              <View className="mb-4">
                <Text className="text-xs font-medium text-gray-500 mb-1">Transaction Type</Text>
                <View className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                  <Picker
                    selectedValue={local.nature}
                    onValueChange={(v) => set('nature', v)}
                    style={{ height: 50 }}
                  >
                    <Picker.Item label="All Types" value="" />
                    {TX_NATURES.filter(({ value }) => availableNatures.includes(value)).map(({ value, label }) => (
                      <Picker.Item key={value} label={label} value={value} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Category */}
              <View className="mb-4">
                <Text className="text-xs font-medium text-gray-500 mb-1">Category</Text>
                {loadingCats ? (
                  <Text className="text-xs text-gray-400">Loading categories…</Text>
                ) : (
                  <View className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                    <Picker
                      selectedValue={local.category_id}
                      onValueChange={(v) => set('category_id', v)}
                      enabled={filteredCategories.length > 0}
                      style={{ height: 50 }}
                    >
                      <Picker.Item label={filteredCategories.length === 0 ? 'No categories for selection' : 'All Categories'} value="" />
                      {filteredCategories.map((c) => (
                        <Picker.Item 
                          key={c.id} 
                          label={`${c.name}${!local.entity || !local.nature ? ` (${c.entity} · ${c.nature})` : ''}`} 
                          value={String(c.id)} 
                        />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>

              {/* Sub-category */}
              <View className="mb-4">
                <Text className="text-xs font-medium text-gray-500 mb-1">Sub-category</Text>
                <View className="border border-gray-300 rounded-lg bg-white overflow-hidden">
                  <Picker
                    selectedValue={local.sub_category_id}
                    onValueChange={(v) => set('sub_category_id', v)}
                    enabled={!!local.category_id && subCategories.length > 0}
                    style={{ height: 50 }}
                  >
                    <Picker.Item label={!local.category_id ? 'Select a category first' : 'All Sub-categories'} value="" />
                    {subCategories.map((s) => (
                      <Picker.Item key={s.id} label={s.name} value={String(s.id)} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Date Filter */}
              <View className="mb-4">
                <Text className="text-xs font-medium text-gray-500 mb-1">Date Filter</Text>
                <View className="border border-gray-300 rounded-lg bg-white overflow-hidden mb-2">
                  <Picker
                    selectedValue={local.datePreset}
                    onValueChange={(v) => set('datePreset', v)}
                    style={{ height: 50 }}
                  >
                    <Picker.Item label="All Time" value="" />
                    {Object.entries(DATE_PRESET_LABELS).map(([value, label]) => (
                      <Picker.Item key={value} label={label} value={value} />
                    ))}
                  </Picker>
                </View>

                {/* Custom date inputs */}
                {local.datePreset === 'custom' && (
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-xs text-gray-500 mb-1">From</Text>
                      <TouchableOpacity
                        onPress={() => setShowDateFrom(true)}
                        className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white"
                      >
                        <Text className="text-sm">{local.date_from || 'Start date'}</Text>
                      </TouchableOpacity>
                      {showDateFrom && (
                        <DateTimePicker
                          value={local.date_from ? new Date(local.date_from + 'T00:00:00') : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(_, d) => {
                            setShowDateFrom(Platform.OS === 'ios');
                            if (d) set('date_from', d.toISOString().split('T')[0]);
                          }}
                        />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-gray-500 mb-1">To</Text>
                      <TouchableOpacity
                        onPress={() => setShowDateTo(true)}
                        className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white"
                      >
                        <Text className="text-sm">{local.date_to || 'End date'}</Text>
                      </TouchableOpacity>
                      {showDateTo && (
                        <DateTimePicker
                          value={local.date_to ? new Date(local.date_to + 'T00:00:00') : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(_, d) => {
                            setShowDateTo(Platform.OS === 'ios');
                            if (d) set('date_to', d.toISOString().split('T')[0]);
                          }}
                        />
                      )}
                    </View>
                  </View>
                )}
              </View>

              <View className="h-6" />
            </ScrollView>

            {/* Footer */}
            <View className="flex-row gap-3 px-4 py-3 bg-white border-t border-gray-200">
              <TouchableOpacity onPress={reset} className="flex-1 py-3 border border-gray-300 rounded-xl items-center bg-gray-50">
                <Text className="text-gray-600 font-medium">Reset All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={apply} className="flex-1 py-3 bg-blue-600 rounded-xl items-center">
                <Text className="text-white font-medium">Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
