import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { Card } from './Card';

const steps: { to: string; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { to: '/categories', icon: 'pricetags-outline', label: 'Review or add your own categories' },
  { to: '/payment-methods', icon: 'wallet-outline', label: 'Add a payment method' },
  { to: '/templates', icon: 'copy-outline', label: 'Create a transaction template' },
];

export function GettingStartedCard() {
  const { user, updatePreferences } = useAuth();
  const router = useRouter();

  if (user?.preferences?.onboardingDismissed) return null;

  return (
    <Card className="p-4 mb-3 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800">
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex-1 pr-2">
          Getting started with FinTrack
        </Text>
        <TouchableOpacity
          onPress={() => updatePreferences({ onboardingDismissed: true })}
          accessibilityLabel="Dismiss getting started"
        >
          <Ionicons name="close" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>
      <View className="gap-2">
        {steps.map(({ to, icon, label }) => (
          <TouchableOpacity
            key={to}
            onPress={() => router.push(to as any)}
            className="flex-row items-center gap-2 bg-white dark:bg-gray-800 rounded-md px-3 py-2"
          >
            <Ionicons name={icon} size={16} color="#4338ca" />
            <Text className="text-sm text-indigo-800 dark:text-indigo-200">{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
}
