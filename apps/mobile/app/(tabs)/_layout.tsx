import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/src/context/AuthContext';

function HeaderRight() {
  const { editMode, setEditMode, user, logout } = useAuth();
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '?';

  return (
    <View className="flex-row items-center gap-3 mr-4">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-xs text-gray-500">Edit</Text>
        <TouchableOpacity
          onPress={() => setEditMode(!editMode)}
          className={`w-9 h-5 rounded-full justify-center ${editMode ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <View
            className={`w-4 h-4 bg-white rounded-full ${editMode ? 'ml-[18px]' : 'ml-0.5'}`}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={logout}
        className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center"
      >
        <Text className="text-white text-xs font-bold">{initials}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        headerShown: true,
        headerTitle: 'FinTrack',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 18 },
        headerRight: () => <HeaderRight />,
        tabBarButton: HapticTab,
        tabBarStyle: { paddingBottom: 4, height: 56 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: 'Templates',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Loans',
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Summary',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
