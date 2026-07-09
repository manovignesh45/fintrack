import 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { useThemeColors } from '@/src/theme/colors';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import 'react-native-reanimated';
import '../global.css';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { setupDatabase } from '@/src/db/database';
import { useNetworkSync } from '@/src/sync/useNetworkSync';
import { clearAllUserData } from '@/src/db/referenceDataRepo';

function HeaderRight() {
  const { editMode, setEditMode, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
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
                className="absolute top-14 right-4 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700"
                onStartShouldSetResponder={() => true}
              >
                {menuView === 'main' && (
                  <>
                    <View className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <Text className="text-xs text-gray-500 dark:text-gray-400">Signed in as</Text>
                      <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5" numberOfLines={1}>{user?.username}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setMenuView('settings')}
                      className="flex-row justify-between items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      <Text className="text-sm text-gray-700 dark:text-gray-300">Settings</Text>
                      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setMenuVisible(false); setMenuView('main'); logout(); }}
                      className="px-4 py-3 bg-white dark:bg-gray-800"
                    >
                      <Text className="text-sm text-red-600 dark:text-red-500">Logout</Text>
                    </TouchableOpacity>
                  </>
                )}
                {menuView === 'settings' && (
                  <>
                    <TouchableOpacity
                      onPress={() => setMenuView('main')}
                      className="flex-row items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700"
                    >
                      <Ionicons name="chevron-back" size={16} color="#9ca3af" />
                      <Text className="text-sm text-gray-600 dark:text-gray-300">Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setMenuView('theme')}
                      className="flex-row justify-between items-center px-4 py-3 bg-white dark:bg-gray-800"
                    >
                      <Text className="text-sm text-gray-700 dark:text-gray-300">Theme</Text>
                      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                  </>
                )}
                {menuView === 'theme' && (
                  <>
                    <TouchableOpacity
                      onPress={() => setMenuView('settings')}
                      className="flex-row items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700"
                    >
                      <Ionicons name="chevron-back" size={16} color="#9ca3af" />
                      <Text className="text-sm text-gray-600 dark:text-gray-300">Back</Text>
                    </TouchableOpacity>
                    <View className="py-2 bg-white dark:bg-gray-800">
                      {(['system', 'light', 'dark'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => { setTheme(t); setMenuVisible(false); setTimeout(() => setMenuView('main'), 200); }}
                          className="flex-row justify-between items-center px-4 py-2.5"
                        >
                          <Text className="text-sm text-gray-700 dark:text-gray-300 capitalize">{t}</Text>
                          {theme === t && <Ionicons name="checkmark" size={16} color="#2563eb" />}
                        </TouchableOpacity>
                      ))}
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

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const db = useSQLiteContext();
  const prevAuthRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    if (prevAuthRef.current === true && !isAuthenticated) {
      clearAllUserData(db).catch(() => {});
    }
    prevAuthRef.current = isAuthenticated;

    const inAuthGroup = segments[0] === 'login';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, segments]);

  return <>{children}</>;
}

function NetworkSyncListener() {
  useNetworkSync();
  return null;
}

function RootContent() {
  const { theme } = useTheme();
  const colors = useThemeColors();

  return (
    <SQLiteProvider databaseName="fintrack.db" onInit={setupDatabase}>
      <AuthProvider>
        <AuthGate>
          <NetworkSyncListener />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.headerBg },
              headerTintColor: colors.headerText,
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          >
            <Stack.Screen 
              name="(tabs)" 
              options={{ 
                headerShown: true,
                headerTitle: 'FinTrack',
                headerTitleStyle: { fontWeight: 'bold', fontSize: 18, color: colors.headerText },
                headerStyle: { backgroundColor: colors.headerBg },
                headerRight: () => <HeaderRight />
              }} 
            />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="add" options={{ title: 'Add Transaction', headerShown: false }} />
            <Stack.Screen name="edit/[id]" options={{ title: 'Edit Transaction' }} />
            <Stack.Screen name="accounts/[id]" options={{ title: 'Account Details' }} />
            <Stack.Screen name="categories/index" options={{ title: 'Categories' }} />
            <Stack.Screen name="categories/new" options={{ title: 'Create Category' }} />
            <Stack.Screen name="categories/[catId]/sub/new" options={{ title: 'Create Sub-category' }} />
            <Stack.Screen name="templates/new" options={{ title: 'Create Template' }} />
            <Stack.Screen name="tally" options={{ title: 'Loan Reconciliation' }} />
          </Stack>
        </AuthGate>
        <StatusBar style={theme === 'system' ? 'auto' : theme} />
      </AuthProvider>
    </SQLiteProvider>
  );
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <BottomSheetModalProvider>
          <RootContent />
        </BottomSheetModalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
