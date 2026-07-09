import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '@/src/theme/colors';

const MaterialTopTabs = withLayoutContext(createMaterialTopTabNavigator().Navigator);

export default function TabLayout() {
  const colors = useThemeColors();
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
        tabBarStyle: { 
          paddingBottom: 4, 
          height: 56, 
          backgroundColor: colors.tabBarBg, 
          borderTopWidth: 1, 
          borderTopColor: colors.border,
          justifyContent: 'center'
        },
      }}
    >
      <MaterialTopTabs.Screen
        name="index"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }: { color: string }) => <Ionicons name="receipt-outline" size={24} color={color} />,
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
