import { ActivityIndicator, Text, TouchableOpacity, type TouchableOpacityProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'destructive';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: Variant;
  loading?: boolean;
}

const VARIANT_BG: Record<Variant, string> = {
  primary: 'bg-blue-600 dark:bg-blue-500',
  secondary: 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600',
  destructive: 'bg-red-600 dark:bg-red-500',
};

const VARIANT_TEXT: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-800 dark:text-gray-100',
  destructive: 'text-white',
};

export function Button({ title, variant = 'primary', loading, disabled, className, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      disabled={isDisabled}
      className={`w-full py-3 rounded-lg flex-row items-center justify-center ${VARIANT_BG[variant]} ${isDisabled ? 'opacity-60' : ''} ${className ?? ''}`}
      {...props}
    >
      {loading && <ActivityIndicator size="small" color={variant === 'secondary' ? '#6b7280' : '#ffffff'} className="mr-2" />}
      <Text className={`font-semibold ${VARIANT_TEXT[variant]}`}>{title}</Text>
    </TouchableOpacity>
  );
}
