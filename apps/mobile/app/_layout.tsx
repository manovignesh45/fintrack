import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { AuthProvider, useAuth } from '@/src/context/AuthContext';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="add" options={{ title: 'Add Transaction' }} />
          <Stack.Screen name="edit/[id]" options={{ title: 'Edit Transaction' }} />
          <Stack.Screen name="accounts/[id]" options={{ title: 'Account Details' }} />
          <Stack.Screen name="categories/index" options={{ title: 'Categories' }} />
          <Stack.Screen name="categories/new" options={{ title: 'Create Category' }} />
          <Stack.Screen name="categories/[catId]/sub/new" options={{ title: 'Create Sub-category' }} />
          <Stack.Screen name="templates/new" options={{ title: 'Create Template' }} />
          <Stack.Screen name="tally" options={{ title: 'Loan Reconciliation' }} />
        </Stack>
      </AuthGate>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
