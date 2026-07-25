import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' as const },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' as const },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' as const },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const links = [
    { label: 'Categories', icon: 'folder-outline' as const, href: '/categories' as const },
    { label: 'Payment Methods', icon: 'card-outline' as const, href: '/payment-methods' as const },
    { label: 'Loan Reconciliation', icon: 'calculator-outline' as const, href: '/tally' as const },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900" contentContainerClassName="p-4 pb-8">
      <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">More</Text>

      {/* User info */}
      <View className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4 flex-row items-center gap-3">
        <View className="w-10 h-10 bg-blue-600 dark:bg-blue-50 dark:bg-blue-900/20 rounded-full items-center justify-center">
          <Text className="text-white font-bold text-lg">
            {(user?.username ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-medium text-gray-800 dark:text-gray-100">{user?.username ?? 'Unknown'}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Logged in</Text>
        </View>
      </View>

      {/* Theme */}
      <View className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <Text className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-3">Theme</Text>
        <View className="flex-row gap-2">
          {THEME_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setTheme(opt.value)}
              activeOpacity={0.7}
              className={`flex-1 items-center py-2.5 rounded-lg border ${
                theme === opt.value
                  ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500'
                  : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
              }`}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={theme === opt.value ? '#2563eb' : '#9ca3af'}
              />
              <Text
                className={`text-xs mt-1 font-medium ${
                  theme === opt.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Navigation links */}
      <View className="gap-2">
        {links.map((link) => (
          <TouchableOpacity
            key={link.label}
            onPress={() => router.push(link.href as any)}
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
