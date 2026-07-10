import 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { useThemeColors } from '@/src/theme/colors';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-reanimated';
import '../global.css';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { LedgerProvider, useLedgers } from '@/src/context/LedgerContext';
function HeaderLeft() {
  const { ledgers, activeLedger, switchLedger } = useLedgers();
  const [menuVisible, setMenuVisible] = React.useState(false);
  const router = useRouter();
  const segments = useSegments();
  
  // Show back button if we are not on the root tabs screen
  const canGoBack = segments.length > 1 && segments[0] !== '(tabs)';

  return (
    <View className="flex-row items-center ml-4 relative">
      {canGoBack && (
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} className="text-gray-900 dark:text-white" color="currentColor" />
        </TouchableOpacity>
      )}
      {!canGoBack && <Text className="text-lg font-bold text-gray-900 dark:text-white mr-2">FinTrack</Text>}
      {activeLedger && (
        <TouchableOpacity 
          onPress={() => setMenuVisible(true)}
          className="flex-row items-center px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded-full border border-blue-200 dark:border-blue-800"
        >
          <Text className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300 mr-1">
            {activeLedger.name}
          </Text>
          <Ionicons name="caret-down" size={10} color="#1d4ed8" className="dark:text-blue-300" />
        </TouchableOpacity>
      )}

      {menuVisible && (
        <Modal transparent animationType="fade" visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} 
            activeOpacity={1} 
            onPress={() => setMenuVisible(false)}
          >
            <View 
              className="absolute top-14 left-24 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700"
              onStartShouldSetResponder={() => true}
            >
              <View className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                <Text className="text-xs text-gray-500 dark:text-gray-400">Switch Ledger</Text>
              </View>
              <View className="py-1 bg-white dark:bg-gray-800">
                {ledgers.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    onPress={() => { switchLedger(l.id.toString()); setMenuVisible(false); }}
                    className="flex-row justify-between items-center px-4 py-2.5"
                  >
                    <Text className="text-sm text-gray-700 dark:text-gray-300 capitalize">{l.name}</Text>
                    {activeLedger?.id === l.id && <Ionicons name="checkmark" size={16} color="#2563eb" />}
                  </TouchableOpacity>
                ))}
              </View>
              {editMode && (
                <View className="border-t border-gray-100 dark:border-gray-700 py-1">
                  <TouchableOpacity
                    onPress={() => {
                      setMenuVisible(false);
                      // Note: Create Ledger mobile implementation pending
                      console.log('Create ledger triggered in mobile');
                    }}
                    className="flex-row items-center gap-2 px-4 py-2.5"
                  >
                    <Ionicons name="add" size={16} color="#2563eb" />
                    <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">Create Ledger</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { loading: ledgerLoading } = useLedgers();
  const segments = useSegments();
  const router = useRouter();
  const prevAuthRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (authLoading || ledgerLoading) return;

    if (prevAuthRef.current === true && !isAuthenticated) {
      // Offline DB is removed, so no local data to clear.
    }
    prevAuthRef.current = isAuthenticated;

    const inAuthGroup = segments[0] === 'login';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, authLoading, ledgerLoading, segments]);

  if (authLoading || ledgerLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return <>{children}</>;
}



function RootContent() {
  const { theme } = useTheme();
  const colors = useThemeColors();

  return (
      <AuthProvider>
        <LedgerProvider>
          <AuthGate>
            <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.headerBg },
              headerTintColor: colors.headerText,
              headerTitleStyle: { fontWeight: 'bold' },
              headerLeft: () => <HeaderLeft />,
              headerRight: () => <HeaderRight />,
              headerTitle: '',
            }}
          >
            <Stack.Screen 
              name="(tabs)" 
              options={{ headerShown: true }} 
            />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="add" options={{ headerShown: false }} />
            <Stack.Screen name="edit/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="accounts/[id]" options={{ headerShown: true }} />
            <Stack.Screen name="categories/index" options={{ headerShown: true }} />
            <Stack.Screen name="categories/new" options={{ headerShown: true }} />
            <Stack.Screen name="categories/[catId]/sub/new" options={{ headerShown: true }} />
            <Stack.Screen name="templates/new" options={{ headerShown: true }} />
            <Stack.Screen name="tally" options={{ headerShown: true }} />
          </Stack>
        </AuthGate>
        <StatusBar style={theme === 'system' ? 'auto' : theme} />
        </LedgerProvider>
      </AuthProvider>
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
