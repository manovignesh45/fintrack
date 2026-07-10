import { forwardRef, type ReactNode } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { useColorScheme } from 'nativewind';

interface InputProps extends TextInputProps {
  label?: string;
  /** Optional element rendered on the right of the label row (e.g. a "+ Add" link). */
  action?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, action, error, containerClassName, className, ...props },
  ref
) {
  const { colorScheme } = useColorScheme();
  const placeholderColor = colorScheme === 'dark' ? '#9ca3af' : '#6b7280';

  return (
    <View className={containerClassName ?? 'mb-4'}>
      {(label || action) && (
        <View className="flex-row justify-between items-center mb-1">
          {label ? <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text> : <View />}
          {action}
        </View>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderColor}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm text-gray-900 dark:text-gray-100 ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        } ${className ?? ''}`}
        {...props}
      />
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
});
