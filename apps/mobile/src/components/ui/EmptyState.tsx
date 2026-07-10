import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'file-tray-outline', title, subtitle }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Ionicons name={icon} size={40} color="#9ca3af" />
      <Text className="text-gray-500 dark:text-gray-400 text-center mt-3 font-medium">{title}</Text>
      {subtitle ? <Text className="text-gray-400 dark:text-gray-500 text-center text-sm mt-1">{subtitle}</Text> : null}
    </View>
  );
}
