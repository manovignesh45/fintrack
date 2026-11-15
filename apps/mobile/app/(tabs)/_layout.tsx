import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/src/theme/colors';
import { useQuickNotesSummary } from '@/src/store/quickNotes';

const MaterialTopTabs = withLayoutContext(createMaterialTopTabNavigator().Navigator);

export default function TabLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const quickNotes = useQuickNotesSummary();
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        lazy: true,
        tabBarShowIcon: true,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.iconActive,
        tabBarInactiveTintColor: colors.iconMuted,
        tabBarIndicatorStyle: { backgroundColor: 'transparent' },
        tabBarLabelStyle: { fontSize: 10, textTransform: 'none', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarStyle: {
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
      }}
    >
      <MaterialTopTabs.Screen
        name="index"
        options={{
          title: 'Transactions',
          tabBarAccessibilityLabel: quickNotes.count > 0 ? `Transactions, ${quickNotes.count} quick notes to review` : 'Transactions',
          tabBarIcon: ({ color }: { color: string }) => (
            <View>
              <Ionicons name="receipt-outline" size={24} color={color} />
              {/* Quick notes still waiting to become transactions */}
              {quickNotes.count > 0 && (
                <View className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 items-center justify-center">
                  <Text className="text-[10px] font-bold text-white">{quickNotes.count > 99 ? '99+' : quickNotes.count}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="templates"
        options={{
          title: 'Templates',
          tabBarIcon: ({ color }: { color: string }) => <Ionicons name="document-text-outline" size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="accounts"
        options={{
          title: 'Loans',
          tabBarIcon: ({ color }: { color: string }) => <Ionicons name="business-outline" size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarIcon: ({ color }: { color: string }) => <Ionicons name="bar-chart-outline" size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }: { color: string }) => <Ionicons name="ellipsis-horizontal" size={24} color={color} />,
        }}
      />
    </MaterialTopTabs>
  );
}
