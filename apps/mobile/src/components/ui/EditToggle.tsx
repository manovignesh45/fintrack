import { View, Text, TouchableOpacity } from 'react-native';

interface EditToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
}

/** The "Edit" pill switch reused across the header and list screens. */
export function EditToggle({ value, onValueChange, label = 'Edit' }: EditToggleProps) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
      <TouchableOpacity
        onPress={() => onValueChange(!value)}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        className={`w-9 h-5 rounded-full justify-center ${value ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-300'}`}
      >
        <View className={`w-4 h-4 bg-white dark:bg-gray-800 rounded-full ${value ? 'ml-[18px]' : 'ml-0.5'}`} />
      </TouchableOpacity>
    </View>
  );
}
