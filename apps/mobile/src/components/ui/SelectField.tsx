import { type ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useColorScheme } from 'nativewind';

export interface SelectItem {
  label: string;
  value: string;
}

interface SelectFieldProps {
  label?: string;
  /** Optional element rendered on the right of the label row (e.g. a "+ Add" link). */
  action?: ReactNode;
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: SelectItem[];
  /** Leading placeholder item (value ""). */
  placeholder?: SelectItem;
  enabled?: boolean;
  containerClassName?: string;
}

export function SelectField({
  label,
  action,
  selectedValue,
  onValueChange,
  items,
  placeholder,
  enabled = true,
  containerClassName = 'mb-4',
}: SelectFieldProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const color = isDark ? '#f3f4f6' : '#1f2937';

  return (
    <View className={containerClassName}>
      {(label || action) && (
        <View className="flex-row justify-between items-center mb-1">
          {label ? <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text> : <View />}
          {action}
        </View>
      )}
      <View className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        <Picker
          mode="dropdown"
          style={{ color, backgroundColor: isDark ? '#1f2937' : '#ffffff' }}
          dropdownIconColor={color}
          selectedValue={selectedValue}
          onValueChange={onValueChange}
          enabled={enabled}
        >
          {placeholder && <Picker.Item label={placeholder.label} value={placeholder.value} />}
          {items.map((item) => (
            <Picker.Item key={item.value} label={item.label} value={item.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}
