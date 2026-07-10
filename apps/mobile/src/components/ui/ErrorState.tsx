import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** Shown when a load fails — distinct from an empty result so users can retry. */
export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Ionicons name="cloud-offline-outline" size={40} color="#ef4444" />
      <Text className="text-gray-700 dark:text-gray-200 text-center mt-3 font-medium">{title}</Text>
      {message ? <Text className="text-gray-400 dark:text-gray-500 text-center text-sm mt-1">{message}</Text> : null}
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          className="mt-4 px-5 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 flex-row items-center gap-1.5"
        >
          <Ionicons name="refresh" size={16} color="white" />
          <Text className="text-white font-medium text-sm">Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
