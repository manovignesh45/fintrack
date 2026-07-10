import { type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ScreenHeaderProps {
  title: string;
  /** Optional element rendered on the far right (e.g. an EditToggle). */
  right?: ReactNode;
  onBack?: () => void;
}

/**
 * Inline back-arrow + title row used by sub-screens. Temporary until the native
 * Stack header is scoped to own these titles (Phase 3).
 */
export function ScreenHeader({ title, right, onBack }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View className="flex-row items-center justify-between px-4 pt-2 pb-2">
      <View className="flex-row items-center gap-3 flex-1">
        <TouchableOpacity onPress={onBack ?? (() => router.back())} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#4b5563" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-800 dark:text-gray-100" numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}
