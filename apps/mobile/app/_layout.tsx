import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { useThemeColors } from '@/src/theme/colors';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import 'react-native-reanimated';
import '../global.css';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { setupDatabase } from '@/src/db/database';
import { useNetworkSync } from '@/src/sync/useNetworkSync';
import { clearAllUserData } from '@/src/db/referenceDataRepo';

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
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}
