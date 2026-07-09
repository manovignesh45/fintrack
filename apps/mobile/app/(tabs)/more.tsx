import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '@/src/context/AuthContext';

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const links = [
    { label: 'Categories', icon: 'folder-outline' as const, href: '/categories' as const },
    { label: 'Loan Reconciliation', icon: 'calculator-outline' as const, href: '/tally' as const },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900" contentContainerClassName="p-4 pb-8">
      <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">More</Text>

      {/* User info */}
      <View className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4 flex-row items-center gap-3">
        <View className="w-10 h-10 bg-blue-600 dark:bg-blue-50 dark:bg-blue-900/200 rounded-full items-center justify-center">
          <Text className="text-white font-bold text-lg">
            {(user?.username ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-medium text-gray-800 dark:text-gray-100">{user?.username ?? 'Unknown'}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Logged in</Text>
        </View>
      </View>

      {/* Navigation links */}
      <View className="gap-2">
        {links.map((link) => (
          <TouchableOpacity
            key={link.label}
            onPress={() => router.push(link.href)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex-row items-center justify-between"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-3">
              <Ionicons name={link.icon} size={20} color="#4b5563" />
              <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">{link.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity
        onPress={logout}
        className="bg-red-50 rounded-lg border border-red-200 p-4 flex-row items-center justify-center gap-2 mt-6"
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={18} color="#dc2626" />
        <Text className="text-sm font-medium text-red-600">Log Out</Text>
      </TouchableOpacity>

      {/* App Version Info */}
      <View className="mt-8 mb-4 items-center">
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          FinTrack Version {Constants.expoConfig?.version || '2.0.0'}
        </Text>
      </View>
    </ScrollView>
  );
}
