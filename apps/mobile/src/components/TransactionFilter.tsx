import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import type { FilterState } from '@fintrack/shared';
import {
  ENTITIES,
  NATURES,
  DATE_PRESET_LABELS,
  getPresetDates,
  DEFAULT_FILTERS,
  countActiveFilters,
} from '@fintrack/shared';

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export default function TransactionFilter({ filters, onChange }: Props) {
  const [visible, setVisible] = useState(false);
  const [local, setLocal] = useState<FilterState>(filters);
  const [showDateFrom, setShowDateFrom] = useState(false);
  const [showDateTo, setShowDateTo] = useState(false);
  const activeCount = countActiveFilters(filters);

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

  const set = (field: keyof FilterState, value: string) =>
    setLocal((f) => ({ ...f, [field]: value }));

  const presets = Object.entries(DATE_PRESET_LABELS) as [string, string][];

  return (
    <>
      <TouchableOpacity onPress={open} className="flex-row items-center px-3 py-1.5 rounded-lg bg-white border border-gray-300">
        <Ionicons name="filter-outline" size={16} color="#4b5563" />
        <Text className="ml-1 text-sm text-gray-600">Filters</Text>
        {activeCount > 0 && (
          <View className="ml-1 bg-blue-600 rounded-full w-5 h-5 items-center justify-center">
            <Text className="text-white text-[10px] font-bold">{activeCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVisible(false)}>
        <View className="flex-1 bg-gray-50">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text className="text-blue-600 text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold">Filters</Text>
            <TouchableOpacity onPress={reset}>
              <Text className="text-red-500 text-base">Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
            {/* Quick date presets */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 mb-2">Quick Dates</Text>
              <View className="flex-row flex-wrap gap-2">
                {presets.map(([key, label]) => {
                    const { date_from, date_to } = getPresetDates(key);
                    const isActive = local.date_from === date_from && local.date_to === date_to;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setLocal((f) => ({ ...f, date_from, date_to }))}
                      className={`px-3 py-1.5 rounded-full ${isActive ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                    >
                      <Text className={`text-xs ${isActive ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Date range */}
            <View className="mb-4 flex-row gap-2">
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

            {/* Entity */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 mb-1">Entity</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => set('entity', '')}
                  className={`flex-1 py-2 rounded-lg items-center ${!local.entity ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                >
                  <Text className={`text-sm ${!local.entity ? 'text-white' : 'text-gray-600'}`}>All</Text>
                </TouchableOpacity>
                {ENTITIES.map((e) => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => set('entity', e)}
                    className={`flex-1 py-2 rounded-lg items-center ${local.entity === e ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                  >
                    <Text className={`text-sm ${local.entity === e ? 'text-white' : 'text-gray-600'}`}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Nature */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 mb-1">Nature</Text>
              <View className="flex-row flex-wrap gap-1">
                <TouchableOpacity
                  onPress={() => set('nature', '')}
                  className={`px-3 py-1.5 rounded-full ${!local.nature ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                >
                  <Text className={`text-xs ${!local.nature ? 'text-white' : 'text-gray-600'}`}>All</Text>
                </TouchableOpacity>
                {NATURES.map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => set('nature', n)}
                    className={`px-3 py-1.5 rounded-full ${local.nature === n ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}
                  >
                    <Text className={`text-xs ${local.nature === n ? 'text-white' : 'text-gray-600'}`}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Search */}
            <View className="mb-4">
              <Text className="text-xs text-gray-500 mb-1">Search</Text>
              <TextInput
                placeholder="Search titles or notes…"
                value={local.search}
                onChangeText={(v) => set('search', v)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="px-4 py-3 bg-white border-t border-gray-200">
            <TouchableOpacity onPress={apply} className="w-full py-3 bg-blue-600 rounded-lg items-center">
              <Text className="text-white font-medium">Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
