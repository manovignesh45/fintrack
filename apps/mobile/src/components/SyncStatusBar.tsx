import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSyncStore } from '@/src/store/syncStore';

export function SyncStatusBar() {
  const { isSyncing, pendingCount, syncError, triggerSync } = useSyncStore();

  if (syncError) {
    return (
      <View className="bg-red-50 border-b border-red-200 px-4 py-1.5 flex-row items-center justify-between">
        <Text className="text-xs text-red-700 flex-1">{syncError}</Text>
        <TouchableOpacity onPress={() => triggerSync?.()} className="ml-2">
          <Text className="text-xs text-red-700 font-semibold underline">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isSyncing) {
    return (
      <View className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex-row items-center gap-2">
        <ActivityIndicator size="small" color="#2563eb" />
        <Text className="text-xs text-blue-700">Syncing...</Text>
      </View>
    );
  }

  if (pendingCount > 0) {
    return (
      <View className="bg-yellow-50 border-b border-yellow-200 px-4 py-1.5 flex-row items-center justify-between">
        <Text className="text-xs text-yellow-800">
          {pendingCount} transaction{pendingCount > 1 ? 's' : ''} pending sync
        </Text>
        <TouchableOpacity onPress={() => triggerSync?.()} className="ml-2">
          <Text className="text-xs text-yellow-800 font-semibold underline">Sync now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}
