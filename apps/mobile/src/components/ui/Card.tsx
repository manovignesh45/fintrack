import { View, type ViewProps } from 'react-native';

/** Surface card matching tw.card — white/gray-800 with a subtle border. */
export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className ?? ''}`}
      {...props}
    />
  );
}
