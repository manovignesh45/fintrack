import { useColorScheme } from 'nativewind';

export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    icon: isDark ? '#d1d5db' : '#4b5563',
    iconActive: isDark ? '#60a5fa' : '#2563eb',
    iconMuted: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#e5e7eb',
    placeholder: isDark ? '#6b7280' : '#9ca3af',
    activityIndicator: isDark ? '#60a5fa' : '#2563eb',
    headerBg: isDark ? '#1f2937' : '#ffffff',
    headerText: isDark ? '#f9fafb' : '#1f2937',
    tabBarBg: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f9fafb' : '#1f2937',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    red: isDark ? '#f87171' : '#ef4444',
    green: isDark ? '#4ade80' : '#16a34a',
    blue: isDark ? '#60a5fa' : '#2563eb',
  };
}
