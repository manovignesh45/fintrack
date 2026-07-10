import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FABProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
}

/**
 * Floating action button pinned bottom-right, lifted above the gesture-nav /
 * home indicator via the safe-area inset.
 */
export function FAB({ onPress, icon = 'add', accessibilityLabel }: FABProps) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={accessibilityLabel}
      style={{ bottom: 24 + insets.bottom }}
      className="absolute right-6 w-14 h-14 bg-blue-600 dark:bg-blue-500 rounded-full shadow-lg items-center justify-center"
    >
      <Ionicons name={icon} size={28} color="white" />
    </TouchableOpacity>
  );
}
