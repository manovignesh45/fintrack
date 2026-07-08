import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/src/context/AuthContext';
import { useThemeColors } from '@/src/theme/colors';

function HeaderRight() {
  const { editMode, setEditMode, user, logout } = useAuth();
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuView, setMenuView] = React.useState<'main' | 'settings' | 'theme'>('main');
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
        onPress={() => setMenuVisible(true)}
        className="w-8 h-8 rounded-full bg-blue-600 items-center justify-center"
      >
        <Text className="text-white text-xs font-bold">{initials}</Text>
      </TouchableOpacity>

      <React.Fragment>
        {menuVisible && (
          <Modal transparent animationType="fade" visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
            <TouchableOpacity 
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} 
              activeOpacity={1} 
              onPress={() => { setMenuVisible(false); setTimeout(() => setMenuView('main'), 200); }}
            >
              <View 
                className="absolute top-14 right-4 w-48 bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200"
                onStartShouldSetResponder={() => true}
              >
                {menuView === 'main' && (
                  <>
                    <View className="px-4 py-3 border-b border-gray-100">
                      <Text className="text-xs text-gray-500">Signed in as</Text>
                      <Text className="text-sm font-semibold text-gray-800 mt-0.5" numberOfLines={1}>{user?.username}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setMenuView('settings')}
                      className="flex-row justify-between items-center px-4 py-3 border-b border-gray-100 bg-white"
                    >
                      <Text className="text-sm text-gray-700">Settings</Text>
                      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setMenuVisible(false); setMenuView('main'); logout(); }}
                      className="px-4 py-3 bg-white"
                    >
                      <Text className="text-sm text-red-600">Logout</Text>
                    </TouchableOpacity>
                  </>
                )}
                {menuView === 'settings' && (
                  <>
                    <TouchableOpacity
                      onPress={() => setMenuView('main')}
                      className="flex-row items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50"
                    >
                      <Ionicons name="chevron-back" size={16} color="#6b7280" />
                      <Text className="text-sm text-gray-600">Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setMenuView('theme')}
                      className="flex-row justify-between items-center px-4 py-3 bg-white"
                    >
                      <Text className="text-sm text-gray-700">Theme</Text>
                      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                  </>
                )}
                {menuView === 'theme' && (
                  <>
                    <TouchableOpacity
                      onPress={() => setMenuView('settings')}
                      className="flex-row items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50"
                    >
                      <Ionicons name="chevron-back" size={16} color="#6b7280" />
                      <Text className="text-sm text-gray-600">Back</Text>
                    </TouchableOpacity>
                    <View className="px-4 py-3 bg-white">
                      <Text className="text-sm text-gray-500 italic">Coming in Phase 3</Text>
                    </View>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </React.Fragment>
    </View>
  );
}

export default function TabLayout() {
  const colors = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.iconActive,
        tabBarInactiveTintColor: colors.iconMuted,
        headerShown: true,
        headerTitle: 'FinTrack',
        headerTitleStyle: { fontWeight: 'bold', fontSize: 18, color: colors.headerText },
        headerStyle: { backgroundColor: colors.headerBg },
        headerRight: () => <HeaderRight />,
        tabBarButton: HapticTab,
        tabBarStyle: { paddingBottom: 4, height: 56, backgroundColor: colors.tabBarBg, borderTopColor: colors.border },
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
