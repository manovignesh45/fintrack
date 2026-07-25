import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '../theme/colors';

export const PIN_LENGTH = 4;

interface PinPadProps {
  /** Title shown above the dots, e.g. "Enter PIN". */
  title: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Error message; rendered in red and triggers a shake + clear. */
  error?: string;
  /** Fired once the user has entered PIN_LENGTH digits. */
  onComplete: (pin: string) => void;
  /** Optional bottom-left key (e.g. a biometric button). */
  bottomLeft?: React.ReactNode;
  /** Disable input (e.g. while verifying). */
  disabled?: boolean;
}

/**
 * Reusable 4-digit PIN entry: masked dot indicators + a numeric keypad. Shared by
 * the lock screen and the PIN setup/change flow. Owns only the in-progress digit
 * buffer; parents react via onComplete and drive `error` to reset it.
 */
export function PinPad({ title, subtitle, error, onComplete, bottomLeft, disabled }: PinPadProps) {
  const colors = useThemeColors();
  const [digits, setDigits] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  // Clear the buffer and shake whenever the parent reports an error.
  useEffect(() => {
    if (error) {
      setDigits('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Animated.sequence([
        Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error, shake]);

  const press = useCallback(
    (key: string) => {
      if (disabled) return;
      Haptics.selectionAsync();
      setDigits((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + key;
        if (next.length === PIN_LENGTH) {
          // Defer so the last dot renders before the parent processes.
          setTimeout(() => onComplete(next), 0);
        }
        return next;
      });
    },
    [disabled, onComplete]
  );

  const backspace = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync();
    setDigits((prev) => prev.slice(0, -1));
  }, [disabled]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View className="items-center">
      <Text className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center px-8">{subtitle}</Text>
      ) : (
        <View className="mb-6" />
      )}

      {/* Dots */}
      <Animated.View className="flex-row gap-4 mb-3" style={{ transform: [{ translateX: shake }] }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            className={`w-4 h-4 rounded-full border-2 ${
              i < digits.length
                ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                : 'border-gray-400 dark:border-gray-600'
            }`}
          />
        ))}
      </Animated.View>

      <Text className="text-sm text-red-500 mb-4 h-5">{error ?? ''}</Text>

      {/* Keypad */}
      <View className="flex-row flex-wrap justify-center" style={{ width: 260 }}>
        {keys.map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => press(k)}
            disabled={disabled}
            activeOpacity={0.6}
            className="items-center justify-center m-2 rounded-full bg-gray-100 dark:bg-gray-800"
            style={{ width: 68, height: 68 }}
          >
            <Text className="text-2xl font-medium text-gray-800 dark:text-gray-100">{k}</Text>
          </TouchableOpacity>
        ))}

        {/* Bottom row: optional action, 0, backspace */}
        <View className="items-center justify-center m-2" style={{ width: 68, height: 68 }}>
          {bottomLeft}
        </View>
        <TouchableOpacity
          onPress={() => press('0')}
          disabled={disabled}
          activeOpacity={0.6}
          className="items-center justify-center m-2 rounded-full bg-gray-100 dark:bg-gray-800"
          style={{ width: 68, height: 68 }}
        >
          <Text className="text-2xl font-medium text-gray-800 dark:text-gray-100">0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={backspace}
          disabled={disabled}
          activeOpacity={0.6}
          className="items-center justify-center m-2"
          style={{ width: 68, height: 68 }}
        >
          <Ionicons name="backspace-outline" size={26} color={colors.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
